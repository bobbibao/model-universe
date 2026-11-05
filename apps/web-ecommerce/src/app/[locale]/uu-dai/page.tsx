import type { Metadata } from 'next';
import StoreLayout from '@/components/Layouts/StoreLayout';
import SaleShelf from '@/core/client/features/sales/SaleShelf';
import PromotionsHub from '@/core/client/features/promotions/PromotionsHub';
import { siteUrl } from '@/shared/server/utils/SiteUrl';
import { breadcrumbSchema, isEnglish, jsonLd, pageMetadata } from '@/shared/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const en = isEnglish(locale);
  return pageMetadata(siteUrl(), {
    locale,
    path: '/uu-dai',
    title: en ? 'Model Kit Deals: Vouchers, Shipping Offers and Flash Sales' : 'Ưu Đãi Mô Hình Lắp Ráp: Voucher, Freeship, Flash Sale',
    description: en
      ? 'Vouchers, shipping offers, flash sales and daily check-in rewards on new and pre-owned Gunpla, mecha and Chinese model kits at Model Universe.'
      : 'Tổng hợp voucher, mã freeship, flash sale và quà điểm danh khi mua mô hình Gunpla, Mecha, kit Trung Quốc New & 2hand tại Model Universe.',
    keywords: en ? undefined : ['ưu đãi mô hình', 'voucher mô hình', 'sale gundam', 'flash sale mô hình', 'mô hình giá rẻ'],
  });
}

export default async function PromotionsPage({ params }: Props) {
  const { locale } = await params;
  const en = isEnglish(locale);
  const base = siteUrl();

  return (
    <StoreLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            breadcrumbSchema(base, locale, [
              [en ? 'Deals' : 'Ưu đãi', '/uu-dai'],
            ]),
          ]),
        }}
      />
      <PromotionsHub />
      <div id="sale">
        <SaleShelf full />
      </div>
    </StoreLayout>
  );
}
