// Where a product photo can come from, for the image import of the owner's catalogue workbook
// (scripts/import-product-images.ts): the links of a cell, what kind each one is, and the photo candidates of a product
// page. Pure functions; the script does the network and file work.

export type ImageLinkKind = 'direct' | 'page' | 'facebook' | 'drive' | 'other';

const IMAGE_EXTENSION = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;
const FACEBOOK_HOSTS = /(^|\.)(facebook\.com|fb\.com|fb\.watch|messenger\.com)$/i;
// Social pages that need a login or render with scripts: a person copies their photos by hand.
const SOCIAL_HOSTS = /(^|\.)(instagram\.com|tiktok\.com|threads\.net|x\.com|twitter\.com|zalo\.me)$/i;
// Image CDNs that serve photos without a file extension.
const IMAGE_HOSTS = /(^|\.)(fbcdn\.net|susercontent\.com|cdninstagram\.com|googleusercontent\.com)$/i;

// The http(s) links of a cell: separated by spaces, new lines, commas or semicolons; trailing punctuation dropped.
export const splitLinks = (cell: string): string[] => {
  const links = (cell.match(/https?:\/\/[^\s,;"'<>]+/gi) ?? []).map((link) => link.replace(/[).\]]+$/, ''));
  return [...new Set(links)];
};

export const classifyLink = (link: string): ImageLinkKind => {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return 'other';
  }
  if (!/^https?:$/.test(url.protocol)) return 'other';
  const host = url.hostname.toLowerCase();
  if (FACEBOOK_HOSTS.test(host)) return 'facebook';
  if (SOCIAL_HOSTS.test(host)) return 'other';
  if (host === 'drive.google.com' || host === 'docs.google.com') return 'drive';
  if (IMAGE_EXTENSION.test(url.pathname) || IMAGE_HOSTS.test(host)) return 'direct';
  return 'page';
};

// Two photos are the same shot (another size, crop margin or compression of it) when their 64-bit difference hashes
// (dHash: a 9×8 greyscale thumbnail, one bit per neighbouring pair) differ in at most `maxDistance` bits.
export const differenceHash = (gray9x8: Uint8Array): string => {
  let bits = '';
  for (let row = 0; row < 8; row++)
    for (let col = 0; col < 8; col++) bits += gray9x8[row * 9 + col] > gray9x8[row * 9 + col + 1] ? '1' : '0';
  return bits;
};
export const sameShot = (a: string, b: string, maxDistance = 6) => {
  let distance = 0;
  for (let index = 0; index < a.length; index++) if (a[index] !== b[index]) distance++;
  return a.length === b.length && distance <= maxDistance;
};

// A Google Drive file's direct download URL; null for a folder or a link without a file id.
export const driveDownloadUrl = (link: string): string | null => {
  const url = new URL(link);
  if (url.pathname.includes('/folders/')) return null;
  const id = url.pathname.match(/\/(?:file\/)?d\/([\w-]{10,})/)?.[1] ?? url.searchParams.get('id');
  return id ? `https://drive.google.com/uc?export=download&id=${id}` : null;
};

// Logos, icons, sprites, payment badges and placeholders are never product photos.
const NOT_A_PHOTO =
  /(logo|icon|favicon|sprite|avatar|badge|banner|payment|placeholder|loading|blank|spinner|flag|rating|star|social|share|qr[-_.]?code|\.svg)/i;

const decode = (value: string) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/gi, '/')
    .trim();

const absolute = (src: string, base: string): string | null => {
  try {
    const url = new URL(decode(src), base);
    return /^https?:$/.test(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
};

const attribute = (tag: string, name: string) =>
  tag
    .match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
    ?.slice(2)
    .find(Boolean);

// Product.image of the page's JSON-LD blocks (a string, a list, ImageObject values, inside @graph or a list of nodes).
const jsonLdImages = (html: string): string[] => {
  const images: string[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    const value = node as Record<string, unknown>;
    const types = ([] as unknown[]).concat(value['@type'] ?? []).map(String);
    if (types.some((type) => /product/i.test(type))) {
      for (const image of ([] as unknown[]).concat(value.image ?? [])) {
        if (typeof image === 'string') images.push(image);
        else if (image && typeof image === 'object') {
          const url = (image as Record<string, unknown>).url ?? (image as Record<string, unknown>).contentUrl;
          if (typeof url === 'string') images.push(url);
        }
      }
    }
    if (value['@graph']) visit(value['@graph']);
  };
  for (const block of html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))
    try {
      visit(JSON.parse(block[1].trim()));
    } catch {
      /* A malformed block is skipped. */
    }
  return images;
};

// The page's main product gallery: the first element whose class or id names a product gallery (WooCommerce, Shopify,
// Sapo/Bizweb, Haravan themes). Images elsewhere on the page (related products, the header) are never taken.
const GALLERY =
  /<(?:div|ul|section|figure)\b[^>]*\s(?:class|id)\s*=\s*["'][^"']*(?:woocommerce-product-gallery|product[-_]?(?:gallery|images?|media|photos?|thumbs?|slider|single)|gallery[-_]?(?:product|main|top))[^"']*["'][^>]*>/i;

// The photo candidates of a product page, best first: og:image (and its secure URL), twitter:image, JSON-LD
// Product.image, then the main gallery's images and zoom links (full-size attributes before `src`). Logos and icons
// are dropped; images under 400 px are dropped after download, when their size is known.
export const extractPageImages = (html: string, pageUrl: string, maxGallery = 12): string[] => {
  const meta: string[] = [];
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attribute(tag, 'property') ?? attribute(tag, 'name') ?? '').toLowerCase();
    if (['og:image', 'og:image:secure_url', 'og:image:url', 'twitter:image', 'twitter:image:src'].includes(key)) {
      const content = attribute(tag, 'content');
      if (content) meta.push(content);
    }
  }
  const gallery: string[] = [];
  const start = html.search(GALLERY);
  const section = start < 0 ? '' : html.slice(start, start + 40_000);
  for (const tag of section.match(/<(?:img|a)\b[^>]*>/gi) ?? []) {
    const src = tag.toLowerCase().startsWith('<a')
      ? [attribute(tag, 'href')].find((href) => href && IMAGE_EXTENSION.test(href.split('?')[0]))
      : ['data-zoom-image', 'data-large_image', 'data-large', 'data-full', 'data-src', 'data-lazy-src', 'src']
          .map((name) => attribute(tag, name))
          .find((value) => value && !value.startsWith('data:'));
    const width = Number(attribute(tag, 'width'));
    if (src && !(width > 0 && width < 400)) gallery.push(src);
  }
  const seen = new Set<string>();
  const result: string[] = [];
  const add = (src: string, limit = Infinity) => {
    const url = absolute(src, pageUrl);
    if (!url || NOT_A_PHOTO.test(new URL(url).pathname) || seen.has(url) || result.length >= limit) return;
    seen.add(url);
    result.push(url);
  };
  [...meta, ...jsonLdImages(html)].forEach((src) => add(src));
  const before = result.length;
  gallery.forEach((src) => add(src, before + maxGallery));
  return result;
};
