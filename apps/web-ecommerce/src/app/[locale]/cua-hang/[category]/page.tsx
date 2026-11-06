import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import StoreLayout from '@/components/Layouts/StoreLayout';
import Shop from '@/core/client/features/shop/pages/Shop';
import { getPublicCategories, isIndexableCategory } from '@/shared/server/utils/StorefrontData';
import { siteUrl } from '@/shared/server/utils/SiteUrl';
import { breadcrumbSchema, categoryKitName, isEnglish, jsonLd, organizationId, pageMetadata } from '@/shared/seo';

type Props = { params: Promise<{ locale: string; category: string }> };

// A category landing page (/vi/cua-hang/<category>): its own title, description and canonical URL. An empty or
// internal category stays reachable but is kept out of the index (thin page).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, category } = await params;
  const found = (await getPublicCategories()).find((row) => row.slug === category);
  if (!found) notFound();
  const en = isEnglish(locale);
  const kit = categoryKitName(found.name, locale);

  return pageMetadata(siteUrl(), {
    locale,
    path: `/cua-hang/${found.slug}`,
    title: en ? `${kit} – New and Pre-owned Model Kits` : `${kit} New & 2hand`,
    description:
      found.description?.trim() ||
      (en
        ? `Shop ${kit} at Model Universe: new and pre-owned model kits with clear condition notes, fair prices and cash on delivery across Vietnam.`
        : `Mua ${kit.replace(/^Mô hình/, 'mô hình')} New & 2hand tại Model Universe: tình trạng ghi rõ từng món, giá minh bạch, ship COD toàn quốc từ Gò Vấp, TP.HCM.`),
    keywords: en
      ? undefined
      : [found.name, kit.toLowerCase(), `${categoryKitName(found.name, 'en')} 2hand`, `${categoryKitName(found.name, 'en')} new`, 'mô hình lắp ráp'],
    noindex: !isIndexableCategory(found),
  });
}

export default async function CategoryPage({ params }: Props) {
  const { locale, category } = await params;
  const found = (await getPublicCategories()).find((row) => row.slug === category);
  if (!found) notFound();
  const en = isEnglish(locale);
  const base = siteUrl();

  return (
    <StoreLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            {
              '@context': 'https://schema.org',
              '@type': 'CollectionPage',
              name: en ? `${categoryKitName(found.name, locale)} model kits` : categoryKitName(found.name, locale),
              url: `${base}/${locale}/cua-hang/${found.slug}`,
              provider: { '@id': organizationId(base) },
            },
            breadcrumbSchema(base, locale, [
              [en ? 'Store' : 'Cửa hàng', '/cua-hang'],
              [found.name, `/cua-hang/${found.slug}`],
            ]),
          ]),
        }}
      />
      <Suspense>
        <Shop categorySlug={category} categoryName={found.name} />
      </Suspense>
    </StoreLayout>
  );
}
