import type { Metadata } from 'next';
import { Suspense } from 'react';
import StoreLayout from '@/components/Layouts/StoreLayout';
import Shop from '@/core/client/features/shop/pages/Shop';
import { siteUrl } from '@/shared/server/utils/SiteUrl';
import { breadcrumbSchema, isEnglish, jsonLd, organizationId, pageMetadata, websiteId } from '@/shared/seo';

type Props = { params: Promise<{ locale: string }> };

// The catalog at its SEO path (/vi/cua-hang); /shop redirects here.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const en = isEnglish(locale);
  return pageMetadata(siteUrl(), {
    locale,
    path: '/cua-hang',
    title: en ? 'Shop Model Kits: Gunpla, Mecha and Chinese Kits' : 'Cửa Hàng Mô Hình Lắp Ráp: Gunpla, Mecha, Kit Trung Quốc',
    description: en
      ? 'Shop new and pre-owned model kits: Gunpla, Gundam, mecha, robot and Chinese kits such as Motor Nuclear and CangDao. Clear condition notes, fair prices, cash on delivery across Vietnam.'
      : 'Mua mô hình lắp ráp Gunpla, Gundam, Mecha, Robot và kit Trung Quốc (Motor Nuclear, CangDao…) New & 2hand. Tình trạng ghi rõ từng món, giá minh bạch, ship COD toàn quốc từ Gò Vấp, TP.HCM.',
    keywords: en ? undefined : ['mô hình lắp ráp', 'cửa hàng mô hình', 'shop gundam', 'gunpla 2hand', 'mô hình mecha', 'mô hình robot', 'mô hình lắp ráp trung quốc', 'motor nuclear', 'cangdao'],
  });
}

export default async function ShopPage({ params }: Props) {
  const { locale } = await params;
  const en = isEnglish(locale);
  const base = siteUrl();

  return (
    <StoreLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            {
              '@context': 'https://schema.org',
              '@type': 'CollectionPage',
              name: en ? 'Model kits at Model Universe' : 'Mô hình lắp ráp tại Model Universe',
              url: `${base}/${locale}/cua-hang`,
              isPartOf: { '@id': websiteId(base) },
              provider: { '@id': organizationId(base) },
            },
            breadcrumbSchema(base, locale, [
              [en ? 'Store' : 'Cửa hàng', '/cua-hang'],
            ]),
          ]),
        }}
      />
      <Suspense>
        <Shop />
      </Suspense>
    </StoreLayout>
  );
}
