'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { memberPrice } from '@/shared/pricing';
import { formatVND } from '@/shared/server/utils/utils';

interface PriceTagProps {
  price: number;
  salePrice?: number;
  discountPercent?: number;
  className?: string;
  showMemberPrice?: boolean;
  showDiscountBadge?: boolean;
  size?: 'card' | 'detail';
}

// "1.880.000 ₫" → { amount: "1.880.000", currency: "₫" }, so the currency can be set smaller like marketplace prices.
const split = (value: string) => {
  const match = value.match(/^(.*?)\s*(₫|VND|đ)$/u);
  return match ? { amount: match[1], currency: '₫' } : { amount: value, currency: '' };
};

// Counts down to `endsAt` every second (hh:mm:ss, with days when longer); null once it has passed.
// 1234 → "1,2k" (vi) / "1.2k" (en): sold counts as marketplaces print them.
export const compactCount = (value: number, locale: string) =>
  value < 1000
    ? String(value)
    : `${(Math.floor(value / 100) / 10).toLocaleString(locale === 'en' ? 'en-GB' : 'vi-VN')}k`;

export function useCountdown(endsAt?: string | Date | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [endsAt]);
  if (!endsAt) return null;
  const left = new Date(endsAt).getTime() - now;
  if (left <= 0) return null;
  const days = Math.floor(left / 86_400_000);
  const pad = (value: number) => String(value).padStart(2, '0');
  const clock = `${pad(Math.floor((left % 86_400_000) / 3_600_000))}:${pad(Math.floor((left % 3_600_000) / 60_000))}:${pad(Math.floor((left % 60_000) / 1000))}`;
  return { days, clock, left };
}

// The price the customer pays first and largest. During a sale: the sale price in red with the struck web price and
// the saving. Otherwise, for a shop product (`showMemberPrice`): the member price S (the web price R less the 10% member
// code, owner rule of 2026-10-26) large, labelled as the member price, above the struck web price R; a partner's
// listing shows its own price only.
const PriceTag = ({
  price,
  salePrice,
  discountPercent = 0,
  className = '',
  showMemberPrice = false,
  showDiscountBadge = true,
  size = 'card',
}: PriceTagProps) => {
  const locale = useLocale();
  const en = locale === 'en';
  const discounted = discountPercent > 0 && salePrice !== undefined && salePrice < price;
  const member = showMemberPrice && !discounted;
  const pay = split(formatVND(discounted ? (salePrice as number) : member ? memberPrice(price) : price, locale));
  return (
    <span className={`price-tag is-${size}${discounted ? ' is-sale' : ''}${member ? ' is-member' : ''} ${className}`}>
      <span className="price-tag-row">
        <span className="price-tag-now">
          {pay.amount}
          <small>{pay.currency}</small>
        </span>
        {discounted && showDiscountBadge && <span className="price-tag-off">-{Math.round(discountPercent)}%</span>}
        {member && (
          <span
            className="price-tag-member-badge"
            title={
              en
                ? 'With the 10% member code (MEMBER10), free for signed-in members'
                : 'Khi dùng mã thành viên MEMBER10 (giảm 10%), miễn phí cho thành viên đã đăng nhập'
            }
          >
            {size === 'detail' ? (en ? 'Member price' : 'Giá thành viên') : en ? 'Member' : 'Thành viên'}
          </span>
        )}
      </span>
      {(discounted || member) && (
        <span className="price-tag-list">
          {member && size === 'detail' && <small>{en ? 'List price' : 'Giá niêm yết'}</small>}
          <s className="price-tag-was" aria-label={en ? 'List price' : 'Giá niêm yết'}>
            {formatVND(price, locale)}
          </s>
        </span>
      )}
    </span>
  );
};

export default PriceTag;
