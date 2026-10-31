import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import StoreLayout from '@/components/Layouts/StoreLayout';
import Shop from '@/core/client/features/shop/pages/Shop';
import { getPublicCategories } from '@/shared/server/utils/StorefrontData';
import { siteUrl } from '@/shared/server/utils/SiteUrl';

type Props = { params: Promise<{ locale: string; category: string }> };

// A category landing page (/vi/cua-hang/<category>): its own title, description and canonical URL.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, category } = await params;
  const found = (await getPublicCategories()).find((row) => row.slug === category);
  if (!found) notFound();

  const base = siteUrl();
  const path = `/cua-hang/${found.slug}`;
  const title =
    locale === 'vi'
      ? `Mô hình ${found.name} 2hand Chính Hãng`
      : `Authentic Pre-owned ${found.name} Models`;
  const description =
    locale === 'vi'
      ? `Mua mô hình ${found.name} chính hãng 2hand (độ mới 95-98%) tại Model Universe. Giá tốt, kiểm định khớp & sơn kỹ lưỡng, freeship và bảo hành COD toàn quốc.`
      : `Buy authentic pre-owned ${found.name} figures (condition 95-98%) at Model Universe. Transparent price, strict QC inspection, fast nationwide delivery.`;

  return {
    title,
    description,
    keywords: [
      found.name,
      `mô hình ${found.name}`,
      `${found.name} 2hand`,
      `${found.name} chính hãng`,
      'mô hình 2hand',
      'gunpla 2hand',
      'metal build 2hand',
      'model universe',
    ],
    alternates: {
      canonical: `${base}/${locale}${path}`,
      languages: {
        vi: `${base}/vi${path}`,
        en: `${base}/en${path}`,
        'x-default': `${base}/vi${path}`,
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'Model Universe',
      title: `${title} | Model Universe`,
      description,
      url: `${base}/${locale}${path}`,
      images: [
        {
          url: `${base}/images/store/hero.jpg`,
          width: 1200,
          height: 630,
          alt: `Mô hình ${found.name} chính hãng`,
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

export default async function CategoryPage({ params }: Props) {
  const { locale, category } = await params;
  const found = (await getPublicCategories()).find((row) => row.slug === category);
  if (!found) notFound();

  const base = siteUrl();
  const canonicalUrl = `${base}/${locale}/cua-hang/${found.slug}`;

  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: locale === 'vi' ? `Mô hình ${found.name} 2hand` : `Authentic Pre-owned ${found.name}`,
    url: canonicalUrl,
    description:
      locale === 'vi'
        ? `Bộ sưu tập mô hình ${found.name} 2hand chính hãng, bảo đảm ngoại hình và khớp kiểm định tỉ mỉ.`
        : `Collection of authentic pre-owned ${found.name} figures with strict QC verification.`,
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
      {
        '@type': 'ListItem',
        position: 3,
        name: found.name,
        item: canonicalUrl,
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
        <Shop categorySlug={category} />
      </Suspense>
    </StoreLayout>
  );
}
