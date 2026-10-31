import type { MetadataRoute } from 'next';
import { siteUrl } from '@/shared/server/utils/SiteUrl';

export const dynamic = 'force-dynamic';

// /robots.txt: the storefront is public; internal search queries, auth, cart, account, and admin are blocked.
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/_next/static/', '/_next/image', '/images/'],
      disallow: [
        '/api/',
        '/*/admin',
        '/*/admin/*',
        '/*/cart',
        '/*/thank-you',
        '/*/user-profile',
        '/*/order-history',
        '/*/account',
        '/*/account/*',
        '/*/search',
        '/*/auth/',
        '/*/auth/*',
        '/*/wishlist',
        '/*/reservations',
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
