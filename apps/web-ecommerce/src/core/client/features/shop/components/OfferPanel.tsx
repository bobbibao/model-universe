'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import PriceTag, { compactCount, useCountdown } from '@/components/PriceTag';
import PromoIcon, { type PromoIconName } from '@/components/PromoIcon';
import { formatVND } from '@/shared/server/utils/utils';
import { memberPrice } from '@/shared/pricing';
import { FREESHIP_TIERS, earnedPoints } from '@/shared/promotions';
import type { ProductDetail } from '@/shared/types/product';

// The price block of a product page: a sale bar with its countdown, the price the customer pays, and a short list of
// the offers that apply to this product (member price, free shipping, points), each one line with an icon so the
// customer can scan it, plus a link to collect more vouchers.
export default function OfferPanel({ product }: { product: ProductDetail }) {
  const locale = useLocale();
  const ux = useTranslations('commerceUX');
  const en = locale === 'en';
  const money = (value: number) => formatVND(value, locale);
  const shopOwned = !product.partnerId;
  const onSale = product.discountPercent > 0 && product.salePrice < product.price;
  const pays = onSale ? product.salePrice : product.price;
  const countdown = useCountdown(onSale ? product.discountEndsAt : null);
  const freeship = shopOwned ? [...FREESHIP_TIERS].reverse().find((tier) => pays >= tier.minOrderVnd) : undefined;
  const nextFreeship = shopOwned ? FREESHIP_TIERS.find((tier) => pays < tier.minOrderVnd) : undefined;
  // Member and voucher codes apply to an approved real list price only; a product sold at its target price S has none.
  const memberOffer = shopOwned && !onSale;
  const points = shopOwned ? earnedPoints(memberOffer ? memberPrice(pays) : pays) : 0;
  const offers: { icon: PromoIconName; title: string; text: string }[] = shopOwned
    ? [
        ...(memberOffer
          ? [
              {
                icon: 'crown' as const,
                title: en
                  ? `Member price ${money(memberPrice(product.price))}`
                  : `Giá thành viên ${money(memberPrice(product.price))}`,
                text: en
                  ? 'Sign in: the 10% member code MEMBER10 is applied in your cart.'
                  : 'Đăng nhập: mã thành viên MEMBER10 (giảm 10%) tự áp dụng trong giỏ hàng.',
              },
            ]
          : []),
        freeship
          ? {
              icon: 'truck' as const,
              title: en
                ? `Free shipping up to ${money(freeship.maxShippingVnd)}`
                : `Miễn phí vận chuyển tới ${money(freeship.maxShippingVnd)}`,
              text: en
                ? `With the ${freeship.code} code on orders from ${money(freeship.minOrderVnd)}.`
                : `Dùng mã ${freeship.code} cho đơn từ ${money(freeship.minOrderVnd)}.`,
            }
          : {
              icon: 'truck' as const,
              title: en ? 'Free shipping available' : 'Có mã miễn phí vận chuyển',
              text: en
                ? `For orders from ${money(nextFreeship?.minOrderVnd ?? 0)}.`
                : `Cho đơn từ ${money(nextFreeship?.minOrderVnd ?? 0)}.`,
            },
        ...(points > 0
          ? [
              {
                icon: 'coin' as const,
                title: en ? `Earn ${points} points` : `Tích ${points} điểm`,
                text: en
                  ? 'Once the order is complete. Trade points for vouchers; higher tiers take up to 2% more off a voucher.'
                  : 'Khi đơn hoàn tất. Đổi điểm lấy voucher; hạng càng cao càng được giảm thêm (tới 2%) cùng một mã.',
              },
            ]
          : []),
      ]
    : [];
  return (
    <section className="offer-panel" aria-label={en ? 'Price and offers' : 'Giá và ưu đãi'}>
      {onSale && (
        <div className="offer-flash">
          <span className="offer-flash-title">
            <PromoIcon name="bolt" size={16} />
            {product.managedSale ? 'Flash Sale' : en ? 'On sale' : 'Đang giảm giá'}
          </span>
          {countdown && (
            <span className="offer-flash-clock">
              {en ? 'Ends in' : 'Kết thúc sau'}
              {countdown.days > 0 && (
                <b>
                  {countdown.days}
                  {en ? 'd' : ' ngày'}
                </b>
              )}
              {countdown.clock.split(':').map((part, index) => (
                <b key={index}>{part}</b>
              ))}
            </span>
          )}
        </div>
      )}
      <div className="offer-body">
        <PriceTag
          price={product.price}
          salePrice={product.salePrice}
          discountPercent={product.discountPercent}
          size="detail"
          showMemberPrice={shopOwned}
        />
        <p className="offer-proof">
          {product.sold > 0 && (
            <span>
              <PromoIcon name="bag" size={15} />
              {en ? `${compactCount(product.sold, 'en')} sold` : `Đã bán ${compactCount(product.sold, 'vi')}`}
            </span>
          )}
          <span className={product.stock > 0 && product.stock <= 3 ? 'is-scarce' : undefined}>
            {product.stock > 0 && product.stock <= 3 && <i aria-hidden="true" />}
            {product.stock <= 0
              ? (en ? 'Awaiting restock' : 'Chờ có hàng')
              : product.stock <= 3
                ? (en ? `Only ${product.stock} left in stock` : `Chỉ còn ${product.stock} sản phẩm`)
                : (en ? 'In stock' : 'Có sẵn hàng')}
          </span>
        </p>
        {onSale && (
          <p className="offer-saving">
            {en ? 'You save' : 'Tiết kiệm'} <strong>{money(product.price - product.salePrice)}</strong>
          </p>
        )}
      </div>
      {shopOwned ? (
        <details className="offer-benefits">
          <summary>
            {ux('availableOffers')}
            <span>
              {offers.length} <span aria-hidden="true">＋</span>
            </span>
          </summary>
          <ul className="offer-list">
            {offers.map((offer) => (
              <li key={offer.icon}>
                <span className="offer-list-icon">
                  <PromoIcon name={offer.icon} size={18} />
                </span>
                <span>
                  <strong>{offer.title}</strong>
                  <small>{offer.text}</small>
                </span>
              </li>
            ))}
          </ul>
          <Link href="/uu-dai" className="offer-more">
            <PromoIcon name="ticket" size={16} />
            {en ? 'Collect more vouchers' : 'Lấy thêm mã giảm giá'}
            <PromoIcon name="arrow" size={16} />
          </Link>
        </details>
      ) : (
        <p className="offer-note">
          {en ? 'Partner listing: shop vouchers do not apply.' : 'Sản phẩm của đối tác: không áp dụng mã của shop.'}
        </p>
      )}
    </section>
  );
}
