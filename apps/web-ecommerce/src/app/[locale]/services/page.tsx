import type { Metadata } from 'next';
import StoreLayout from '@/components/Layouts/StoreLayout';
import { getFeaturedProducts } from '@/shared/server/utils/StorefrontData';
import CollectorServices from '@/core/client/features/content/pages/CollectorServices';
import { siteUrl } from '@/shared/server/utils/SiteUrl';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const base = siteUrl();
  const title =
    locale === 'vi'
      ? 'Dịch Vụ Thu Mua, Ký Gửi & Định Giá Mô Hình 2hand'
      : 'Collector Services: Buyback, Consignment & Model Valuation';
  const description =
    locale === 'vi'
      ? 'Dịch vụ thu mua mô hình Gundam, Gunpla, Metal Build, Figure hợp kim chính hãng giá cao. Báo giá minh bạch, kiểm định nhanh chóng, hỗ trợ ký gửi và thanh toán tức thì tại Model Universe.'
      : 'Professional collector services for Gunpla & alloy figures: high-value buyback, verified consignment, fast appraisal, and collector reservations at Model Universe.';

  return {
    title,
    description,
    keywords: [
      'thu mua mô hình',
      'thu mua gundam',
      'thu mua gunpla cũ',
      'ký gửi mô hình',
      'định giá mô hình 2hand',
      'bán lại mô hình gundam',
      'cầm mô hình',
      'model universe services',
    ],
    alternates: {
      canonical: `${base}/${locale}/services`,
      languages: {
        vi: `${base}/vi/services`,
        en: `${base}/en/services`,
        'x-default': `${base}/vi/services`,
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'Model Universe',
      title: `${title} | Model Universe`,
      description,
      url: `${base}/${locale}/services`,
      images: [
        {
          url: `${base}/images/store/hero.jpg`,
          width: 1200,
          height: 630,
          alt: 'Dịch vụ thu mua và ký gửi mô hình Model Universe',
        },
      ],
      locale: locale === 'vi' ? 'vi_VN' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | Model Universe`,
      description,
      images: [`${base}/images/store/hero.jpg`],
    },
  };
}

export default async function ServicesPage({ params }: Props) {
  const { locale } = await params;
  const featured = await getFeaturedProducts();
  const base = siteUrl();

  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: locale === 'vi' ? 'Dịch vụ thu mua và ký gửi mô hình' : 'Model Buyback & Consignment Service',
    provider: {
      '@type': 'Organization',
      name: 'Model Universe',
      url: base,
    },
    areaServed: {
      '@type': 'Country',
      name: 'Vietnam',
    },
    description:
      locale === 'vi'
        ? 'Dịch vụ thu mua, ký gửi và thẩm định mô hình Gundam, Metal Build, Figure chính hãng với quy trình kiểm định chất lượng chuyên nghiệp.'
        : 'Collector service providing buyback, consignment, and valuation for authentic pre-owned Gundam and alloy figures.',
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: locale === 'vi' ? 'Trang chủ' : 'Home',
        item: `${base}/${locale}`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: locale === 'vi' ? 'Dịch vụ sưu tầm' : 'Services',
        item: `${base}/${locale}/services`,
      },
    ],
  };

  return (
    <StoreLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([serviceSchema, breadcrumbSchema]).replace(/</g, '\\u003c'),
        }}
      />
      <CollectorServices product={featured?.find((product) => product.stock > 0)} />
    </StoreLayout>
  );
}
