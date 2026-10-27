'use client';
import { useState } from 'react';
import { shortConditionLabel } from '@/shared/condition-selection';

import '@/core/client/features/sales/sales.css';
import Link from '@/i18n/navigation';
import ProductStage from '@/components/ProductStage';
import PriceTag, { compactCount, useCountdown } from '@/components/PriceTag';
import type { ProductSummary } from '@/shared/types/product';
import { productPath } from '@/shared/slug';
import { FREESHIP_TIERS } from '@/shared/promotions';
import RatingStars from './RatingStars';
import RestockAlert from './RestockAlert';
import PromoIcon from '@/components/PromoIcon';
import { useLocale, useTranslations } from 'next-intl';
import { formatVND } from '@/shared/server/utils/utils';
import { useCart } from '@/shared/client/providers/CartProvider';

const useSafeCart = () => {
  try {
    return useCart();
  } catch {
    return null;
  }
};

// A product tile: the photo with at most one offer badge (the sale percentage) and a quiet free-shipping tag, then the
// name, the scale, the price the customer pays and the member price, and a countdown when a sale
// ends within three days. A model sold out new but in stock in another condition shows that condition's lowest price.
const ProductCard = ({ product }: { product: ProductSummary }) => {
  const t = useTranslations('catalog');
  const ux = useTranslations('commerceUX');
  const locale = useLocale();
  const en = locale === 'en';
  const cart = useSafeCart();
  const [added, setAdded] = useState(false);

  const conditions = product.conditions ?? [
    { condition: product.condition ?? 'new', units: 1, stock: product.stock, minSalePrice: product.salePrice, conditionPercent: product.conditionPercent },
  ];
  const groupStock = product.groupStock ?? product.stock;
  const shown = conditions.some((summary) => summary.stock > 0)
    ? conditions.filter((summary) => summary.stock > 0)
    : conditions;
  const otherConditionOnly = product.stock <= 0 && groupStock > 0;
  const fromPrice = otherConditionOnly ? Math.min(...shown.map((summary) => summary.minSalePrice)) : null;
  // Match the badge to the listing whose price the card shows; detailed condition disclosure stays on the PDP.
  const activeCondition = otherConditionOnly
    ? shown.find((summary) => summary.minSalePrice === fromPrice)
    : undefined;
  const pricedCondition = otherConditionOnly
    ? activeCondition?.condition
    : (product.condition ?? conditions[0]?.condition);
  const isNew = (pricedCondition ?? 'new') === 'new';
  const conditionPercent = activeCondition?.conditionPercent ?? product.conditionPercent ?? conditions.find((c) => c.condition !== 'new')?.conditionPercent;
  const href = productPath(product);
  const shopOwned = !product.partnerId;
  const onSale = product.discountPercent > 0 && product.salePrice < product.price;
  const pays = onSale ? product.salePrice : product.price;
  const freeship = shopOwned ? [...FREESHIP_TIERS].reverse().find((tier) => pays >= tier.minOrderVnd) : undefined;
  const countdown = useCountdown(onSale ? product.discountEndsAt : null);
  const soon = countdown && countdown.left < 3 * 86_400_000;
  const sold = product.sold ?? 0;
  // Collectibles are often one or two units: say so while it is true (real stock, never invented).
  const scarce = groupStock > 0 && groupStock <= 3;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!cart) return;
    const success = cart.addItem(
      {
        id: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        price: product.price,
        salePrice: product.salePrice,
        brandName: product.brandName,
        stock: product.stock,
      },
      1,
    );
    if (success) {
      setAdded(true);
      setTimeout(() => setAdded(false), 1400);
    }
  };

  return (
    <div className={`mu-product product-tile group flex flex-col ${groupStock <= 0 ? 'is-out-of-stock is-soldout' : ''}`}>
      <Link href={href} className="mu-product-photo overflow-hidden">
        <ProductStage
          src={product.imageUrl}
          alt={product.name}
          sizes="(min-width: 1440px) 320px, (min-width: 1024px) 28vw, (min-width: 640px) 33vw, 50vw"
          className="studio-card-stage"
        />
        {groupStock <= 0 && (
          <div className="tile-soldout-wash" aria-hidden="true">
            <span className="tile-soldout-pill">{t('soldOut')}</span>
          </div>
        )}
        <div className="product-tile-badges">
          <div className="tile-condition-badges">
            <span className={`tile-condition ${isNew ? 'is-new' : 'is-preowned'}`}>{isNew ? t('new') : '2hand'}</span>
            {!isNew && conditionPercent != null && conditionPercent > 0 && (
              <span className="tile-condition-percent" title={en ? `Condition: ${conditionPercent}%` : `Độ mới: ${conditionPercent}%`}>
                {conditionPercent}%
              </span>
            )}
          </div>
          {groupStock <= 0 && <span className="tile-soldout">{t('soldOut')}</span>}
          {product.stock > 0 && onSale && <span className="tile-ribbon">-{product.discountPercent}%</span>}
        </div>
        {product.stock > 0 && freeship && (
          <span className="tile-freeship">
            <PromoIcon name="truck" size={14} />
            {en ? 'Free shipping' : 'Freeship'}
          </span>
        )}
      </Link>
      <div className="product-tile-body">
        <div className="product-tile-tags">
          {product.scale && <span>{product.scale}</span>}
          {product.salesChannel === 'outlet' && <span>Outlet</span>}
          {!isNew && conditionPercent != null && conditionPercent > 0 && (
            <span className="product-tile-condition-tag is-condition-percent" title={en ? `Condition: ${conditionPercent}%` : `Độ mới: ${conditionPercent}%`}>
              {en ? `${conditionPercent}% Condition` : `Độ mới ${conditionPercent}%`}
            </span>
          )}
          {(product.conditionLabels ?? []).slice(0, 1).map((label) => (
            <span key={label} className="product-tile-condition-tag" title={label}>
              {shortConditionLabel(label)}
            </span>
          ))}
          {(product.conditionLabels?.length ?? 0) > 1 && (
            <span className="product-tile-condition-tag" title={product.conditionLabels?.join(' · ')}>
              +{product.conditionLabels!.length - 1}
            </span>
          )}
        </div>
        <Link href={href} className="product-tile-name">
          {product.name}
        </Link>
        <p className="product-tile-brand">
          {product.brandName}
          {product.reviewCount > 0 && (
            <span className="product-tile-rating">
              <RatingStars rating={product.rating} size="sm" />({product.reviewCount})
            </span>
          )}
        </p>

        <div className="product-tile-pricing">
          <div className="product-tile-price">
            {fromPrice !== null ? (
              <div className="tile-from-price">
                <strong>{t('fromPrice', { price: formatVND(fromPrice, locale) })}</strong>
                <small>{t('otherConditionsInStock')}</small>
              </div>
            ) : (
              <PriceTag
                price={product.price}
                salePrice={product.salePrice}
                discountPercent={product.discountPercent}
                showDiscountBadge={false}
                showMemberPrice={shopOwned}
              />
            )}
          </div>
          <div className="product-tile-availability">
            {groupStock <= 0 ? (
              <p className="tile-meta">
                <span className="tile-stock-status is-empty">
                  <i className="status-dot is-empty" aria-hidden="true" />
                  {en ? 'Out of stock' : 'Tạm hết hàng'}
                </span>
              </p>
            ) : (sold > 0 || scarce) ? (
              <p className="tile-meta">
                {sold > 0 && (
                  <span>{en ? `${compactCount(sold, 'en')} sold` : `Đã bán ${compactCount(sold, 'vi')}`}</span>
                )}
                {scarce && (
                  <span className="tile-scarce">
                    <i aria-hidden="true" />
                    {en ? `Only ${groupStock} left` : `Chỉ còn ${groupStock}`}
                  </span>
                )}
              </p>
            ) : null}
            {soon && (
              <p className="tile-countdown">
                <PromoIcon name="clock" size={13} />
                <span className="tile-countdown-label">{en ? 'Ends in' : 'Kết thúc sau'}</span>
                <strong>
                  {countdown.days > 0 ? `${countdown.days}${en ? 'd' : ' ngày'} ` : ''}
                  {countdown.clock}
                </strong>
              </p>
            )}
          </div>
        </div>
        <div className="product-tile-footer">
          {groupStock <= 0 ? (
            <RestockAlert productId={product.id} returnTo={href} className="product-tile-alert-btn" />
          ) : otherConditionOnly ? (
            <Link
              href={href}
              className="product-tile-action product-tile-choose-btn"
              aria-label={ux('viewProduct', { name: product.name })}
            >
              <span className="product-tile-choose-text">{ux('chooseProduct')}</span>
              <span className="product-tile-detail-icon" aria-hidden="true">
                ↗
              </span>
            </Link>
          ) : (
            <button
              type="button"
              className={`product-tile-cart-btn ${added ? 'is-added' : ''}`}
              onClick={handleAddToCart}
              aria-label={added ? (en ? 'Added to bag' : 'Đã thêm vào giỏ') : (en ? 'Add to bag' : 'Thêm vào giỏ')}
            >
              <span className="product-tile-cart-icon" aria-hidden="true">
                {added ? (
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="9" cy="21" r="1" />
                    <circle cx="20" cy="21" r="1" />
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                  </svg>
                )}
              </span>
              <span className="product-tile-cart-text">
                {added ? (en ? 'Added!' : 'Đã thêm!') : (en ? 'Add to bag' : 'Thêm vào giỏ')}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
