import type { Metadata } from 'next';
import StoreLayout from '@/components/Layouts/StoreLayout';
import Contact from '@/core/client/features/content/pages/Contact';
import { siteUrl } from '@/shared/server/utils/SiteUrl';
import { breadcrumbSchema, isEnglish, jsonLd, organizationId, organizationSchema, pageMetadata } from '@/shared/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const en = isEnglish(locale);
  return pageMetadata(siteUrl(), {
    locale,
    path: '/contact',
    title: en ? 'Contact and Directions – Model Universe, Ho Chi Minh City' : 'Liên Hệ & Địa Chỉ Shop Mô Hình Gò Vấp, TP.HCM',
    description: en
      ? 'Contact Model Universe: hotline/Zalo 0373 725 104, 730/126 Le Duc Tho, An Hoi Dong (Go Vap), Ho Chi Minh City. Kit advice and quotes for buyback, trades, pawn loans and assembly.'
      : 'Liên hệ Model Universe: hotline/Zalo 0373 725 104, 730/126 Lê Đức Thọ, An Hội Đông (Gò Vấp), TP.HCM. Tư vấn chọn mô hình, báo giá thu mua, trade, cầm cố và lắp ráp.',
    keywords: en ? undefined : ['liên hệ model universe', 'địa chỉ shop mô hình', 'shop mô hình gò vấp', 'shop gundam tphcm', 'shop mô hình lê đức thọ'],
  });
}

export default async function ContactPage({ params }: Props) {
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
              '@type': 'ContactPage',
              name: en ? 'Contact Model Universe' : 'Liên hệ Model Universe',
              url: `${base}/${locale}/contact`,
              about: { '@id': organizationId(base) },
            },
            organizationSchema(base, locale),
            breadcrumbSchema(base, locale, [
              [en ? 'Contact' : 'Liên hệ', '/contact'],
            ]),
          ]),
        }}
      />
      <Contact />
    </StoreLayout>
  );
}
