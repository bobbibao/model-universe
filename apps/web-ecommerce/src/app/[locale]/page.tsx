import type { Metadata } from 'next';
import { preload } from 'react-dom';
import StoreLayout from '@/components/Layouts/StoreLayout';
import Home from '@/core/client/features/home/pages/Home';
import { getTranslations } from 'next-intl/server';
import { getFeaturedProducts } from '@/shared/server/utils/StorefrontData';
import { siteUrl } from '@/shared/server/utils/SiteUrl';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const base = siteUrl();
  const title =
    locale === 'vi'
      ? 'Model Universe — Hệ Thống Mô Hình 2hand, Gunpla & Figure Chính Hãng'
      : 'Model Universe — Authentic Pre-owned Gunpla & Alloy Figures Store';
  const description =
    locale === 'vi'
      ? 'Chuyên mô hình Gundam, Metal Build, Figure hợp kim chính hãng 2hand độ mới 95-98%. Báo giá 3 mức minh bạch, kiểm định QC nghiêm ngặt, hỗ trợ thu mua và ship COD toàn quốc.'
      : 'Authentic pre-owned Gunpla, Metal Build, and alloy figures. Transparent pricing, strict QC inspection, verified collectors store.';

  return {
    title: {
      absolute: title,
    },
    description,
    alternates: {
      canonical: `${base}/${locale}`,
      languages: {
        vi: `${base}/vi`,
        en: `${base}/en`,
        'x-default': `${base}/vi`,
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'Model Universe',
      title,
      description,
      url: `${base}/${locale}`,
      images: [
        {
          url: `${base}/images/store/hero.jpg`,
          width: 1200,
          height: 630,
          alt: 'Model Universe — Vũ trụ mô hình 2hand chính hãng',
        },
      ],
      locale: locale === 'vi' ? 'vi_VN' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${base}/images/store/hero.jpg`],
    },
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const initialProducts = await getFeaturedProducts();
  const base = siteUrl();

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Model Universe',
    alternateName: ['Model Universe VN', 'ModelUniverse', 'Model Universe Store'],
    url: base,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${base}/${locale}/cua-hang?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  const storeSchema = {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    name: 'Model Universe',
    alternateName: [
      'Model Universe Vietnam',
      'Model Universe VN',
      'Vũ Trụ Mô Hình',
      'Model Universe Store',
    ],
    url: `${base}/${locale}`,
    logo: `${base}/images/store/hero.jpg`,
    image: `${base}/images/store/hero.jpg`,
    description:
      locale === 'vi'
        ? 'Model Universe (modeluniverse.vn) là hệ thống thương mại điện tử chuyên mô hình Gundam, Gunpla, Metal Build và figure hợp kim chính hãng tại Việt Nam. Tiên phong định giá 3 mức minh bạch, kiểm định QC nghiêm ngặt cho mô hình 2hand và cung cấp dịch vụ thu cũ đổi mới, ký gửi uy tín.'
        : 'Model Universe is the leading platform in Vietnam for authentic pre-owned Gundam, Gunpla, Metal Build, and alloy figures. Strict QC inspection, transparent pricing, and trusted buyback services.',
    priceRange: '100.000đ - 45.000.000đ',
    currenciesAccepted: 'VND',
    paymentAccepted: 'Cash, Bank Transfer, QR Code, Credit Card',
    areaServed: {
      '@type': 'Country',
      name: 'Vietnam',
    },
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'VN',
    },
    knowsAbout: [
      'Mô hình Gundam',
      'Gunpla',
      'Metal Build',
      'Mô hình hợp kim',
      'Motor Nuclear',
      'Bandai',
      'CangDao',
      'In Era+',
      'SNAA',
      'Moshow',
      'Thu mua mô hình',
      'Thu cũ đổi mới mô hình',
      'Mô hình 2hand chính hãng',
    ],
    slogan: 'Khám phá vũ trụ mô hình — Định giá minh bạch, kiểm định an tâm',
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: locale === 'vi' ? 'Model Universe là gì?' : 'What is Model Universe?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            locale === 'vi'
              ? 'Model Universe (modeluniverse.vn) là hệ thống thương mại điện tử chuyên mô hình Gundam, Gunpla, Metal Build và figure hợp kim chính hãng tại Việt Nam, tiên phong với kiểm định chất lượng 2hand nghiêm ngặt và dịch vụ thu mua, ký gửi chuyên nghiệp.'
              : 'Model Universe (modeluniverse.vn) is Vietnam’s premier e-commerce platform specializing in authentic Gundam, Gunpla, Metal Build, and alloy figures with strict QC inspection and certified buyback/trade-in services.',
        },
      },
      {
        '@type': 'Question',
        name:
          locale === 'vi'
            ? 'Mô hình 2hand tại Model Universe có bảo đảm chất lượng không?'
            : 'Are pre-owned figures at Model Universe quality-guaranteed?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            locale === 'vi'
              ? 'Mọi mô hình 2hand tại Model Universe đều trải qua quy trình kiểm tra khớp, phụ kiện, nước sơn và độ hoàn thiện nghiêm ngặt, công khai độ mới 95-98% cùng chính sách đổi trả miễn phí trong 7 ngày.'
              : 'Every pre-owned figure at Model Universe undergoes rigorous QC inspection for joints, paint, and accessories, with 95-98% mint condition verified and a 7-day hassle-free return guarantee.',
        },
      },
      {
        '@type': 'Question',
        name:
          locale === 'vi'
            ? 'Model Universe có hỗ trợ thu mua mô hình cũ và trade-in không?'
            : 'Does Model Universe offer buyback and trade-in services?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            locale === 'vi'
              ? 'Có, Model Universe cung cấp dịch vụ thu mua mô hình giá cao, định giá online tức thì và chính sách thu cũ đổi mới (trade-in) trợ giá tối đa cho người chơi Gunpla và figure sưu tầm.'
              : 'Yes, Model Universe provides instant online valuation, cash buyback, and subsidized trade-in programs for Gunpla and collectors figures across Vietnam.',
        },
      },
      {
        '@type': 'Question',
        name:
          locale === 'vi'
            ? 'Chính sách vận chuyển và giao hàng tại Model Universe như thế nào?'
            : 'What is the shipping policy at Model Universe?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            locale === 'vi'
              ? 'Model Universe áp dụng chính sách miễn phí vận chuyển (Freeship 0đ) toàn quốc, đóng gói 3 lớp chống sốc chuyên dụng và hỗ trợ kiểm tra hàng (đồng kiểm COD) trước khi thanh toán.'
              : 'Model Universe provides free nationwide shipping (0 VND) in Vietnam, multi-layer shockproof protective packaging, and cash-on-delivery inspection before payment.',
        },
      },
    ],
  };

  const lcpImage = initialProducts?.[3]?.imageUrl || initialProducts?.[0]?.imageUrl;
  if (lcpImage) {
    preload(lcpImage, { as: 'image', fetchPriority: 'high' });
  }

  return (
    <StoreLayout>
      {lcpImage && (
        <link rel="preload" as="image" href={lcpImage} fetchPriority="high" />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([websiteSchema, storeSchema, faqSchema]).replace(/</g, '\\u003c'),
        }}
      />
      <Home initialProducts={initialProducts} />
    </StoreLayout>
  );
}
