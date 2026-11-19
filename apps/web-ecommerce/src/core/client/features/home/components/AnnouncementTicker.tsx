'use client';

import { useLocale } from 'next-intl';
import PromoIcon, { type PromoIconName } from '@/components/PromoIcon';
import { formatVND } from '@/shared/server/utils/utils';
import { FREESHIP_TIERS } from '@/shared/promotions';

// A slim, still strip of the shop's standing promises at the top of the home page. Every line is a real, current
// policy: the free-shipping tier, points, member tiers, real photos, visiting the shop. Phones show the first two.
export default function AnnouncementTicker() {
  const locale = useLocale();
  const en = locale === 'en';
  const top = FREESHIP_TIERS[FREESHIP_TIERS.length - 1];
  const items: [PromoIconName, string][] = [
    [
      'truck',
      en
        ? `Free shipping up to ${formatVND(top.maxShippingVnd, locale)} on orders from ${formatVND(top.minOrderVnd, locale)}`
        : `Freeship tới ${formatVND(top.maxShippingVnd, locale)} cho đơn từ ${formatVND(top.minOrderVnd, locale)}`,
    ],
    [
      'coin',
      en
        ? `1 point for every ${formatVND(40_000, locale)} spent, traded for vouchers`
        : `Tích 1 điểm mỗi ${formatVND(40_000, locale)}, đổi điểm lấy voucher`,
    ],
    [
      'crown',
      en ? 'Member tiers take up to 2% more off an eligible voucher' : 'Hạng thành viên giảm thêm tới 2% cùng một mã đủ điều kiện',
    ],
    ['package', en ? 'Real photos of the exact model you receive' : 'Ảnh chụp thực tế đúng mô hình bạn nhận'],
    ['user', en ? 'Visit the showroom or call 0373 725 104' : 'Xem hàng tại shop · Hotline 0373 725 104'],
  ];
  return (
    <div className="home-facts" aria-label={en ? 'Shop promises' : 'Cam kết của shop'}>
      <ul className="mu-wrap">
        {items.map(([icon, text]) => (
          <li key={text}>
            <PromoIcon name={icon} size={16} />
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}
