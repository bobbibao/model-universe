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
    entry('/cua-hang', 0.9, 'daily'),
    entry('/uu-dai', 0.85, 'daily'),
    entry('/services', 0.8, 'weekly'),
    ...categories.map((category) => entry(`/cua-hang/${category.slug}`, 0.8, 'daily')),
    ...products.map((product) => entry(`/san-pham/${product.slug}`, 0.75, 'daily', product.updatedAt)),
    entry('/about', 0.6, 'monthly'),
    entry('/contact', 0.6, 'monthly'),
  ];
}
