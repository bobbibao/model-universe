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
      ? 'Thu Cũ Đổi Mới — Trao Đổi Mô Hình Gunpla & Figure Chính Hãng'
      : 'Trade-in & Exchange Authentic Models';
  const description =
    locale === 'vi'
      ? 'Chương trình thu cũ đổi mới (Trade-in) mô hình Gundam, Figure hợp kim chính hãng tại Model Universe. Bù chênh lệch linh hoạt, nâng cấp bộ sưu tập dễ dàng.'
      : 'Trade-in and upgrade your authentic Gundam and alloy figures at Model Universe. Flexible exchange rates and easy collection upgrade.';

  return {
    title,
    description,
    keywords: [
      'thu cũ đổi mới mô hình',
      'đổi mô hình gundam',
      'trade in mô hình',
      'trao đổi figure',
      'nâng cấp mô hình 2hand',
      'model universe trade',
    ],
    alternates: {
      canonical: `${base}/${locale}/services/trade`,
      languages: {
        vi: `${base}/vi/services/trade`,
        en: `${base}/en/services/trade`,
        'x-default': `${base}/vi/services/trade`,
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'Model Universe',
      title: `${title} | Model Universe`,
      description,
      url: `${base}/${locale}/services/trade`,
      images: [
        {
          url: `${base}/images/store/hero.jpg`,
          width: 1200,
          height: 630,
          alt: 'Chương trình thu cũ đổi mới mô hình Model Universe',
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

export default async function TradeModelsPage({ params }: Props) {
  const { locale } = await params;
  const base = siteUrl();

  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: locale === 'vi' ? 'Dịch vụ thu cũ đổi mới mô hình' : 'Model Trade-in & Upgrade Service',
    serviceType: 'Trade-in',
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
        ? 'Thu cũ đổi mới mô hình Gundam, Metal Build, Figure chính hãng với mức bù chênh lệch ưu đãi.'
        : 'Trade-in and upgrade service for authentic collectible figures.',
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
        name: locale === 'vi' ? 'Thu cũ đổi mới' : 'Trade-in',
        item: `${base}/${locale}/services/trade`,
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
      <BuybackWorkspace mode="trade" />
    </StoreLayout>
  );
}
