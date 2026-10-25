'use client';

import { rememberViewed } from '@/shared/client/recentlyViewed';
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
  const ux = useTranslations('commerceUX');
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
  const [size, setSize] = useState(initialProduct?.availableSizes[0] || '');
  const [quantity, setQuantity] = useState(1);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [reserveBusy, setReserveBusy] = useState(false);
  const reservationRequest = useRef<{ key: string; quantity: number; productId: number } | undefined>(undefined);
  const pageRef = useRef<HTMLDivElement>(null);
  const checkoutRef = useRef<HTMLDivElement>(null);
  const [detailTab, setDetailTab] = useState('specs');
  const [addedUnit, setAddedUnit] = useState<number | null>(null);
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
        setSize(result?.availableSizes[0] || '');
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

  useEffect(() => setAddedUnit(null), [unitId, quantity, size]);
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>('.mu-mobile-nav');
    const checkout = checkoutRef.current;
    const measure = () => {
      pageRef.current?.style.setProperty('--compact-nav-h', `${nav?.offsetHeight || 80}px`);
      pageRef.current?.style.setProperty('--compact-checkout-h', `${checkout?.offsetHeight || 150}px`);
    };
    const observer = new ResizeObserver(measure);
    if (nav) observer.observe(nav);
    if (checkout) observer.observe(checkout);
    measure();
    return () => observer.disconnect();
  }, [product?.id]);

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
    if (chosen && (chosen.condition !== 'new' || chosen.defects.length || chosen.missingAccessories.length))
      setDetailTab('condition');
    const url = new URL(window.location.href);
    if (chosen && !chosen.isMain) url.searchParams.set(CONDITION_PARAM, String(id));
    else url.searchParams.delete(CONDITION_PARAM);
    window.history.replaceState(window.history.state, '', url);
  };

  const wishlistItem = wishlist.find((item) => item.productId === unit?.id && item.size === size);

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
      const added = await WishlistApi.addItem(unit.id, size);
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
    if (addItem({ ...offer, name: product.name, brandName: product.brandName }, size, quantity)) {
      trackAddToCart({ id: String(unit.id), name: product.name, price: unit.salePrice, quantity });
      setAddedUnit(unit.id);
    }
  };

  return (
    <div className="studio-product-detail compact-product-page" ref={pageRef}>
      <nav aria-label={ux('breadcrumb')} className="product-breadcrumb">
        <Link href="/cua-hang">{t('title')}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>
      <div className="product-detail-layout compact-product-workspace">
        <div className="product-detail-media">
          <ProductGallery images={[unit.imageUrl, ...unit.images]} alt={`${product.name} · ${t(unit.condition)}`} />
        </div>
        <div className="product-detail-offer compact-product-console">
          <header className="compact-product-heading">
            <div className="compact-product-identity">
              <p className="product-detail-brand">
                {product.brandName} <span> / {product.scale || product.modelCode || 'MODEL UNIVERSE'}</span>
              </p>
              {product.partnerId && (
                <Link className="compact-seller-link" href={`/sellers/${product.partnerId}`}>
                  {seller('view')} ↗
                </Link>
              )}
            </div>
            <h1 title={product.name}>{product.name}</h1>
            <button type="button" className="compact-review-link" onClick={() => setDetailTab('reviews')}>
              {product.reviewCount > 0 ? (
                <>
                  <RatingStars rating={product.rating} />
                  <span>{t('reviewCount', { count: product.reviewCount })}</span>
                </>
              ) : (
                t('noReviews')
              )}
            </button>
          </header>
          <div className="compact-product-selection">
            <OfferPanel product={offer} section="price" />
            <ConditionPicker units={units} selected={unit} onSelect={chooseUnit} />
            {(unit.condition !== 'new' || unit.defects.length > 0 || unit.missingAccessories.length > 0) && (
              <button type="button" className="compact-condition-notice" onClick={() => setDetailTab('condition')}>
                <AdminIcon name="shield" size={16} />
                <span>
                  {t(unit.condition)} · {t('defects')}: {unit.defects.length} · {t('missingAccessories')}:{' '}
                  {unit.missingAccessories.length}
                </span>
                <span aria-hidden="true">↗</span>
              </button>
            )}
          </div>
          <WorkspaceTabs
            className="product-information-tabs"
            label={ux('productInformation')}
            value={detailTab}
            onChange={setDetailTab}
            tabs={[
              {
                id: 'specs',
                label: ux('specificationsTab'),
                content: (
                  <>
                    {' '}
                    <dl className="product-specifications grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <InfoItem label={t('brand')} value={product.brandName} />
                      <InfoItem label={t('modelCode')} value={product.modelCode || '—'} />
                      <InfoItem label={t('scale')} value={product.scale || '—'} />
                      <InfoItem label={t('condition')} value={t(unit.condition)} />
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
                  </>
                ),
              },
              {
                id: 'condition',
                label: t('condition'),
                content: (
                  <>
                    <p className="compact-condition-description">{t(`conditionDescriptions.${unit.condition}`)}</p>
                    {unit.conditionNote && <p className="compact-condition-note">{unit.conditionNote}</p>}{' '}
                    <div className="rounded-lg border border-stroke p-5">
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
                  </>
                ),
              },
              {
                id: 'description',
                label: ux('descriptionTab'),
                content: (
                  <>
                    <section className="product-story">
                      <h2>{ux('aboutProduct')}</h2>
                      <p className="whitespace-pre-line">
                        {(locale === 'vi' ? product.descriptionVi : product.descriptionEn) ||
                          product.description ||
                          ux('descriptionPending')}
                      </p>
                    </section>{' '}
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
                  </>
                ),
              },
              {
                id: 'offers',
                label: ux('offersTab'),
                content: (
                  <>
                    <OfferPanel product={offer} section="benefits" />
                    {product.partnerId && <Link href={`/sellers/${product.partnerId}`}>{seller('view')} →</Link>}
                  </>
                ),
              },
              {
                id: 'reviews',
                label: t('reviews'),
                count: product.reviewCount,
                content: (
                  <>
                    {' '}
                    <ProductReviews
                      productId={product.id}
                      rating={product.rating}
                      reviewCount={product.reviewCount}
                      distribution={product.ratingDistribution}
                      onReviewSubmitted={() => loadProduct(false)}
                    />
                  </>
                ),
              },
            ]}
          />
          <div className="compact-product-checkout" ref={checkoutRef}>
            {product.availableSizes.length > 0 && (
              <div>
                <label htmlFor="product-size" className="mb-2 block font-medium">
                  {t('legacySize')}
                </label>
                <select
                  id="product-size"
                  value={size}
                  onChange={(event) => setSize(event.target.value)}
                  className="w-40 rounded border-[1.5px] border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-brand-hover dark:border-store-card dark:bg-store-panel"
                >
                  {product.availableSizes.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div
              className="product-purchase"
              id="product-purchase"
              role="group"
              aria-label={ux('purchaseActions')}
              tabIndex={-1}
            >
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

              <div className="product-purchase-actions flex flex-wrap gap-3">
                <button
                  disabled={!inStock}
                  onClick={addToCart}
                  className="flex-1 rounded-md bg-brand px-6 py-3 font-semibold text-brand-ink hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {inStock ? t('addToCart') : t('soldOut')}
                </button>
                <button
                  onClick={toggleWishlist}
                  disabled={wishlistBusy}
                  className="rounded-md bg-gray px-6 py-3 font-semibold text-black hover:opacity-90 disabled:opacity-60 dark:bg-store-card dark:text-store-text"
                >
                  {wishlistItem ? t('unsave') : t('save')}
                </button>
              </div>
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
            </div>
            {!inStock && <RestockAlert key={unit.id} productId={unit.id} />}
            <div className="compact-secondary-actions">
              {' '}
              <button
                onClick={() => agent.open(t('assistantPrompt', { id: product.id, name: product.name }))}
                className="flex items-center justify-between gap-3 rounded-xl border border-brand-hover/25 bg-brand/10 px-4 py-4 text-left hover:bg-brand/20"
              >
                <span>
                  <strong className="block text-sm">✦ {t('askAssistant')}</strong>
                  <span className="mt-1 block text-xs text-body dark:text-store-muted">{t('assistantNote')}</span>
                </span>
                <span aria-hidden="true">↗</span>
              </button>{' '}
              {product.modelCode && !product.partnerId && (
                <button
                  disabled={!inStock || reserveBusy}
                  className="mu-button mu-button-secondary w-full disabled:opacity-50"
                  onClick={async () => {
                    if (!user) {
                      router.push(`/auth/signin?redirect=${encodeURIComponent(unitPath)}`);
                      return;
                    }
                    if (
                      reservationRequest.current?.quantity !== quantity ||
                      reservationRequest.current?.productId !== unit.id
                    )
                      reservationRequest.current = { key: crypto.randomUUID(), quantity, productId: unit.id };
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
        </div>
      </div>
    </div>
  );
};

// A native picker keeps every unit's condition, price, stock and SKU reachable without a tall option grid.
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
  const locale = useLocale();
  return (
    <div className="compact-condition-picker">
      {units.length > 1 ? (
        <>
          <label htmlFor="product-condition">{t('chooseCondition')}</label>
          <select id="product-condition" value={selected.id} onChange={(event) => onSelect(Number(event.target.value))}>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {t(unit.condition)} · {formatVND(unit.salePrice, locale)} ·{' '}
                {unit.stock > 0 ? t('conditionStock', { count: unit.stock }) : t('conditionSoldOut')} · {unit.sku}
              </option>
            ))}
          </select>
        </>
      ) : (
        <>
          <span className={`condition-chip is-${selected.condition}`}>{t(selected.condition)}</span>
          <span>{selected.stock > 0 ? t('availableCount', { count: selected.stock }) : t('soldOut')}</span>
        </>
      )}
    </div>
  );
};

export default ProductDetail;
