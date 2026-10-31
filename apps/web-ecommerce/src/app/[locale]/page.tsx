import type { Metadata } from 'next';
import StoreLayout from '@/components/Layouts/StoreLayout';
import Home from '@/core/client/features/home/pages/Home';
import { getTranslations } from 'next-intl/server';
import { getFeaturedProducts } from '@/shared/server/utils/StorefrontData';
import { siteUrl } from '@/shared/server/utils/SiteUrl';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const base = siteUrl();
  const title =
    locale === 'vi'
      ? 'Model Universe — Hệ Thống Mô Hình 2hand, Gunpla & Figure Chính Hãng'
      : 'Model Universe — Authentic Pre-owned Gunpla & Alloy Figures Store';
  const description =
    locale === 'vi'
      ? 'Chuyên mô hình Gundam, Metal Build, Figure hợp kim chính hãng 2hand độ mới 95-98%. Báo giá 3 mức minh bạch, kiểm định QC nghiêm ngặt, hỗ trợ thu mua và ship COD toàn quốc.'
      : 'Authentic pre-owned Gunpla, Metal Build, and alloy figures. Transparent pricing, strict QC inspection, verified collectors store.';

  return {
    title,
    description,
    alternates: {
      canonical: `${base}/${locale}`,
      languages: {
        vi: `${base}/vi`,
        en: `${base}/en`,
        'x-default': `${base}/vi`,
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'Model Universe',
      title,
      description,
      url: `${base}/${locale}`,
      images: [
        {
          url: `${base}/images/store/hero.jpg`,
          width: 1200,
          height: 630,
          alt: 'Model Universe — Vũ trụ mô hình 2hand chính hãng',
        },
      ],
      locale: locale === 'vi' ? 'vi_VN' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${base}/images/store/hero.jpg`],
    },
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const initialProducts = await getFeaturedProducts();
  const base = siteUrl();

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Model Universe',
    alternateName: ['Model Universe VN', 'ModelUniverse', 'Model Universe Store'],
    url: base,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${base}/${locale}/cua-hang?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  const storeSchema = {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    name: 'Model Universe',
    url: `${base}/${locale}`,
    logo: `${base}/images/store/hero.jpg`,
    description:
      'Hệ thống thương mại điện tử chuyên mô hình Gundam, Metal Build và figure hợp kim chính hãng 2hand. Định giá minh bạch và dịch vụ thu mua, ký gửi chuyên nghiệp.',
    priceRange: '100.000đ - 45.000.000đ',
    currenciesAccepted: 'VND',
    paymentAccepted: 'Cash, Bank Transfer, QR Code, Credit Card',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'VN',
    },
  };

  return (
    <StoreLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([websiteSchema, storeSchema]).replace(/</g, '\\u003c'),
        }}
      />
      <Home initialProducts={initialProducts} />
    </StoreLayout>
  );
}
