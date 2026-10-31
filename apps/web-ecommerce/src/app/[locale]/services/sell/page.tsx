import type { Metadata } from 'next';
import StoreLayout from '@/components/Layouts/StoreLayout';
import BuybackWorkspace from '@/core/client/features/buyback/BuybackWorkspace';
import { siteUrl } from '@/shared/server/utils/SiteUrl';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const base = siteUrl();
  const title =
    locale === 'vi'
      ? 'Dịch Vụ Thu Mua Mô Hình Gunpla & Figure 2hand Định Giá Cao'
      : 'Model Buyback & Trade-in Service — High Valuation';
  const description =
    locale === 'vi'
      ? 'Dịch vụ thu mua mô hình Gundam, Metal Build, Figure hợp kim chính hãng giá tốt nhất. Định giá nhanh chóng, thanh toán tức thì, nhận thu mua tận nơi hoặc ship COD.'
      : 'Authentic Gundam, Metal Build, and alloy figure buyback service. Fast valuation, instant cash payout, and nationwide pickup.';

  return {
    title,
    description,
    keywords: [
      'thu mua mô hình',
      'thu mua gundam cũ',
      'bán lại mô hình',
      'thu mua figure chính hãng',
      'thu mua metal build',
      'định giá mô hình',
      'model universe thu mua',
    ],
    alternates: {
      canonical: `${base}/${locale}/services/sell`,
      languages: {
        vi: `${base}/vi/services/sell`,
        en: `${base}/en/services/sell`,
        'x-default': `${base}/vi/services/sell`,
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'Model Universe',
      title: `${title} | Model Universe`,
      description,
      url: `${base}/${locale}/services/sell`,
      images: [
        {
          url: `${base}/images/store/hero.jpg`,
          width: 1200,
          height: 630,
          alt: 'Dịch vụ thu mua mô hình Model Universe',
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

export default async function SellModelsPage({ params }: Props) {
  const { locale } = await params;
  const base = siteUrl();

  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: locale === 'vi' ? 'Dịch vụ thu mua mô hình Gunpla & Figure chính hãng' : 'Pre-owned Figure & Gunpla Buyback Service',
    serviceType: 'Figure Buyback',
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
        ? 'Dịch vụ thu mua mô hình Gundam, Metal Build, Figure hợp kim chính hãng giá cao, định giá minh bạch và thanh toán tức thì.'
        : 'Fast valuation and instant cash buyback service for authentic Gundam and alloy figures in Vietnam.',
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
        name: locale === 'vi' ? 'Dịch vụ' : 'Services',
        item: `${base}/${locale}/services`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: locale === 'vi' ? 'Thu mua mô hình' : 'Buyback',
        item: `${base}/${locale}/services/sell`,
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
      <BuybackWorkspace />
    </StoreLayout>
  );
}
