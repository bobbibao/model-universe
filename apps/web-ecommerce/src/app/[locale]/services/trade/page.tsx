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
    path: '/services/trade',
    title: en ? 'Trade Model Kits – Swap and Trade-in Gunpla and Mecha' : 'Trade Mô Hình – Trao Đổi, Thu Cũ Đổi Mới Gunpla & Mecha',
    description: en
      ? 'Trade your model kits at Model Universe: we value your Gunpla, mecha or Chinese kit and you top up the difference for the kit you want. Ho Chi Minh City and nationwide.'
      : 'Trade (trao đổi) mô hình lắp ráp Gunpla, Mecha, kit Trung Quốc tại Model Universe: định giá mô hình cũ của bạn, bù chênh lệch linh hoạt để lên đời bộ sưu tập. Gò Vấp, TP.HCM và toàn quốc.',
    keywords: en ? undefined : ['trade mô hình', 'trao đổi mô hình', 'đổi gundam', 'thu cũ đổi mới mô hình', 'trade gunpla', 'đổi mô hình cũ lấy mới'],
  });
}

export default async function TradeModelsPage({ params }: Props) {
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
              path: '/services/trade',
              name: en ? 'Model kit trade and trade-in' : 'Trade, trao đổi mô hình lắp ráp',
              serviceType: 'Model kit trade-in',
              description: en
                ? 'We value your kit and you top up the difference for another Gunpla, mecha or Chinese kit at Model Universe.'
                : 'Định giá mô hình cũ và bù chênh lệch để đổi lấy mô hình Gunpla, Mecha, kit Trung Quốc khác tại Model Universe.',
            }),
            breadcrumbSchema(base, locale, [
              [en ? 'Services' : 'Dịch vụ', '/services'],
              [en ? 'Trade' : 'Trade mô hình', '/services/trade'],
            ]),
          ]),
        }}
      />
      <BuybackWorkspace mode="trade" />
    </StoreLayout>
  );
}
