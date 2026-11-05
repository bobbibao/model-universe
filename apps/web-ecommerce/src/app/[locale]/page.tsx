import type { Metadata } from 'next';
import { preload } from 'react-dom';
import StoreLayout from '@/components/Layouts/StoreLayout';
import Home from '@/core/client/features/home/pages/Home';
import { getFeaturedProducts } from '@/shared/server/utils/StorefrontData';
import { siteUrl } from '@/shared/server/utils/SiteUrl';
import HomeSeoContent, { homeFaq } from '@/components/Seo/HomeSeoContent';
import { faqSchema, isEnglish, jsonLd, organizationSchema, pageMetadata, websiteSchema } from '@/shared/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const en = isEnglish(locale);
  return pageMetadata(siteUrl(), {
    locale,
    path: '',
    absoluteTitle: true,
    title: en
      ? 'Model Universe – Model Kits, Gunpla & Mecha, New and Pre-owned'
      : 'Model Universe – Mô Hình Lắp Ráp, Gunpla, Mecha New & 2hand',
    description: en
      ? 'Model Universe (Vũ Trụ Mô Hình): new and pre-owned model kits – Gunpla, mecha, robot and Chinese kits. Buyback, trade, pawn loans and assembly help. Ho Chi Minh City, COD across Vietnam.'
      : 'Vũ Trụ Mô Hình – Model Universe: mua bán mô hình lắp ráp Gunpla, Mecha, Robot, kit Trung Quốc New & 2hand. Thu mua, trade, cầm cố, hỗ trợ lắp ráp. Gò Vấp, TP.HCM, COD toàn quốc.',
    keywords: en
      ? ['model universe', 'model kits vietnam', 'gunpla vietnam', 'mecha model kits', 'chinese model kits', 'pre-owned gunpla']
      : [
          'model universe',
          'vũ trụ mô hình',
          'mô hình lắp ráp',
          'shop mô hình gò vấp',
          'mô hình mecha',
          'mô hình lắp ráp trung quốc',
          'gundam 2hand',
          'thu mua mô hình',
          'cầm mô hình',
        ],
  });
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const initialProducts = await getFeaturedProducts();
  const base = siteUrl();

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
          __html: jsonLd([websiteSchema(base, locale), organizationSchema(base, locale), faqSchema(homeFaq(locale))]),
        }}
      />
      <Home initialProducts={initialProducts} />
      <HomeSeoContent locale={locale} />
    </StoreLayout>
  );
}
