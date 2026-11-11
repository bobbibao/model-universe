import type { Metadata } from 'next';
import { FREESHIP_TIERS } from './promotions';
import { CONTACT } from './contact-channels';

// Search and social metadata shared by every storefront page: the business facts (name, address, contacts) used in
// schema.org data, page metadata (canonical, hreflang, Open Graph) and product titles built from the real condition.
// One source keeps the name, address and phone identical everywhere, which is what Google matches a business on.

export const SITE_NAME = 'Model Universe';
export const SITE_ALTERNATE_NAMES = ['Vũ Trụ Mô Hình', 'Vũ Trụ Mô Hình | Model Universe', 'Model Universe Việt Nam', 'modeluniverse.vn'];
export const SITE_SLOGAN = 'Kết nối đam mê – Mở rộng bộ sưu tập';
export const OG_IMAGE = { path: '/images/store/og-cover.jpg', width: 1200, height: 630 };
export const LOGO_IMAGE = { path: '/icons/logo.png', width: 512, height: 512 };

// The condition variants of one model (same model family and seller: e.g. "missing box", "loose left arm") are one
// product page for search engines. The family's first listing (lowest id, the first condition option) is canonical;
// the others are its options (?tinh-trang=<id>), left out of the sitemap so they do not compete as duplicates.
type FamilyMember = { id: number; modelFamilyId?: number | null; partnerId?: number | null };
const familyKey = (row: FamilyMember) => (row.modelFamilyId ? `${row.modelFamilyId}:${row.partnerId ?? ''}` : `#${row.id}`);
export const familyCanonicals = <T extends FamilyMember>(rows: readonly T[]): T[] => {
  const first = new Map<string, T>();
  for (const row of rows) {
    const current = first.get(familyKey(row));
    if (!current || row.id < current.id) first.set(familyKey(row), row);
  }
  return rows.filter((row) => first.get(familyKey(row)) === row);
};
export const canonicalOption = <T extends { id: number }>(options: readonly T[]): T =>
  options.reduce((lowest, option) => (option.id < lowest.id ? option : lowest));

// The shipping offer as customers read it, from the free-shipping tiers (the largest discount, "eligible" = the tier's
// minimum order). Shipping itself is priced by the carrier per address, so no flat rate is published in schema.org.
const FREESHIP_MAX_K = Math.max(...FREESHIP_TIERS.map((tier) => tier.maxShippingVnd)) / 1000;
export const shippingOfferText = (locale: string) =>
  isEnglish(locale)
    ? `free shipping up to ${FREESHIP_MAX_K}k VND on eligible orders`
    : `freeship tới ${FREESHIP_MAX_K}k cho đơn đủ điều kiện`;

export const BUSINESS = {
  phone: CONTACT.phone,
  phoneDisplay: CONTACT.phoneDisplay,
  email: CONTACT.email,
  streetAddress: CONTACT.streetAddress,
  locality: CONTACT.locality,
  region: CONTACT.region,
  country: 'VN',
  socials: [CONTACT.facebook, CONTACT.tiktok, CONTACT.zalo],
} as const;

export const isEnglish = (locale: string) => locale === 'en';

export const organizationId = (base: string) => `${base}/#organization`;
export const websiteId = (base: string) => `${base}/#website`;

// JSON-LD for a <script type="application/ld+json">: `<` is escaped so text from the catalog cannot close the tag.
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');

export interface PageSeo {
  locale: string;
  // The path after the locale, '' for the home page ('/cua-hang', '/san-pham/<slug>').
  path: string;
  title: string;
  description: string;
  keywords?: string[];
  // The title already carries the brand: it is used as is, without the ' | Model Universe' suffix.
  absoluteTitle?: boolean;
  image?: { url: string; width?: number; height?: number; alt?: string };
  noindex?: boolean;
}

