import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import StoreLayout from '@/components/Layouts/StoreLayout';
import ProductDetail from '@/core/client/features/shop/pages/ProductDetail';
import { getPublicProduct } from '@/shared/server/utils/StorefrontData';
import { siteUrl } from '@/shared/server/utils/SiteUrl';

type Props = { params: Promise<{ locale: string; slug: string }> };

// schema.org item conditions: a unit missing accessories or with defects is offered as damaged.
const ITEM_CONDITIONS: Record<string, string> = {
  new: 'https://schema.org/NewCondition',
  preowned: 'https://schema.org/UsedCondition',
  incomplete: 'https://schema.org/DamagedCondition',
  defective: 'https://schema.org/DamagedCondition',
};

const describe = (product: NonNullable<Awaited<ReturnType<typeof getPublicProduct>>>, locale: string) => {
  const text =
    (locale === 'vi' ? (product as { descriptionVi?: string }).descriptionVi : (product as { descriptionEn?: string }).descriptionEn) ||
    product.description ||
    '';
  return text.replace(/\s+/g, ' ').trim().slice(0, 160);
};

// The product page at its SEO path (/vi/san-pham/<slug>): canonical URL, hreflang, Open Graph and schema.org Product
// data so search engines show the name, price and availability.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params,
    product = await getPublicProduct(slug);
  if (product === null) notFound();
  const t = await getTranslations({ locale, namespace: 'catalog' });
  if (!product) return { title: `${t('title')} | Model Universe` };
  const description = describe(product, locale);
  const path = `/san-pham/${product.slug}`;
  return {
    title: `${product.name} | Model Universe`,
    ...(description ? { description } : {}),
    alternates: {
      canonical: `${siteUrl()}/${locale}${path}`,
      languages: { vi: `${siteUrl()}/vi${path}`, en: `${siteUrl()}/en${path}`, 'x-default': `${siteUrl()}/vi${path}` },
    },
    openGraph: {
      type: 'website',
      siteName: 'Model Universe',
      title: product.name,
      ...(description ? { description } : {}),
      url: `${siteUrl()}/${locale}${path}`,
      images: product.imageUrl ? [{ url: product.imageUrl, alt: product.name }] : [],
      locale: locale === 'vi' ? 'vi_VN' : 'en_US',
    },
  };
}

export default async function Page({ params }: Props) {
  const { locale, slug } = await params,
    product = await getPublicProduct(slug);
  if (product === null) notFound();
  const structuredData = product && {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    productID: product.uuid,
    sku: product.sku,
    image: [product.imageUrl, ...(product.images || [])].filter(Boolean),
    description: describe(product, locale) || undefined,
    brand: { '@type': 'Brand', name: product.brandName },
    ...(product.reviewCount > 0
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: product.rating, reviewCount: product.reviewCount } }
      : {}),
    // One offer per condition the model is sold in.
    offers: (product.conditionOptions ?? [{ ...product, isMain: true }]).map((option) => ({
      '@type': 'Offer',
      url: `${siteUrl()}/${locale}/san-pham/${product.slug}${option.isMain ? '' : `?tinh-trang=${option.id}`}`,
      sku: option.sku,
      priceCurrency: 'VND',
      price: option.salePrice ?? option.price,
      availability: option.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: ITEM_CONDITIONS[option.condition ?? 'new'] ?? ITEM_CONDITIONS.new,
    })),
  };
  return (
    <StoreLayout>
      {structuredData && (
        <script
          type="application/ld+json"
          // JSON.stringify output with "<" escaped cannot close the script element.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
        />
      )}
      <Suspense>
        <ProductDetail key={slug} initialProduct={product} />
      </Suspense>
    </StoreLayout>
  );
}
