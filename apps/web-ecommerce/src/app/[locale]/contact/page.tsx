import type { Metadata } from 'next';
import StoreLayout from '@/components/Layouts/StoreLayout';
import Contact from '@/core/client/features/content/pages/Contact';
import { siteUrl } from '@/shared/server/utils/SiteUrl';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const base = siteUrl();
  const title =
    locale === 'vi'
      ? 'Liên Hệ — Tư Vấn & Hỗ Trợ Mô Hình'
      : 'Contact Model Universe — Customer Support';
  const description =
    locale === 'vi'
      ? 'Liên hệ Model Universe: giải đáp thắc mắc, tư vấn chọn kit, hỗ trợ kiểm định và tiếp nhận yêu cầu thu mua ký gửi mô hình 2hand chính hãng.'
      : 'Contact Model Universe for figure inquiries, collector kit advice, inspection support, and buyback requests.';

  return {
    title,
    description,
    keywords: [
      'liên hệ model universe',
      'tổng đài hỗ trợ mô hình',
      'tư vấn mua gundam',
      'địa chỉ model universe',
    ],
    alternates: {
      canonical: `${base}/${locale}/contact`,
      languages: {
        vi: `${base}/vi/contact`,
        en: `${base}/en/contact`,
        'x-default': `${base}/vi/contact`,
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'Model Universe',
      title: `${title} | Model Universe`,
      description,
      url: `${base}/${locale}/contact`,
      images: [
        {
          url: `${base}/images/store/hero.jpg`,
          width: 1200,
          height: 630,
          alt: 'Liên hệ Model Universe',
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

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  const base = siteUrl();

  const contactSchema = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: locale === 'vi' ? 'Liên Hệ Model Universe' : 'Contact Model Universe',
    url: `${base}/${locale}/contact`,
    description:
      locale === 'vi'
        ? 'Trang thông tin liên hệ và hỗ trợ khách hàng của Model Universe.'
        : 'Contact and customer support page of Model Universe.',
    mainEntity: {
      '@type': 'Organization',
      name: 'Model Universe',
      url: base,
      email: 'contact@modeluniverse.vn',
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        availableLanguage: ['Vietnamese', 'English'],
      },
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
        name: locale === 'vi' ? 'Liên hệ' : 'Contact',
        item: `${base}/${locale}/contact`,
      },
    ],
  };

  return (
    <StoreLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([contactSchema, breadcrumbSchema]).replace(/</g, '\\u003c'),
        }}
      />
      <Contact />
    </StoreLayout>
  );
}
