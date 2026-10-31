import { Suspense } from 'react';
import type { Metadata } from 'next';
import StoreLayout from '@/components/Layouts/StoreLayout';
import Shop from '@/core/client/features/shop/pages/Shop';
import { siteUrl } from '@/shared/server/utils/SiteUrl';

type Props = { params: Promise<{ locale: string }> };

// The catalog at its SEO path (/vi/cua-hang); /shop redirects here.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const base = siteUrl();
  const title =
    locale === 'vi'
      ? 'Cửa Hàng Mô Hình 2hand, Gunpla & Figure Chính Hãng'
      : 'Authentic Pre-owned Gunpla & Figures Store';
  const description =
    locale === 'vi'
      ? 'Khám phá hơn 100+ mẫu mô hình Gundam, Metal Build, Figure hợp kim chính hãng 2hand độ mới 95-98%. Giá cực tốt, kiểm định chi tiết, hỗ trợ thu mua và ship COD toàn quốc.'
      : 'Explore authentic pre-owned Gunpla, Metal Build, and alloy figures. Verified condition 95-98%, transparent pricing, and nationwide shipping at Model Universe.';

  return {
    title,
    description,
    keywords: [
      'mô hình 2hand',
      'cửa hàng mô hình',
      'gunpla 2hand',
      'gundam 2hand',
      'metal build 2hand',
      'figure chính hãng',
      'cangdao',
      'motor nuclear',
      'snaa',
      'in era',
      'moshow',
      'model universe',
    ],
    alternates: {
      canonical: `${base}/${locale}/cua-hang`,
      languages: {
        vi: `${base}/vi/cua-hang`,
        en: `${base}/en/cua-hang`,
        'x-default': `${base}/vi/cua-hang`,
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'Model Universe',
      title: `${title} | Model Universe`,
      description,
      url: `${base}/${locale}/cua-hang`,
      images: [
        {
          url: `${base}/images/store/hero.jpg`,
          width: 1200,
          height: 630,
          alt: 'Cửa hàng mô hình Model Universe',
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

export default async function ShopPage({ params }: Props) {
  const { locale } = await params;
  const base = siteUrl();

  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: locale === 'vi' ? 'Cửa Hàng Mô Hình 2hand Model Universe' : 'Model Universe Pre-owned Figures Shop',
    url: `${base}/${locale}/cua-hang`,
    description:
      locale === 'vi'
        ? 'Danh mục mô hình Gunpla, Metal Build, Figure hợp kim chính hãng 2hand kiểm định chất lượng nghiêm ngặt.'
        : 'Catalog of authentic pre-owned Gunpla, Metal Build, and alloy figures with strict QC inspection.',
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
        name: locale === 'vi' ? 'Cửa hàng' : 'Store',
        item: `${base}/${locale}/cua-hang`,
      },
    ],
  };

  return (
    <StoreLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([collectionSchema, breadcrumbSchema]).replace(/</g, '\\u003c'),
        }}
      />
      <Suspense>
        <Shop />
      </Suspense>
    </StoreLayout>
  );
}
