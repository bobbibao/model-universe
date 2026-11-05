import type { NewAd } from '../../../src/core/server/services/marketing/platforms';

// An ad as the web asks a platform to create it (MarketingActions.newAdOf builds it from the approved body).
export const sampleAd = (overrides: Partial<NewAd> = {}): NewAd => ({
  ref: 'ad-meta-1',
  name: 'ag-ads00001-opt1 ad-meta-1',
  objective: 'traffic',
  dailyBudgetVnd: 200000,
  startsAt: new Date(Date.now() + 3600_000),
  endsAt: new Date(Date.now() + 5 * 24 * 3600_000),
  landingUrl: 'https://shop.example.vn/products?utm_source=facebook&utm_medium=cpc&utm_campaign=ag-ads00001-opt1',
  creative: {
    headline: 'Gunpla mới về',
    primary_text: 'Khớp chắc, dễ ráp.',
    headlines: ['Gunpla mới về', 'Khớp chắc, dễ ráp', 'Giao hàng nhanh'],
    descriptions: ['Nhiều mẫu Gunpla mới về.', 'Đổi trả trong 7 ngày.'],
    keywords: ['gunpla', 'mô hình lắp ráp'],
    ad_text: 'Gunpla mới về',
    imageUrl: 'https://shop.example.vn/uploads/shoe.jpg',
    videoUrl: 'https://shop.example.vn/uploads/shoe.mp4',
  },
  ...overrides,
});
