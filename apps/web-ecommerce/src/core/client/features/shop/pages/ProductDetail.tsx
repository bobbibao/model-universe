'use client';

import { rememberViewed } from '@/shared/client/recentlyViewed';
import { useProductConditions } from '@/shared/client/hooks/useProductConditions';
import { productPath } from '@/shared/slug';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import useCustomerActionRefresh from '@/hooks/useCustomerActionRefresh';
import Link from '@/i18n/navigation';
import { useRouter } from '@/i18n/navigation';
import { useParams, useSearchParams } from 'next/navigation';
import ProductApi from '@/core/client/api/Product';
import Api from '@/core/client/api/Api';
import WishlistApi from '@/core/client/api/Wishlist';
import { useCart } from '@/shared/client/providers/CartProvider';
import { useCurrentUser } from '@/shared/client/providers/CurrentUserProvider';
import { useCustomerAssistant } from '@/shared/client/providers/CustomerAssistantProvider';
import { formatVND } from '@/shared/server/utils/utils';
import type { WishlistItem } from '@/shared/types/cart';
import OfferPanel from '../components/OfferPanel';
import type { ProductConditionOption, ProductDetail as ProductDetailType } from '@/shared/types/product';
import ProductGallery from '../components/ProductGallery';
import ProductReviews from '../components/ProductReviews';
import RatingStars from '../components/RatingStars';
import RestockAlert from '../components/RestockAlert';
import { trackAddToCart, trackViewContent } from '@/shared/client/utils/tracking';
import AdminIcon from '@/components/Admin/AdminIcon';
import ProductImage from '@/components/ProductImage';
import WorkspaceTabs from '@/components/Store/WorkspaceTabs';

// The URL parameter that keeps the chosen condition (a condition option's product id) when the page is shared.
const CONDITION_PARAM = 'tinh-trang';

const InfoItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded-md bg-gray-2 px-4 py-3 dark:bg-store-card">
    <dt className="text-sm text-body dark:text-store-muted">{label}</dt>
    <dd className="font-semibold">{value}</dd>
  </div>
);

// The units a customer can choose: the main listing and its condition options (an older response has only the
// listing itself).
const unitsOf = (product: ProductDetailType): ProductConditionOption[] =>
  product.conditionOptions?.length
    ? product.conditionOptions
    : [
        {
          id: product.id,
          uuid: product.uuid ?? '',
          slug: product.slug ?? '',
          sku: product.sku,
          isMain: true,
          condition: product.condition ?? 'new',
          conditionNote: product.conditionNote ?? null,
          missingAccessories: product.missingAccessories ?? [],
          defects: product.defects ?? [],
          includedAccessories: product.includedAccessories ?? [],
          boxCondition: product.boxCondition ?? null,
          assemblyState: product.assemblyState,
          imageUrl: product.imageUrl,
          images: product.images,
          stock: product.stock,
          price: product.price,
          listPriceVerified: product.listPriceVerified,
          salePrice: product.salePrice,
          discountPercent: product.discountPercent,
          discountEndsAt: product.discountEndsAt,
          managedSale: product.managedSale,
        },
      ];

// The unit shown first: the one asked for (a shared link or an option's own page), else the main listing while it is
// in stock, else the first unit in stock.
const initialUnitId = (product: ProductDetailType, requested: number | null) => {
  const units = unitsOf(product);
  const wanted = units.find(
    (unit) => unit.id === requested || (!requested && unit.id === product.selectedOptionId && !unit.isMain),
  );
  return (wanted ?? (units[0].stock > 0 ? units[0] : (units.find((unit) => unit.stock > 0) ?? units[0]))).id;
};

