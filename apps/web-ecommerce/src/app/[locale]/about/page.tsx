import type { Metadata } from 'next';
import StoreLayout from '@/components/Layouts/StoreLayout';
import About from '@/core/client/features/content/pages/About';
import { siteUrl } from '@/shared/server/utils/SiteUrl';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const base = siteUrl();
  const title =
    locale === 'vi'
      ? 'Vũ Trụ Mô Hình — Về Chúng Tôi'
      : 'About Model Universe — Authentic Figures Universe';
  const description =
    locale === 'vi'
      ? 'Tìm hiểu câu chuyện, sứ mệnh và tiêu chuẩn kiểm định chất lượng mô hình 2hand khắt khe tại Model Universe — Điểm đến tin cậy của cộng đồng đam mê Gunpla & Figure.'
      : 'Learn about Model Universe: our mission, strict QC standards, and transparent trading platform for authentic pre-owned Gunpla and figures.';

  return {
    title,
    description,
    keywords: [
      'về model universe',
      'giới thiệu model universe',
      'cửa hàng mô hình uy tín',
      'mua gundam 2hand uy tín',
      'tiêu chuẩn kiểm định mô hình',
    ],
    alternates: {
      canonical: `${base}/${locale}/about`,
      languages: {
        vi: `${base}/vi/about`,
        en: `${base}/en/about`,
        'x-default': `${base}/vi/about`,
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'Model Universe',
      title: `${title} | Model Universe`,
      description,
      url: `${base}/${locale}/about`,
      images: [
        {
          url: `${base}/images/store/hero.jpg`,
          width: 1200,
          height: 630,
          alt: 'Về Model Universe',
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

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  const base = siteUrl();

  const aboutSchema = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: locale === 'vi' ? 'Về Model Universe' : 'About Model Universe',
    url: `${base}/${locale}/about`,
    description:
      locale === 'vi'
        ? 'Nền tảng thương mại điện tử chuyên mô hình Gunpla, Metal Build, Figure chính hãng 2hand với tiêu chuẩn kiểm định khắt khe.'
        : 'E-commerce platform specialized in authentic pre-owned Gunpla, Metal Build, and alloy figures with strict QC inspection.',
    mainEntity: {
      '@type': 'Organization',
      name: 'Model Universe',
      url: base,
      logo: `${base}/images/store/hero.jpg`,
    },
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
        name: locale === 'vi' ? 'Về chúng tôi' : 'About Us',
        item: `${base}/${locale}/about`,
      },
    ],
  };

  return (
    <StoreLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([aboutSchema, breadcrumbSchema]).replace(/</g, '\\u003c'),
        }}
      />
      <About />
    </StoreLayout>
  );
}
