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

// The price the customer pays first and largest, as a deal (owner requests of 2026-10-26): a small label (member price
// or sale), the price paid in red with a solid saving pill, then the struck list price. On the detail page the deal
// sits in a tinted panel with the amount saved. The member price S is the web price R less the 10% member code; a
// partner's listing shows its own price only.
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
  const deal = discounted || member;
  const paid = discounted ? (salePrice as number) : member ? memberPrice(price) : price;
  const pay = split(formatVND(paid, locale));
  const percent = discounted ? Math.round(discountPercent) : 10;
  return (
    <span
      className={`price-tag is-${size}${discounted ? ' is-sale' : ''}${member ? ' is-member' : ''}${deal ? ' is-deal' : ''} ${className}`}
      title={
        member
          ? en
            ? 'Member price: 10% off with the free member code (MEMBER10)'
            : 'Giá thành viên: giảm 10% với mã thành viên MEMBER10, miễn phí cho thành viên'
          : undefined
      }
    >
      {deal && (
        <span className="price-tag-label">
          {member ? (en ? 'Member price' : 'Giá thành viên') : en ? 'Sale price' : 'Giá ưu đãi'}
        </span>
      )}
      <span className="price-tag-row">
        <span className="price-tag-now">
          {pay.amount}
          <small>{pay.currency}</small>
        </span>
        {deal && (member || showDiscountBadge) && <span className="price-tag-off">-{percent}%</span>}
      </span>
      {deal && (
        <span className="price-tag-list">
          <small>{en ? 'List' : 'Giá gốc'}</small>
          <s className="price-tag-was">{formatVND(price, locale)}</s>
          {size === 'detail' && (
            <span className="price-tag-save">
              {en ? 'Save' : 'Tiết kiệm'} {formatVND(price - paid, locale)}
            </span>
          )}
        </span>
      )}
    </span>
  );
};

export default PriceTag;
