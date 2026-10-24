'use client';

import '@/core/client/features/sales/sales.css';
import Link from '@/i18n/navigation';
import ProductStage from '@/components/ProductStage';
import PriceTag, { compactCount, useCountdown } from '@/components/PriceTag';
import type { ProductSummary } from '@/shared/types/product';
import { productPath } from '@/shared/slug';
import { FREESHIP_TIERS } from '@/shared/promotions';
import RatingStars from './RatingStars';
import PromoIcon from '@/components/PromoIcon';
import { useLocale, useTranslations } from 'next-intl';
import { formatVND } from '@/shared/server/utils/utils';

// A product tile: the photo with at most one offer badge (the sale percentage) and a quiet free-shipping tag, then the
// name, the conditions it is offered in, the price the customer pays and the member price, and a countdown when a sale
// ends within three days. A model sold out new but in stock in another condition shows that condition's lowest price.
const ProductCard = ({ product }: { product: ProductSummary }) => {
  const t = useTranslations('catalog');
  const locale = useLocale();
  const en = locale === 'en';
  const conditions = product.conditions ?? [
    { condition: product.condition ?? 'new', units: 1, stock: product.stock, minSalePrice: product.salePrice },
  ];
  const groupStock = product.groupStock ?? product.stock;
  const shown = conditions.some((summary) => summary.stock > 0)
    ? conditions.filter((summary) => summary.stock > 0)
    : conditions;
  const otherConditionOnly = product.stock <= 0 && groupStock > 0;
  const fromPrice = otherConditionOnly ? Math.min(...shown.map((summary) => summary.minSalePrice)) : null;
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
  return (
    <div className="mu-product product-tile group flex flex-col">
      <Link href={href} className="mu-product-photo overflow-hidden">
        <ProductStage
          src={product.imageUrl}
          alt={product.name}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 100vw"
          className="studio-card-stage"
        />
        {product.stock > 0 && onSale && (
          <span className="tile-ribbon">
            <small>{product.managedSale ? 'SALE' : en ? 'SAVE' : 'GIẢM'}</small>-{product.discountPercent}%
          </span>
        )}
        {product.stock > 0 && freeship && (
          <span className="tile-freeship">
            <PromoIcon name="truck" size={14} />
            {en ? 'Free shipping' : 'Freeship'}
          </span>
        )}
        {groupStock <= 0 && <span className="tile-soldout">{t('soldOut')}</span>}
        {product.salesChannel === 'outlet' && <span className="tile-outlet">Outlet</span>}
      </Link>
      <div className="product-tile-body">
        <div className="product-tile-tags">
          {product.scale && <span>{product.scale}</span>}
          {shown.map((summary) => (
            <span key={summary.condition} className={`condition-chip is-${summary.condition}`}>
              {t(summary.condition)}
            </span>
          ))}
        </div>
        <Link href={href} className="product-tile-name">
          {product.name}
        </Link>
        <p className="product-tile-brand">
          {product.brandName}
          {product.reviewCount > 0 && (
            <span>
              <RatingStars rating={product.rating} size="sm" />({product.reviewCount})
            </span>
          )}
        </p>
        <div className="mt-auto">
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
              showMemberPrice={shopOwned && !onSale}
            />
          )}
          {(sold > 0 || scarce) && (
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
          )}
          {soon && (
            <p className="tile-countdown">
              <PromoIcon name="clock" size={13} /> {en ? 'Ends in' : 'Kết thúc sau'}{' '}
              <strong>
                {countdown.days > 0 ? `${countdown.days}${en ? 'd' : ' ngày'} ` : ''}
                {countdown.clock}
              </strong>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
