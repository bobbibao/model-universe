import type { Metadata } from 'next';
import StoreLayout from '@/components/Layouts/StoreLayout';
import PawnWorkspace from '@/core/client/features/pawn/PawnWorkspace';
import { siteUrl } from '@/shared/server/utils/SiteUrl';
import { breadcrumbSchema, isEnglish, jsonLd, pageMetadata, serviceSchema } from '@/shared/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const en = isEnglish(locale);
  return pageMetadata(siteUrl(), {
    locale,
    path: '/services/pawn',
    title: en ? 'Pawn Loans on Model Kits – Gunpla and Mecha' : 'Cầm Mô Hình Gundam, Gunpla, Mecha – Cầm Cố Uy Tín Gò Vấp',
    description: en
      ? 'Pawn loans on Gundam, Gunpla, mecha and Chinese model kits at Model Universe, Go Vap, Ho Chi Minh City: quick valuation, a clear written contract, dry-cabinet storage, redeem within the term.'
      : 'Cầm cố mô hình Gundam, Gunpla, Mecha, kit Trung Quốc theo thỏa thuận tại Model Universe, Gò Vấp, TP.HCM: định giá nhanh, hợp đồng rõ ràng, bảo quản tủ chống ẩm, chuộc lại trong thời hạn hợp đồng.',
    keywords: en ? undefined : ['cầm mô hình', 'cầm đồ mô hình', 'cầm gundam', 'cầm cố mô hình', 'cầm figure', 'cầm mô hình gò vấp'],
  });
}

export default async function PawnModelsPage({ params }: Props) {
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
              path: '/services/pawn',
              name: en ? 'Pawn loans on model kits' : 'Cầm cố mô hình',
              serviceType: 'Pawn loan on collectibles',
              description: en
                ? 'Pawn loans on Gundam, Gunpla, mecha and Chinese kits by agreement: valuation, a written contract, dry-cabinet storage and redemption within the term.'
                : 'Cầm cố mô hình Gundam, Gunpla, Mecha, kit Trung Quốc theo thỏa thuận: định giá, hợp đồng rõ ràng, bảo quản tủ chống ẩm và chuộc lại trong thời hạn.',
            }),
            breadcrumbSchema(base, locale, [
              [en ? 'Services' : 'Dịch vụ', '/services'],
              [en ? 'Pawn loans' : 'Cầm cố mô hình', '/services/pawn'],
            ]),
          ]),
        }}
      />
      <PawnWorkspace />
    </StoreLayout>
  );
}
