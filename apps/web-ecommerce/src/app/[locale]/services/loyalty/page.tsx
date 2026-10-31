import type { Metadata } from 'next';
import StoreLayout from '@/components/Layouts/StoreLayout';
import Membership from '@/core/client/features/loyalty/Membership';
import { siteUrl } from '@/shared/server/utils/SiteUrl';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const base = siteUrl();
  const title =
    locale === 'vi'
      ? 'Hội Viên Collector Club — Tích Điểm & Đặc Quyền'
      : 'Collector Club Membership — Rewards & Perks';
  const description =
    locale === 'vi'
      ? 'Gia nhập hội viên Model Universe Collector Club: tích điểm đổi quà, chiết khấu độc quyền theo hạng thành viên, ưu tiên sở hữu mô hình giới hạn.'
      : 'Join Model Universe Collector Club: earn points on every purchase, exclusive tier discounts, and early access to rare collectible releases.';

  return {
    title,
    description,
    keywords: [
      'hội viên model universe',
      'tích điểm mua gundam',
      'collector club',
      'ưu đãi thành viên mô hình',
    ],
    alternates: {
      canonical: `${base}/${locale}/services/loyalty`,
      languages: {
        vi: `${base}/vi/services/loyalty`,
        en: `${base}/en/services/loyalty`,
        'x-default': `${base}/vi/services/loyalty`,
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'Model Universe',
      title: `${title} | Model Universe`,
      description,
      url: `${base}/${locale}/services/loyalty`,
      images: [
        {
          url: `${base}/images/store/hero.jpg`,
          width: 1200,
          height: 630,
          alt: 'Hội viên Collector Club Model Universe',
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

export default async function MembershipPage({ params }: Props) {
  const { locale } = await params;
  const base = siteUrl();

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
        name: locale === 'vi' ? 'Hội viên' : 'Membership',
        item: `${base}/${locale}/services/loyalty`,
      },
    ],
  };

  return (
    <StoreLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema).replace(/</g, '\\u003c'),
        }}
      />
      <Membership />
    </StoreLayout>
  );
}
