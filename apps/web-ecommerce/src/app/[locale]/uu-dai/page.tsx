import StoreLayout from '@/components/Layouts/StoreLayout';
import SaleShelf from '@/core/client/features/sales/SaleShelf';
import PromotionsHub from '@/core/client/features/promotions/PromotionsHub';
import type { Metadata } from 'next';
import { siteUrl } from '@/shared/server/utils/SiteUrl';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const base = siteUrl();
  const title =
    locale === 'vi'
      ? 'Săn Ưu Đãi Mô Hình 2hand, Flash Sale & Voucher'
      : 'Exclusive Gunpla Deals & Pre-owned Sales';
  const description =
    locale === 'vi'
      ? 'Tổng hợp mã giảm giá, voucher freeship, điểm danh nhận quà, vòng quay may mắn và flash sale mô hình Gundam, Figure chính hãng tại Model Universe.'
      : 'Special deals, shipping vouchers, daily check-in rewards, lucky wheel, and flash sales for authentic figures at Model Universe.';

  return {
    title,
    description,
    keywords: [
      'ưu đãi mô hình',
      'flash sale mô hình',
      'voucher gundam',
      'mã giảm giá mô hình',
      'mô hình 2hand giá rẻ',
      'model universe ưu đãi',
    ],
    alternates: {
      canonical: `${base}/${locale}/uu-dai`,
      languages: {
        vi: `${base}/vi/uu-dai`,
        en: `${base}/en/uu-dai`,
        'x-default': `${base}/vi/uu-dai`,
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'Model Universe',
      title: `${title} | Model Universe`,
      description,
      url: `${base}/${locale}/uu-dai`,
      images: [
        {
          url: `${base}/images/store/hero.jpg`,
          width: 1200,
          height: 630,
          alt: 'Săn ưu đãi mô hình tại Model Universe',
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

export default async function Page({ params }: Props) {
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
        name: locale === 'vi' ? 'Ưu đãi' : 'Deals',
        item: `${base}/${locale}/uu-dai`,
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
      <PromotionsHub />
      <div id="sale">
        <SaleShelf full />
      </div>
    </StoreLayout>
  );
}
