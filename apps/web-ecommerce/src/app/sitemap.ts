import type { MetadataRoute } from 'next';
import { getPublicCategories, getPublicProductSlugs } from '@/shared/server/utils/StorefrontData';
import { siteUrl } from '@/shared/server/utils/SiteUrl';

// Rendered per request: the catalog changes all the time.
export const dynamic = 'force-dynamic';

// /sitemap.xml: complete index of indexable public storefront pages in both vi and en.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const entry = (
    path: string,
    priority: number,
    changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never',
    lastModified?: string,
  ): MetadataRoute.Sitemap[number] => ({
    url: `${base}/vi${path}`,
    lastModified: lastModified ? new Date(lastModified) : new Date(),
    changeFrequency,
    priority,
    alternates: {
      languages: {
        vi: `${base}/vi${path}`,
        en: `${base}/en${path}`,
      },
    },
  });

  const [categories, products] = await Promise.all([getPublicCategories(), getPublicProductSlugs()]);

  return [
    entry('', 1.0, 'daily'),
    entry('/cua-hang', 0.95, 'daily'),
    entry('/uu-dai', 0.9, 'daily'),
    entry('/services', 0.85, 'weekly'),
    entry('/services/sell', 0.85, 'daily'),
    entry('/services/trade', 0.8, 'weekly'),
    entry('/services/pawn', 0.75, 'weekly'),
    entry('/services/loyalty', 0.7, 'monthly'),
    entry('/services/partner', 0.7, 'monthly'),
    ...categories.map((category) => entry(`/cua-hang/${category.slug}`, 0.85, 'daily')),
    ...products.map((product) => entry(`/san-pham/${product.slug}`, 0.8, 'daily', product.updatedAt)),
    entry('/about', 0.6, 'monthly'),
    entry('/contact', 0.6, 'monthly'),
  ];
}
