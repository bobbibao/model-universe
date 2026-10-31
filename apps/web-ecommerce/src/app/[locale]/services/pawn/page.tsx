import type { Metadata } from 'next';
import StoreLayout from '@/components/Layouts/StoreLayout';
import PawnWorkspace from '@/core/client/features/pawn/PawnWorkspace';
import { siteUrl } from '@/shared/server/utils/SiteUrl';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const base = siteUrl();
  const title =
    locale === 'vi'
      ? 'Dịch Vụ Ký Gửi & Cầm Cố Mô Hình Sưu Tầm Minh Bạch'
      : 'Collectible Pawn & Asset Storage Services';
  const description =
    locale === 'vi'
      ? 'Dịch vụ lưu giữ, bảo quản và hỗ trợ tài chính minh bạch cho mô hình Gundam, Metal Build có giá trị. Hợp đồng rõ ràng, bảo quản phòng lạnh tiêu chuẩn.'
      : 'Secure collectible storage and pawn service with transparent agreements and climate-controlled preservation.';

  return {
    title,
    description,
    keywords: [
      'cầm cố mô hình',
      'ký gửi mô hình gundam',
      'lưu giữ mô hình',
      'bảo quản figure',
      'model universe pawn',
    ],
    alternates: {
      canonical: `${base}/${locale}/services/pawn`,
      languages: {
        vi: `${base}/vi/services/pawn`,
        en: `${base}/en/services/pawn`,
        'x-default': `${base}/vi/services/pawn`,
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'Model Universe',
      title: `${title} | Model Universe`,
      description,
      url: `${base}/${locale}/services/pawn`,
      images: [
        {
          url: `${base}/images/store/hero.jpg`,
          width: 1200,
          height: 630,
          alt: 'Dịch vụ ký gửi và bảo quản mô hình',
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

export default async function PawnModelsPage({ params }: Props) {
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
        name: locale === 'vi' ? 'Lưu giữ & Cầm cố' : 'Pawn & Storage',
        item: `${base}/${locale}/services/pawn`,
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
      <PawnWorkspace />
    </StoreLayout>
  );
}