// Metadata of an indexable storefront page: self canonical in its locale, vi/en alternates with vi as x-default.
export function pageMetadata(base: string, page: PageSeo): Metadata {
  const url = `${base}/${page.locale}${page.path}`;
  const socialTitle = page.absoluteTitle ? page.title : `${page.title} | ${SITE_NAME}`;
  const image = page.image ?? { url: `${base}${OG_IMAGE.path}`, width: OG_IMAGE.width, height: OG_IMAGE.height };
  return {
    title: page.absoluteTitle ? { absolute: page.title } : page.title,
    description: page.description,
    ...(page.keywords?.length ? { keywords: page.keywords } : {}),
    alternates: {
      canonical: url,
      languages: {
        vi: `${base}/vi${page.path}`,
        en: `${base}/en${page.path}`,
        'x-default': `${base}/vi${page.path}`,
      },
    },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: socialTitle,
      description: page.description,
      url,
      images: [{ ...image, alt: image.alt ?? socialTitle }],
      locale: isEnglish(page.locale) ? 'en_US' : 'vi_VN',
      alternateLocale: isEnglish(page.locale) ? ['vi_VN'] : ['en_US'],
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description: page.description,
      images: [image.url],
    },
    ...(page.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

// The services the shop offers, in the order customers look for them; the business schema lists them as offers.
export const SHOP_SERVICES = [
  { path: '/cua-hang', vi: 'Mua bán mô hình lắp ráp New & 2hand', en: 'New and pre-owned model kits for sale' },
  { path: '/services/sell', vi: 'Thu mua mô hình Gunpla, Mecha, kit Trung Quốc', en: 'Model kit buyback' },
  { path: '/services/trade', vi: 'Trade, trao đổi và thu cũ đổi mới mô hình', en: 'Model kit trade and trade-in' },
  { path: '/services/pawn', vi: 'Cầm cố mô hình theo thỏa thuận', en: 'Model kit pawn loans' },
  { path: '/contact', vi: 'Hỗ trợ lắp ráp và hoàn thiện mô hình', en: 'Model kit assembly and finishing help' },
  { path: '/contact', vi: 'Tư vấn chọn mô hình theo nhu cầu và ngân sách', en: 'Kit advice for your budget' },
] as const;

export function organizationSchema(base: string, locale: string) {
  const en = isEnglish(locale);
  return {
    '@context': 'https://schema.org',
    '@type': 'HobbyShop',
    '@id': organizationId(base),
    name: SITE_NAME,
    alternateName: SITE_ALTERNATE_NAMES,
    url: `${base}/`,
    logo: { '@type': 'ImageObject', url: `${base}${LOGO_IMAGE.path}`, width: LOGO_IMAGE.width, height: LOGO_IMAGE.height },
    image: `${base}${OG_IMAGE.path}`,
    description: en
      ? 'Model Universe (Vũ Trụ Mô Hình) buys and sells model kits in Ho Chi Minh City: Gunpla, mecha and robot kits, Chinese model kits (Motor Nuclear, CangDao and more), new and pre-owned. Buyback, trade, pawn loans and assembly help, with cash-on-delivery shipping across Vietnam.'
      : 'Model Universe (Vũ Trụ Mô Hình) là shop mô hình tại Gò Vấp, TP.HCM: mua bán mô hình lắp ráp (model kit) Gunpla, Mecha, Robot và các dòng kit Trung Quốc như Motor Nuclear, CangDao, hàng New và 2hand. Nhận thu mua, trade, cầm cố và hỗ trợ lắp ráp mô hình, giao hàng COD toàn quốc.',
    slogan: SITE_SLOGAN,
    telephone: BUSINESS.phone,
    email: BUSINESS.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: BUSINESS.streetAddress,
      addressLocality: BUSINESS.locality,
      addressRegion: BUSINESS.region,
      addressCountry: BUSINESS.country,
    },
    areaServed: [
      { '@type': 'City', name: 'Thành phố Hồ Chí Minh' },
      { '@type': 'Country', name: 'Vietnam' },
    ],
    priceRange: '100.000đ - 45.000.000đ',
    currenciesAccepted: 'VND',
    paymentAccepted: 'Cash, Bank Transfer, QR Code, Cash on Delivery',
    sameAs: BUSINESS.socials,
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: BUSINESS.phone,
      email: BUSINESS.email,
      contactType: 'customer service',
      areaServed: 'VN',
      availableLanguage: ['Vietnamese', 'English'],
    },
    knowsAbout: [
      'Mô hình lắp ráp',
      'Model kit',
      'Gunpla',
      'Mô hình Gundam',
      'Mô hình Mecha',
      'Mô hình Robot',
      'Mô hình lắp ráp Trung Quốc',
      'Motor Nuclear',
      'CangDao',
      'Mô hình 2hand',
      'Thu mua mô hình',
      'Trade mô hình',
      'Cầm cố mô hình',
      'Lắp ráp mô hình',
    ],
    makesOffer: SHOP_SERVICES.map((service) => ({
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', name: en ? service.en : service.vi, url: `${base}/${locale}${service.path}` },
    })),
    hasMerchantReturnPolicy: {
      '@type': 'MerchantReturnPolicy',
      applicableCountry: 'VN',
      returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
      merchantReturnDays: 7,
      returnMethod: 'https://schema.org/ReturnByMail',
      returnFees: 'https://schema.org/FreeReturn',
    },
  };
}