const ProductDetail = ({ initialProduct }: { initialProduct?: ProductDetailType } = {}) => {
  const t = useTranslations('catalog');
  const conditionTypes = useProductConditions();
  const ux = useTranslations('commerceUX');
  const restockText = useTranslations('customerTools');
  const seller = useTranslations('sellerStore');
  const locale = useLocale();
  // The SEO page passes the slug; older /shop/product/<id> links redirect to it.
  const params = useParams<{ id?: string; slug?: string }>();
  const searchParams = useSearchParams();
  const requestedUnit = Number(searchParams.get(CONDITION_PARAM)) || null;
  const productKey = params.slug || (Number(params.id) > 0 ? Number(params.id) : null);
  const [product, setProduct] = useState<ProductDetailType | null | undefined>(initialProduct);
  const [unitId, setUnitId] = useState(initialProduct ? initialUnitId(initialProduct, requestedUnit) : 0);
  const productId = product?.id ?? initialProduct?.id ?? 0;
  const [quantity, setQuantity] = useState(1);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [reserveBusy, setReserveBusy] = useState(false);
  const reservationRequest = useRef<{ key: string; quantity: number } | undefined>(undefined);
  const purchaseRef = useRef<HTMLDivElement>(null);
  const [purchaseVisible, setPurchaseVisible] = useState(true);
  const [addedUnit, setAddedUnit] = useState<number | null>(null);
  const [informationTab, setInformationTab] = useState('description');
  const router = useRouter();
  const { addItem } = useCart();
  const { user } = useCurrentUser();
  const agent = useCustomerAssistant();

  const loadProduct = useCallback(
    async (resetSelection: boolean) => {
      if (!productKey) {
        setProduct(null);
        return;
      }
      const result = await ProductApi.getProduct(productKey);
      setProduct(result ?? null);
      if (result && resetSelection) {
        trackViewContent({ id: String(result.id), name: result.name, price: result.salePrice, quantity: 1 });
        rememberViewed(result);
      }
      if (resetSelection) {
        setQuantity(1);
        if (result)
          setUnitId(
            initialUnitId(result, Number(new URLSearchParams(window.location.search).get(CONDITION_PARAM)) || null),
          );
      }
    },
    [productKey],
  );

  useEffect(() => {
    loadProduct(true);
  }, [loadProduct]);

  useEffect(() => {
    if (user) WishlistApi.getWishlist().then((items) => setWishlist(items || []));
    else setWishlist([]);
  }, [user]);
  const refreshAssistantChanges = useCallback(() => {
    void loadProduct(false);
    if (user) WishlistApi.getWishlist().then((items) => setWishlist(items || []));
  }, [loadProduct, user]);
  useCustomerActionRefresh('wishlist_add,wishlist_remove,review', refreshAssistantChanges);

  useEffect(() => {
    const element = purchaseRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setPurchaseVisible(entry.isIntersecting), { threshold: 0 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [product?.id]);
  useEffect(() => setAddedUnit(null), [unitId, quantity]);

  const units = useMemo(() => (product ? unitsOf(product) : []), [product]);
  // The chosen unit: what is priced, pictured, put in the cart, saved or reserved.
  const unit = units.find((item) => item.id === unitId) ?? units[0];
  const unitPath = product
    ? `${productPath(product)}${unit && !unit.isMain ? `?${CONDITION_PARAM}=${unit.id}` : ''}`
    : '';

  const chooseUnit = (id: number) => {
    setUnitId(id);
    setQuantity(1);
    const chosen = units.find((item) => item.id === id);
    const url = new URL(window.location.href);
    if (chosen && !chosen.isMain) url.searchParams.set(CONDITION_PARAM, String(id));
    else url.searchParams.delete(CONDITION_PARAM);
    window.history.replaceState(window.history.state, '', url);
  };

  const wishlistItem = wishlist.find((item) => item.productId === unit?.id);

  const toggleWishlist = async () => {
    if (!unit) return;
    if (!user) {
      router.push(`/auth/signin?redirect=${encodeURIComponent(unitPath || `/shop/product/${productId}`)}`);
      return;
    }
    setWishlistBusy(true);
    if (wishlistItem) {
      if (await WishlistApi.removeItem(wishlistItem.id)) {
        setWishlist(wishlist.filter((item) => item.id !== wishlistItem.id));
      }
    } else {
      const added = await WishlistApi.addItem(unit.id);
      if (added) setWishlist([...wishlist, { ...added } as WishlistItem]);
    }
    setWishlistBusy(false);
  };

  if (product === undefined) {
    return (
      <div className="flex justify-center py-32">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    );
  }

  if (product === null || !unit) {
    return (
      <div className="py-32 text-center">
        <p className="mb-4 text-xl">{t('notFound')}</p>
        <Link href="/cua-hang" className="font-medium text-brand-hover hover:underline">
          {t('backToShop')}
        </Link>
      </div>
    );
  }

  const inStock = unit.stock > 0;
  // The listing as the chosen unit: its price, discount and stock (the model's name and brand stay the listing's).
  const offer: ProductDetailType = { ...product, ...unit, id: unit.id, images: unit.images };
  const listOrInspect = (items: string[]) => items.join(', ') || t('inspectionRequired');
  const addToCart = () => {
    if (!inStock) return;
    if (addItem({ ...offer, name: product.name, brandName: product.brandName }, quantity)) {
      trackAddToCart({ id: String(unit.id), name: product.name, price: unit.salePrice, quantity });
      setAddedUnit(unit.id);
    }
  };

  return (
    <div className="studio-product-detail mx-auto max-w-7xl px-4 py-10">
      <nav aria-label={ux('breadcrumb')} className="product-breadcrumb mb-6 text-sm text-body dark:text-store-muted">
        <Link href="/cua-hang" className="hover:text-brand-hover">
          {t('title')}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="product-detail-layout">
        <div className="product-detail-media">
          <ProductGallery
            images={[unit.imageUrl, ...unit.images]}
            alt={`${product.name} · ${conditionTypes.label(unit.condition)}`}
          />
          {!!product.imageAttributions?.length && (
            <details className="mt-4 text-xs text-body">
              <summary className="cursor-pointer">{t('imageCredits')}</summary>
              {product.imageAttributions.map((credit) => (
                <p className="mt-2" key={credit.imageUrl}>
                  <a href={credit.source} target="_blank" rel="noreferrer" className="underline">
                    {credit.creator}
                  </a>{' '}
                  ·{' '}
                  <a href={credit.licenseUrl} target="_blank" rel="noreferrer" className="underline">
                    {credit.license}
                  </a>{' '}
                  · WebP
                </p>
              ))}
            </details>
          )}
        </div>

        <div className="product-detail-offer flex flex-col gap-5">
          <p className="product-detail-brand">
            {product.brandName} <span> / {product.scale || product.modelCode || 'MODEL UNIVERSE'}</span>
          </p>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <div className="flex items-center gap-2 text-body dark:text-store-muted">
            {product.reviewCount > 0 ? (
              <>
                <RatingStars rating={product.rating} />
                <span>{t('reviewCount', { count: product.reviewCount })}</span>
              </>
            ) : (
              <span>{t('noReviews')}</span>
            )}
          </div>
          <ConditionPicker units={units} selected={unit} onSelect={chooseUnit} />
          <OfferPanel product={offer} />
          {product.partnerId && (
            <Link className="text-sm underline" href={`/sellers/${product.partnerId}`}>
              {seller('view')}
            </Link>
          )}

          <div
            className="product-purchase"
            id="product-purchase"
            ref={purchaseRef}
            role="group"
            aria-label={ux('purchaseActions')}
            tabIndex={-1}
          >
            {inStock && (
              <div className="product-purchase-quantity">
                <span className="mb-2 block font-medium">{t('quantity')}</span>
                <div className="flex w-40 items-center rounded border-[1.5px] border-stroke dark:border-store-card">
                  <button
                    className="px-4 py-2 text-lg disabled:opacity-40"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    aria-label={t('decrease')}
                  >
                    −
                  </button>
                  <span className="flex-1 text-center font-semibold">{quantity}</span>
                  <button
                    className="px-4 py-2 text-lg disabled:opacity-40"
                    onClick={() => setQuantity(Math.min(unit.stock, quantity + 1))}
                    disabled={quantity >= unit.stock}
                    aria-label={t('increase')}
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            <div className={`product-purchase-actions flex flex-wrap gap-3${inStock ? '' : ' is-restock'}`}>
              {inStock ? (
                <button
                  disabled={!inStock}
                  onClick={addToCart}
                  className="flex-1 rounded-md bg-brand px-6 py-3 font-semibold text-brand-ink hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t('addToCart')}
                </button>
              ) : (
                <RestockAlert key={unit.id} productId={unit.id} className="mu-button" />
              )}
              <button
                onClick={toggleWishlist}
                disabled={wishlistBusy}
                className="rounded-md bg-gray px-6 py-3 font-semibold text-black hover:opacity-90 disabled:opacity-60 dark:bg-store-card dark:text-store-text"
              >
                {wishlistItem ? t('unsave') : t('save')}
              </button>
            </div>
            {inStock && (
              <div className="product-purchase-feedback" role="status" aria-live="polite">
                {addedUnit === unit.id ? (
                  <>
                    <AdminIcon name="check" size={18} />
                    <span>{ux('addedToCart')}</span>
                    <Link href="/cart">{ux('viewCart')} →</Link>
                  </>
                ) : (
                  <span>{ux('checkoutHint')}</span>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => agent.open(t('assistantPrompt', { id: product.id, name: product.name }))}
            className="flex items-center justify-between gap-3 rounded-xl border border-brand-hover/25 bg-brand/10 px-4 py-4 text-left hover:bg-brand/20"
          >
            <span>
              <strong className="block text-sm">✦ {t('askAssistant')}</strong>
              <span className="mt-1 block text-xs text-body dark:text-store-muted">{t('assistantNote')}</span>
            </span>
            <span aria-hidden="true">↗</span>
          </button>

          {product.modelCode && !product.partnerId && (
            <button
              disabled={!inStock || reserveBusy}
              className="mu-button mu-button-secondary w-full disabled:opacity-50"
              onClick={async () => {
                if (!user) {
                  router.push(`/auth/signin?redirect=${encodeURIComponent(unitPath)}`);
                  return;
                }
                if (reservationRequest.current?.quantity !== quantity)
                  reservationRequest.current = { key: crypto.randomUUID(), quantity };
                setReserveBusy(true);
                try {
                  await Api.post('/reservations', {
                    productId: unit.id,
                    quantity,
                    expectedTotal: unit.salePrice * quantity,
                    requestKey: reservationRequest.current.key,
                  });
                  router.push('/reservations');
                } catch {
                  /* The shared API reports policy gates and stale quotes. */
                } finally {
                  setReserveBusy(false);
                }
              }}
            >
              {t('reserve')}
            </button>
          )}
        </div>
      </div>

      <WorkspaceTabs
        className="product-information"
        label={t('details')}
        value={informationTab}
        onChange={setInformationTab}
        tabs={[
          {
            id: 'description',
            label: ux('descriptionTab'),
            content: (
              <section className="product-story" aria-labelledby="product-story-title">
                <h2 id="product-story-title">{ux('aboutProduct')}</h2>
                <p className="whitespace-pre-line leading-relaxed">
                  {(locale === 'vi' ? product.descriptionVi : product.descriptionEn) ||
                    product.description ||
                    ux('descriptionPending')}
                </p>
              </section>
            ),
          },
          {
            id: 'details',
            label: t('details'),
            content: (
              <div className="product-information-details">
                <div className="product-condition-disclosure">
                  <h2 className="font-bold">{t('details')}</h2>
                  <p className="mu-note">
                    {t('accessories')}: {listOrInspect(unit.includedAccessories)}
                  </p>
                  {unit.missingAccessories.length > 0 && (
                    <p className="mu-note">
                      {t('missingAccessories')}: {unit.missingAccessories.join(', ')}
                    </p>
                  )}
                  <p className="mu-note">
                    {t('defects')}: {listOrInspect(unit.defects)}
                  </p>
                  <p className="mu-note">{t('unboxing')}</p>
                </div>
                <dl className="product-specifications grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <InfoItem label={t('brand')} value={product.brandName} />
                  <InfoItem label={t('modelCode')} value={product.modelCode || '—'} />
                  <InfoItem label={t('scale')} value={product.scale || '—'} />
                  <InfoItem label={t('condition')} value={conditionTypes.label(unit.condition)} />
                  <InfoItem label={t('assembly')} value={unit.assemblyState ? t(unit.assemblyState) : '—'} />
                  <InfoItem label={t('box')} value={unit.boxCondition || '—'} />
                  <InfoItem
                    label={t('availability')}
                    value={
                      inStock ? (
                        <span className="text-success">{t('availableCount', { count: unit.stock })}</span>
                      ) : (
                        <span className="text-danger">{t('soldOut')}</span>
                      )
                    }
                  />
                  <InfoItem label="SKU" value={unit.sku} />
                </dl>
              </div>
            ),
          },
          {
            id: 'reviews',
            label: t('reviews'),
            count: product.reviewCount,
            content: (
              <ProductReviews
                productId={product.id}
                rating={product.rating}
                reviewCount={product.reviewCount}
                distribution={product.ratingDistribution}
                onReviewSubmitted={() => loadProduct(false)}
              />
            ),
          },
        ]}
      />
      {!purchaseVisible && (
        <div className="product-dock" aria-label={ux('purchaseActions')}>
          <div>
            <strong>{product.name}</strong>
            <span>
              {conditionTypes.label(unit.condition)} · {formatVND(unit.salePrice, locale)}
            </span>
          </div>
          <button
            type="button"
            className="mu-button"
            onClick={() => {
              document.getElementById('product-purchase')?.scrollIntoView({
                behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
                block: 'center',
              });
              const target = purchaseRef.current?.querySelector<HTMLElement>(
                '.product-purchase-actions button, .product-purchase-actions .restock-action a',
              );
              (target && !target.matches(':disabled') ? target : purchaseRef.current)?.focus({ preventScroll: true });
            }}
          >
            {inStock ? ux('chooseAndBuy') : restockText('startAlert')} <span aria-hidden="true">↑</span>
          </button>
        </div>
      )}
    </div>
  );
};

// The conditions a model is sold in, as cards to choose from (native radios: arrow keys move between them), each with
// its price and stock; below, what the chosen condition means and what is missing or wrong with it.
const ConditionPicker = ({
  units,
  selected,
  onSelect,
}: {
  units: ProductConditionOption[];
  selected: ProductConditionOption;
  onSelect: (id: number) => void;
}) => {
  const t = useTranslations('catalog');
  const conditionTypes = useProductConditions();
  const locale = useLocale();
  const facts = [
    selected.conditionNote,
    selected.missingAccessories.length > 0 && `${t('missingAccessories')}: ${selected.missingAccessories.join(', ')}`,
    selected.condition !== 'new' && selected.defects.length > 0 && `${t('defects')}: ${selected.defects.join(', ')}`,
  ].filter(Boolean) as string[];
  return (
    <section className="condition-picker" aria-labelledby="condition-picker-title">
      <div className="condition-picker-head">
        <h2 id="condition-picker-title">{units.length > 1 ? t('chooseCondition') : t('condition')}</h2>
        {units.length > 1 && <p>{t('conditionHint')}</p>}
      </div>
      {units.length > 1 && (
        <div className="condition-options" role="radiogroup" aria-labelledby="condition-picker-title">
          {units.map((unit) => (
            <label key={unit.id} className={`condition-option${unit.stock <= 0 ? ' is-soldout' : ''}`}>
              <input
                type="radio"
                name="condition-option"
                value={unit.id}
                checked={unit.id === selected.id}
                onChange={() => onSelect(unit.id)}
              />
              <span className="condition-option-card">
                <span className="condition-option-radio" aria-hidden="true" />
                <span className="condition-option-image" aria-hidden="true">
                  <ProductImage src={unit.imageUrl} alt="" sizes="48px" className="object-contain" />
                </span>
                <span className="condition-option-description">
                  <span className={`condition-chip is-${unit.condition}`}>{conditionTypes.label(unit.condition)}</span>
                  <span className="condition-option-note">
                    {unit.conditionNote || conditionTypes.description(unit.condition)}
                  </span>
                </span>
                <span className="condition-option-price">
                  <strong>{formatVND(unit.salePrice, locale)}</strong>
                  {unit.salePrice < unit.price && <s>{formatVND(unit.price, locale)}</s>}
                  <small className={unit.stock > 0 ? 'is-available' : ''}>
                    {unit.stock > 0 ? t('conditionStock', { count: unit.stock }) : t('conditionSoldOut')}
                  </small>
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
      <div className={`condition-details is-${selected.condition}`} aria-live="polite">
        {units.length === 1 && (
          <span className={`condition-chip is-${selected.condition}`}>{conditionTypes.label(selected.condition)}</span>
        )}
        <p>{conditionTypes.description(selected.condition)}</p>
        {facts.length > 0 && (
          <ul>
            {facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default ProductDetail;
