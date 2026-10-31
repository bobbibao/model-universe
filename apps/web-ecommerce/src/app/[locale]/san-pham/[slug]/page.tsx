import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import StoreLayout from '@/components/Layouts/StoreLayout';
import ProductDetail from '@/core/client/features/shop/pages/ProductDetail';
import { getPublicProduct } from '@/shared/server/utils/StorefrontData';
import { siteUrl } from '@/shared/server/utils/SiteUrl';
import { formatVND } from '@/shared/server/utils/utils';

type Props = { params: Promise<{ locale: string; slug: string }> };

// schema.org item conditions: a unit missing accessories or with defects is offered as damaged.
const ITEM_CONDITIONS: Record<string, string> = {
  new: 'https://schema.org/NewCondition',
  preowned: 'https://schema.org/UsedCondition',
  incomplete: 'https://schema.org/DamagedCondition',
  defective: 'https://schema.org/DamagedCondition',
};

const buildSeoTitle = (
  product: NonNullable<Awaited<ReturnType<typeof getPublicProduct>>>,
  locale: string,
) => {
  const percent = product.conditionPercent || 98;
  const isPreowned = product.condition === 'preowned';
  if (locale === 'vi') {
    return isPreowned
      ? `Mô hình ${product.name} 2hand (${percent}%) | Model Universe`
      : `Mô hình ${product.name} chính hãng | Model Universe`;
  }
  return isPreowned
    ? `${product.name} Authentic Pre-owned (${percent}%) | Model Universe`
    : `${product.name} Official Model | Model Universe`;
};

const buildSeoDescription = (
  product: NonNullable<Awaited<ReturnType<typeof getPublicProduct>>>,
  locale: string,
) => {
  const priceFormatted = formatVND(product.salePrice || product.price, locale);
  const percent = product.conditionPercent || 98;
  const isPreowned = product.condition === 'preowned';

  if (locale === 'vi') {
    const conditionStr = isPreowned ? `2hand độ mới ${percent}%, đầy đủ phụ kiện` : 'mới 100% nguyên hộp';
    return `Mua mô hình ${product.name} chính hãng ${product.brandName} (${conditionStr}). Giá chỉ ${priceFormatted}. Kiểm định QC nghiêm ngặt, freeship, bảo hành an tâm tại Model Universe.`;
  }
  return `Buy authentic ${product.name} by ${product.brandName} (${isPreowned ? `Pre-owned ${percent}%` : 'Brand New'}). Price: ${priceFormatted}. Strictly inspected, fast nationwide delivery at Model Universe.`;
};

// The product page at its SEO path (/vi/san-pham/<slug>): canonical URL, hreflang, Open Graph and schema.org Product
// data so search engines show the name, price and availability.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params,
    product = await getPublicProduct(slug);
  if (!product) notFound();
  const t = await getTranslations({ locale, namespace: 'catalog' });

  const title = buildSeoTitle(product, locale);
  const description = buildSeoDescription(product, locale);
  const path = `/san-pham/${product.slug}`;
  const base = siteUrl();

  return {
    title,
    description,
    keywords: [
      product.name,
      product.brandName,
      product.scale || '',
      product.modelCode || '',
      'mô hình 2hand',
      'mô hình chính hãng',
      `${product.brandName} 2hand`,
      'model universe',
    ].filter(Boolean),
    alternates: {
      canonical: `${base}/${locale}${path}`,
      languages: {
        vi: `${base}/vi${path}`,
        en: `${base}/en${path}`,
        'x-default': `${base}/vi${path}`,
      },
    },
    openGraph: {
      type: 'article',
      siteName: 'Model Universe',
      title,
      description,
      url: `${base}/${locale}${path}`,
      images: product.imageUrl
        ? [
            {
              url: product.imageUrl,
              width: 800,
              height: 800,
              alt: `${product.name} - Model Universe`,
            },
          ]
        : [],
      locale: locale === 'vi' ? 'vi_VN' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: product.imageUrl ? [product.imageUrl] : [],
    },
  };
}

export default async function Page({ params }: Props) {
  const { locale, slug } = await params,
    product = await getPublicProduct(slug);
  if (!product) notFound();

  const base = siteUrl();
  const canonicalUrl = `${base}/${locale}/san-pham/${product.slug}`;
  const seoDescription = buildSeoDescription(product, locale);

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    productID: product.uuid,
    sku: product.sku,
    mpn: product.modelCode || product.sku,
    image: [product.imageUrl, ...(product.images || [])].filter(Boolean),
    description: seoDescription,
    brand: {
      '@type': 'Brand',
      name: product.brandName,
    },
    category: product.scale ? `Mô hình tỷ lệ ${product.scale}` : 'Mô hình sưu tầm',
    ...(product.reviewCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.rating,
            reviewCount: product.reviewCount,
          },
        }
      : {}),
    offers: (product.conditionOptions ?? [{ ...product, isMain: true }]).map((option) => ({
      '@type': 'Offer',
      url: `${base}/${locale}/san-pham/${product.slug}${option.isMain ? '' : `?tinh-trang=${option.id}`}`,
      sku: option.sku,
      priceCurrency: 'VND',
      price: option.salePrice ?? option.price,
      priceValidUntil: '2027-12-31',
      availability: (option.stock ?? 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: ITEM_CONDITIONS[option.condition ?? 'preowned'] ?? ITEM_CONDITIONS.preowned,
      seller: {
        '@type': 'Organization',
        name: 'Model Universe',
        url: base,
      },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'VN',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 7,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn',
      },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: {
          '@type': 'MonetaryAmount',
          value: 0,
          currency: 'VND',
        },
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: 'VN',
        },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: {
            '@type': 'QuantitativeValue',
            minValue: 0,
            maxValue: 1,
            unitCode: 'd',
          },
          transitTime: {
            '@type': 'QuantitativeValue',
            minValue: 1,
            maxValue: 3,
            unitCode: 'd',
          },
        },
      },
    })),
  };

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
        name: locale === 'vi' ? 'Cửa hàng' : 'Store',
        item: `${base}/${locale}/cua-hang`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: product.brandName,
        item: `${base}/${locale}/cua-hang?brand=${encodeURIComponent(product.brandName)}`,
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: product.name,
        item: canonicalUrl,
      },
    ],
  };

  return (
    <StoreLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([productSchema, breadcrumbSchema]).replace(/</g, '\\u003c'),
        }}
      />
      <Suspense>
        <ProductDetail key={slug} initialProduct={product} />
      </Suspense>
    </StoreLayout>
  );
}
