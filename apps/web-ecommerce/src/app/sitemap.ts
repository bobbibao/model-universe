import type { MetadataRoute } from 'next';
import { getPublicCategories, getPublicProductSlugs, isIndexableCategory } from '@/shared/server/utils/StorefrontData';
import { siteUrl } from '@/shared/server/utils/SiteUrl';
import { familyCanonicals } from '@/shared/seo';

// Rendered per request: the catalog changes all the time.
export const dynamic = 'force-dynamic';

// /sitemap.xml: complete index of indexable public storefront pages in both vi and en. Only products carry lastmod
// (their real update time) and images; a lastmod of "now" on every static page teaches Google to ignore lastmod.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const absolute = (url: string) => (/^https?:\/\//.test(url) ? url : `${base}${url.startsWith('/') ? '' : '/'}${url}`);
  const entry = (
    path: string,
    priority: number,
    changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never',
    extra: { lastModified?: string; images?: string[] } = {},
  ): MetadataRoute.Sitemap[number] => ({
    url: `${base}/vi${path}`,
    ...(extra.lastModified ? { lastModified: new Date(extra.lastModified) } : {}),
    changeFrequency,
    priority,
    alternates: {
      languages: {
        vi: `${base}/vi${path}`,
        en: `${base}/en${path}`,
      },
    },
    ...(extra.images?.length ? { images: extra.images } : {}),
  });

  const [categories, products] = await Promise.all([getPublicCategories(), getPublicProductSlugs()]);

  return [
    entry('', 1.0, 'daily'),
    entry('/cua-hang', 0.95, 'daily'),
    entry('/services', 0.85, 'weekly'),
    entry('/services/sell', 0.85, 'weekly'),
    entry('/services/trade', 0.8, 'weekly'),
    entry('/services/pawn', 0.8, 'weekly'),
    entry('/uu-dai', 0.7, 'daily'),
    entry('/contact', 0.7, 'monthly'),
    entry('/about', 0.6, 'monthly'),
    entry('/services/loyalty', 0.5, 'monthly'),
    entry('/services/partner', 0.5, 'monthly'),
    ...categories.filter(isIndexableCategory).map((category) => entry(`/cua-hang/${category.slug}`, 0.85, 'daily')),
    ...familyCanonicals(products).map((product) =>
      entry(`/san-pham/${product.slug}`, 0.8, 'daily', {
        lastModified: product.updatedAt,
        images: product.imageUrl ? [absolute(product.imageUrl)] : [],
      }),
    ),
  ];
}
