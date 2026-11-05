import type { Metadata } from 'next';
import StoreLayout from '@/components/Layouts/StoreLayout';
import BuybackWorkspace from '@/core/client/features/buyback/BuybackWorkspace';
import { siteUrl } from '@/shared/server/utils/SiteUrl';
import { breadcrumbSchema, isEnglish, jsonLd, pageMetadata, serviceSchema } from '@/shared/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const en = isEnglish(locale);
  return pageMetadata(siteUrl(), {
    locale,
    path: '/services/sell',
    title: en ? 'Sell Your Model Kits – Gunpla and Mecha Buyback' : 'Thu Mua Mô Hình Gundam, Gunpla, Mecha Giá Tốt – TP.HCM',
    description: en
      ? 'We buy model kits: Gundam, Gunpla, mecha and Chinese kits, new or pre-owned, built or without the box. Quote from photos, fast payment. Ho Chi Minh City, kits accepted from all of Vietnam.'
      : 'Thu mua mô hình lắp ráp Gundam, Gunpla, Mecha, kit Trung Quốc (Motor Nuclear, CangDao…) New & 2hand, kể cả đã ráp, thiếu hộp. Báo giá nhanh qua ảnh, thanh toán ngay. Gò Vấp, TP.HCM, nhận hàng toàn quốc.',
    keywords: en ? undefined : ['thu mua mô hình', 'thu mua gundam', 'thu mua gunpla cũ', 'thu mua mô hình cũ', 'thu mua mô hình lắp ráp', 'thanh lý mô hình', 'thu mua motor nuclear'],
  });
}

export default async function SellModelsPage({ params }: Props) {
  const { locale } = await params;
  const en = isEnglish(locale);
  const base = siteUrl();

  return (
    <StoreLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            serviceSchema(base, locale, {
              path: '/services/sell',
              name: en ? 'Model kit buyback: Gundam, Gunpla, mecha and Chinese kits' : 'Thu mua mô hình Gundam, Gunpla, Mecha, kit Trung Quốc',
              serviceType: 'Model kit buyback',
              description: en
                ? 'Buyback of new and pre-owned model kits, including built, part-built, boxless or incomplete kits. Quotes from photos, paid by bank transfer or cash.'
                : 'Thu mua mô hình lắp ráp New và 2hand, kể cả đã ráp, ráp dở, thiếu hộp hoặc thiếu phụ kiện. Báo giá qua ảnh, thanh toán chuyển khoản hoặc tiền mặt.',
            }),
            breadcrumbSchema(base, locale, [
              [en ? 'Services' : 'Dịch vụ', '/services'],
              [en ? 'Sell your kits' : 'Thu mua mô hình', '/services/sell'],
            ]),
          ]),
        }}
      />
      <BuybackWorkspace />
    </StoreLayout>
  );
}
