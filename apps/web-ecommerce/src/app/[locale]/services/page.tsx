import type { Metadata } from 'next';
import StoreLayout from '@/components/Layouts/StoreLayout';
import CollectorServices from '@/core/client/features/content/pages/CollectorServices';
import { FAQ_LIST } from '@/components/Services/serviceFaqItems';
import { siteUrl } from '@/shared/server/utils/SiteUrl';
import { breadcrumbSchema, faqSchema, isEnglish, jsonLd, pageMetadata, serviceSchema } from '@/shared/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const en = isEnglish(locale);
  return pageMetadata(siteUrl(), {
    locale,
    path: '/services',
    title: en ? 'Model Kit Services: Buyback, Trade, Pawn and Assembly' : 'Dịch Vụ Mô Hình: Thu Mua, Trade, Cầm Cố, Lắp Ráp',
    description: en
      ? 'Model kit services at Model Universe, Ho Chi Minh City: buyback of Gunpla, mecha and Chinese kits, trades, pawn loans, holds and assembly help. Quick quotes on Zalo.'
      : 'Dịch vụ mô hình tại Model Universe (Gò Vấp, TP.HCM): thu mua mô hình Gunpla, Mecha, kit Trung Quốc, trade đổi mô hình, cầm cố theo thỏa thuận, giữ hàng và hỗ trợ lắp ráp. Báo giá nhanh qua Zalo.',
    keywords: en ? undefined : ['dịch vụ mô hình', 'thu mua mô hình', 'trade mô hình', 'cầm mô hình', 'lắp ráp mô hình thuê', 'giữ hàng mô hình'],
  });
}

export default async function ServicesPage({ params }: Props) {
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
              path: '/services',
              name: en ? 'Model kit services: buyback, trade, pawn and assembly' : 'Dịch vụ mô hình: thu mua, trade, cầm cố, lắp ráp',
              serviceType: 'Model kit services',
              description: en
                ? 'Buyback, trades, pawn loans, holds and assembly help for Gunpla, mecha and Chinese model kits in Ho Chi Minh City and across Vietnam.'
                : 'Thu mua, trade, cầm cố, giữ hàng và hỗ trợ lắp ráp mô hình Gunpla, Mecha, kit Trung Quốc tại Gò Vấp, TP.HCM và toàn quốc.',
            }),
            faqSchema(FAQ_LIST),
            breadcrumbSchema(base, locale, [
              [en ? 'Services' : 'Dịch vụ', '/services'],
            ]),
          ]),
        }}
      />
      <CollectorServices />
    </StoreLayout>
  );
}
