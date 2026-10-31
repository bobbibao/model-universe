import type { Metadata } from 'next';
import StoreLayout from '@/components/Layouts/StoreLayout';
import PartnerWorkspace from '@/core/client/features/partner/PartnerWorkspace';
import { siteUrl } from '@/shared/server/utils/SiteUrl';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const base = siteUrl();
  const title =
    locale === 'vi'
      ? 'Hợp Tác Đối Tác Phân Phối & Ký Gửi Mô Hình'
      : 'Partner & Merchant Program';
  const description =
    locale === 'vi'
      ? 'Chương trình hợp tác dành cho đối tác phân phối, cửa hàng và collector muốn mở rộng kênh bán, ký gửi mô hình trên sàn thương mại điện tử Model Universe.'
      : 'Partner program for model merchants and collectors to distribute, list, and consign figures on Model Universe.';

  return {
    title,
    description,
    keywords: [
      'hợp tác kinh doanh mô hình',
      'đối tác model universe',
      'ký gửi gian hàng',
      'bán mô hình trên sàn',
    ],
    alternates: {
      canonical: `${base}/${locale}/services/partner`,
      languages: {
        vi: `${base}/vi/services/partner`,
        en: `${base}/en/services/partner`,
        'x-default': `${base}/vi/services/partner`,
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'Model Universe',
      title: `${title} | Model Universe`,
      description,
      url: `${base}/${locale}/services/partner`,
      images: [
        {
          url: `${base}/images/store/hero.jpg`,
          width: 1200,
          height: 630,
          alt: 'Hợp tác đối tác Model Universe',
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

export default async function PartnerPage({ params }: Props) {
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
        name: locale === 'vi' ? 'Đối tác' : 'Partner',
        item: `${base}/${locale}/services/partner`,
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
      <PartnerWorkspace />
    </StoreLayout>
  );
}