// The site name Google shows above the result (WebSite on the home page, with the Vietnamese name as an alternate).
export function websiteSchema(base: string, locale: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': websiteId(base),
    name: SITE_NAME,
    alternateName: SITE_ALTERNATE_NAMES,
    url: `${base}/`,
    inLanguage: isEnglish(locale) ? 'en' : 'vi',
    publisher: { '@id': organizationId(base) },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${base}/${locale}/cua-hang?search={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

// Home > ...crumbs; each crumb is [name, path after the locale].
export function breadcrumbSchema(base: string, locale: string, crumbs: [string, string][]) {
  const items: [string, string][] = [[isEnglish(locale) ? 'Home' : 'Trang chủ', ''], ...crumbs];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name,
      item: `${base}/${locale}${path}`,
    })),
  };
}

export function serviceSchema(
  base: string,
  locale: string,
  service: { path: string; name: string; serviceType: string; description: string },
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    serviceType: service.serviceType,
    description: service.description,
    url: `${base}/${locale}${service.path}`,
    provider: { '@type': 'HobbyShop', '@id': organizationId(base), name: SITE_NAME, url: `${base}/` },
    areaServed: [
      { '@type': 'City', name: 'Thành phố Hồ Chí Minh' },
      { '@type': 'Country', name: 'Vietnam' },
    ],
  };
}

export function faqSchema(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export interface ProductSeoInput {
  name: string;
  brandName?: string | null;
  scale?: string | null;
  condition?: string;
  conditionPercent?: number | null;
  assemblyState?: string | null;
}

const ASSEMBLY_LABELS: Record<string, { vi: string; en: string }> = {
  unassembled: { vi: 'chưa ráp', en: 'unbuilt' },
  partially_assembled: { vi: 'ráp dở', en: 'partly built' },
  assembled: { vi: 'đã ráp', en: 'built' },
  painted: { vi: 'đã ráp, đã sơn', en: 'built and painted' },
};

const includesText = (text: string, part: string) => text.toLowerCase().includes(part.toLowerCase());

// A category as a kit line: "Mô hình Motor Nuclear" (Vietnamese, without doubling a "Mô hình" the name already has) or
// "Motor Nuclear" (English, the Vietnamese prefix dropped).
export function categoryKitName(name: string, locale: string): string {
  const bare = name.replace(/^mô hình\s+/i, '');
  return isEnglish(locale) ? bare : `Mô hình ${bare}`;
}

// The condition as shoppers search it ("2hand 95% chưa ráp", "New"): only what the listing states, never a guessed
// percentage or "complete" claim.
export function productConditionLabel(product: ProductSeoInput, locale: string): string {
  const en = isEnglish(locale);
  if (product.condition === 'new') return 'New';
  const percent = product.conditionPercent ? ` ${product.conditionPercent}%` : '';
  const assembly = product.assemblyState ? ASSEMBLY_LABELS[product.assemblyState] : undefined;
  const flaw =
    product.condition === 'incomplete'
      ? en ? 'missing parts' : 'thiếu phụ kiện'
      : product.condition === 'defective'
        ? en ? 'has defects' : 'có lỗi'
        : '';
  return [`${en ? 'Pre-owned' : '2hand'}${percent}`, assembly?.[en ? 'en' : 'vi'], flaw].filter(Boolean).join(', ');
}

// "Mô hình <name> <scale> – <brand> 2hand 95%": the shopper's words first, without repeating what the name already says.
export function productSeoTitle(product: ProductSeoInput, locale: string): string {
  const en = isEnglish(locale);
  const name = en || includesText(product.name, 'mô hình') ? product.name : `Mô hình ${product.name}`;
  const scale = product.scale && !includesText(product.name, product.scale) ? ` ${product.scale}` : '';
  const brand = product.brandName && !includesText(product.name, product.brandName) ? `${product.brandName} ` : '';
  return `${name}${scale} – ${brand}${productConditionLabel(product, locale)}`;
}

export function productSeoDescription(product: ProductSeoInput, locale: string, priceText: string): string {
  const condition = productConditionLabel(product, locale);
  const brand = product.brandName && !includesText(product.name, product.brandName) ? ` ${product.brandName}` : '';
  const scale = product.scale && !includesText(product.name, product.scale) ? ` ${product.scale}` : '';
  if (isEnglish(locale)) {
    return `Buy ${product.name}${brand}${scale} (${condition}) for ${priceText}. Clear condition notes, careful packing and cash on delivery across Vietnam from Model Universe, Ho Chi Minh City.`;
  }
  const name = includesText(product.name, 'mô hình') ? product.name : `mô hình ${product.name}`;
  return `Mua ${name}${brand}${scale} (${condition}) giá ${priceText}. Tình trạng mô tả rõ ràng, đóng gói kỹ, ship COD toàn quốc. Shop mô hình Model Universe – Gò Vấp, TP.HCM.`;
}
