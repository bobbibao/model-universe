import { Suspense } from 'react';
import { preload } from 'react-dom';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import StoreLayout from '@/components/Layouts/StoreLayout';
import ProductDetail from '@/core/client/features/shop/pages/ProductDetail';
import { getPublicProduct } from '@/shared/server/utils/StorefrontData';
import { siteUrl } from '@/shared/server/utils/SiteUrl';
import { formatVND } from '@/shared/server/utils/utils';
import {
  breadcrumbSchema,
  canonicalOption,
  isEnglish,
  jsonLd,
  organizationId,
  pageMetadata,
  productSeoDescription,
  productSeoTitle,
  SITE_NAME,
} from '@/shared/seo';

type Props = { params: Promise<{ locale: string; slug: string }> };

// schema.org item conditions: a unit missing accessories or with defects is offered as damaged.
const ITEM_CONDITIONS: Record<string, string> = {
  new: 'https://schema.org/NewCondition',
  preowned: 'https://schema.org/UsedCondition',
  incomplete: 'https://schema.org/DamagedCondition',
  defective: 'https://schema.org/DamagedCondition',
};

// The product page at its SEO path (/vi/san-pham/<slug>): canonical URL, hreflang, Open Graph and schema.org Product
// data so search engines show the name, price and availability. Title and description state only the listing's real
// condition (no default percentage, no "complete" claim).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params,
    product = await getPublicProduct(slug);
  if (!product) notFound();
  const base = siteUrl();
  const title = productSeoTitle(product, locale);
  const imageUrl = product.imageUrl ? absoluteUrl(base, product.imageUrl) : undefined;

  return pageMetadata(base, {
    locale,
    path: `/san-pham/${canonicalOption<{ id: number; slug?: string }>(product.conditionOptions ?? [product]).slug}`,
    title,
    description: productSeoDescription(product, locale, formatVND(product.salePrice || product.price, locale)),
    keywords: [
      product.name,
      product.brandName,
      product.modelCode || '',
      product.scale ? `mô hình ${product.scale}` : '',
      `mô hình ${product.brandName}`,
      product.condition === 'new' ? `${product.name} new` : `${product.name} 2hand`,
      'mô hình lắp ráp',
    ].filter(Boolean),
    image: imageUrl ? { url: imageUrl, alt: product.name } : undefined,
  });
}

const absoluteUrl = (base: string, url: string) =>
  url.startsWith('http://') || url.startsWith('https://') ? url : `${base}${url.startsWith('/') ? '' : '/'}${url}`;

const formatSku = (raw?: string | null, fallback?: string | number): string => {
  const val = (raw || (fallback ? `MU-${fallback}` : '')).trim();
  if (!val) return 'MU-PROD';
  if (val.length <= 50) return val;
  const shortened = val.replace(/^MU-OWNER-/, 'MU-');
  return shortened.length <= 50 ? shortened : shortened.slice(0, 50);
};

export default async function Page({ params }: Props) {
  const { locale, slug } = await params,
    product = await getPublicProduct(slug);
  if (!product) notFound();

  if (product.imageUrl) {
    preload(product.imageUrl, { as: 'image', fetchPriority: 'high' });
  }

  const base = siteUrl();
  const en = isEnglish(locale);
  // Every condition variant's URL describes the family's canonical page (see canonicalOption).
  const canonical = canonicalOption<{ id: number; slug?: string }>(product.conditionOptions ?? [product]);
  const description =
    (en ? product.descriptionEn : product.descriptionVi) ||
    product.description ||
    productSeoDescription(product, locale, formatVND(product.salePrice || product.price, locale));
  const validFromDate = product.createdAt
    ? new Date(product.createdAt).toISOString().split('T')[0]
    : '2026-01-01';

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    productID: product.uuid,
    sku: formatSku(product.sku, product.id),
    mpn: formatSku(product.modelCode || product.sku, product.id),
    image: [...new Set([product.imageUrl, ...(product.images || [])].filter((img): img is string => Boolean(img)))].map(
      (img) => absoluteUrl(base, img),
    ),
    description,
    brand: {
      '@type': 'Brand',
      name: product.brandName,
    },
    category: product.category?.name || (product.scale ? `Mô hình lắp ráp tỷ lệ ${product.scale}` : 'Mô hình lắp ráp'),    ...(product.reviewCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.rating,
            reviewCount: product.reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    offers: (product.conditionOptions ?? [{ ...product, isMain: true }]).map((option) => ({
      '@type': 'Offer',
      url: `${base}/${locale}/san-pham/${canonical.slug}${option.id === canonical.id ? '' : `?tinh-trang=${option.id}`}`,
      sku: formatSku(option.sku, option.id),
      priceCurrency: 'VND',
      price: option.salePrice ?? option.price,
      priceValidUntil: '2027-12-31',
      validFrom: validFromDate,
      availability: (option.stock ?? 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: ITEM_CONDITIONS[option.condition ?? 'preowned'] ?? ITEM_CONDITIONS.preowned,
      seller: {
        '@type': 'HobbyShop',
        '@id': organizationId(base),
        name: SITE_NAME,
        url: `${base}/`,
      },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'VN',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 7,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn',
      },
      // No shippingDetails: the carrier prices shipping per address and free shipping applies only to eligible orders
      // (shippingOfferText), so there is no flat rate Google could show truthfully.
    })),
  };

  // Home > Store > category (when the product has one) > product.
  const breadcrumbs = breadcrumbSchema(base, locale, [
    [en ? 'Store' : 'Cửa hàng', '/cua-hang'],
    ...(product.category ? [[product.category.name, `/cua-hang/${product.category.slug}`] as [string, string]] : []),
    [product.name, `/san-pham/${canonical.slug}`],
  ]);

  return (
    <StoreLayout>
      {product.imageUrl && (
        <link rel="preload" as="image" href={product.imageUrl} fetchPriority="high" />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([productSchema, breadcrumbs]),
        }}
      />
      <Suspense>
        <ProductDetail key={slug} initialProduct={product} />
      </Suspense>
    </StoreLayout>
  );
}
