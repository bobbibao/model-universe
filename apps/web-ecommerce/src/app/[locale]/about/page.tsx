import type { Metadata } from 'next';
import StoreLayout from '@/components/Layouts/StoreLayout';
import About from '@/core/client/features/content/pages/About';
import { siteUrl } from '@/shared/server/utils/SiteUrl';
import { breadcrumbSchema, isEnglish, jsonLd, organizationId, organizationSchema, pageMetadata } from '@/shared/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const en = isEnglish(locale);
  return pageMetadata(siteUrl(), {
    locale,
    path: '/about',
    title: en ? 'About Model Universe (Vũ Trụ Mô Hình) – Model Kit Shop' : 'Giới Thiệu Vũ Trụ Mô Hình – Shop Mô Hình Gò Vấp',
    description: en
      ? 'Model Universe (Vũ Trụ Mô Hình) is a model kit shop in Ho Chi Minh City: new and pre-owned Gunpla, mecha and Chinese kits, buyback, trades, pawn loans and assembly help.'
      : 'Vũ Trụ Mô Hình (Model Universe) – shop mô hình lắp ráp tại Gò Vấp, TP.HCM: mua bán Gunpla, Mecha, kit Trung Quốc New & 2hand, thu mua, trade, cầm cố và hỗ trợ lắp ráp. Kết nối đam mê – Mở rộng bộ sưu tập.',
    keywords: en ? undefined : ['vũ trụ mô hình', 'model universe là gì', 'giới thiệu model universe', 'shop mô hình uy tín', 'shop mô hình gò vấp'],
  });
}

export default async function AboutPage({ params }: Props) {
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
              '@type': 'AboutPage',
              name: en ? 'About Model Universe' : 'Giới thiệu Vũ Trụ Mô Hình – Model Universe',
              url: `${base}/${locale}/about`,
              about: { '@id': organizationId(base) },
            },
            organizationSchema(base, locale),
            breadcrumbSchema(base, locale, [
              [en ? 'About' : 'Giới thiệu', '/about'],
            ]),
          ]),
        }}
      />
      <About />
    </StoreLayout>
  );
}
