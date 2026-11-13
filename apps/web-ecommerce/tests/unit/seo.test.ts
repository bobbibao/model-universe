import {
  breadcrumbSchema,
  canonicalOption,
  categoryKitName,
  familyCanonicals,
  jsonLd,
  pageMetadata,
  privatePageMetadata,
  searchDescription,
  sitemapXmlUrl,
  SEARCH_DESCRIPTION_CHARS,
  productConditionLabel,
  productSeoDescription,
  productSeoTitle,
  shippingOfferText,
} from '../../src/shared/seo';

const base = 'https://modeluniverse.vn';
const kit = { name: 'MNP-XH03 - Ao Bing', brandName: 'Motor Nuclear', scale: '1/100', condition: 'preowned' };

describe('storefront SEO', () => {
  it('states only the condition a listing has, never a default percentage', () => {
    expect(productConditionLabel(kit, 'vi')).toBe('2hand');
    expect(productConditionLabel({ ...kit, conditionPercent: 95, assemblyState: 'unassembled' }, 'vi')).toBe('2hand 95%, chưa ráp');
    expect(productConditionLabel({ ...kit, condition: 'incomplete', assemblyState: 'assembled' }, 'en')).toBe('Pre-owned, built, missing parts');
    expect(productConditionLabel({ ...kit, condition: 'new', assemblyState: 'unassembled' }, 'vi')).toBe('New');
  });

  it('builds product titles in the words shoppers search without repeating the name', () => {
    expect(productSeoTitle(kit, 'vi')).toBe('Mô hình MNP-XH03 - Ao Bing 1/100 – Motor Nuclear 2hand');
    expect(productSeoTitle({ ...kit, name: 'Mô hình lắp ráp 1/100 Tần Thủy Hoàng', brandName: 'Mingjiang' }, 'vi')).toBe(
      'Mô hình lắp ráp 1/100 Tần Thủy Hoàng – Mingjiang 2hand',
    );
    const description = productSeoDescription(kit, 'vi', '611.111 ₫');
    expect(description).toContain('611.111 ₫');
    expect(description).not.toMatch(/98%|đầy đủ phụ kiện/);
  });

  it('gives every page a self canonical, vi/en alternates and an optional noindex', () => {
    const metadata = pageMetadata(base, { locale: 'en', path: '/cua-hang', title: 'Shop', description: 'd' });
    expect(metadata.alternates?.canonical).toBe(`${base}/en/cua-hang`);
    expect(metadata.alternates?.languages).toEqual({
      vi: `${base}/vi/cua-hang`,
      en: `${base}/en/cua-hang`,
      'x-default': `${base}/vi/cua-hang`,
    });
    expect(metadata.robots).toBeUndefined();
    expect(pageMetadata(base, { locale: 'vi', path: '/x', title: 't', description: 'd', noindex: true }).robots).toEqual({
      index: false,
      follow: true,
    });
  });

  it('fits what a search result shows: a whole description and a title that is not cut', () => {
    const long = 'Mua mô hình lắp ráp Gunpla, Gundam, Mecha, Robot và kit Trung Quốc New & 2hand. '.repeat(4);
    const short = pageMetadata(base, { locale: 'vi', path: '/x', title: 'Shop', description: 'Mua mô hình.' });
    expect(short.description).toBe('Mua mô hình.');
    expect(short.title).toBe('Shop'); // the layout template adds " | Model Universe"
    const metadata = pageMetadata(base, {
      locale: 'vi',
      path: '/x',
      title: 'Cửa Hàng Mô Hình Lắp Ráp: Gunpla, Mecha, Kit Trung Quốc',
      description: long,
    });
    expect(String(metadata.description).length).toBeLessThanOrEqual(SEARCH_DESCRIPTION_CHARS);
    expect(metadata.description).toMatch(/[^\s,.]…$/); // cut at a word, never mid-word or after punctuation
    expect(long.startsWith(String(metadata.description).slice(0, -1))).toBe(true);
    // With the brand suffix the title would be cut in a search result, so the page title stands alone...
    expect(metadata.title).toEqual({ absolute: 'Cửa Hàng Mô Hình Lắp Ráp: Gunpla, Mecha, Kit Trung Quốc' });
    // ...while social cards, which have the room, keep the brand and the full description.
    expect(metadata.openGraph?.title).toBe('Cửa Hàng Mô Hình Lắp Ráp: Gunpla, Mecha, Kit Trung Quốc | Model Universe');
    expect(metadata.openGraph?.description).toBe(long);
    expect(searchDescription('một   hai\nba')).toBe('một hai ba');
  });

  it('keeps a product description within a search result for a typical listing', () => {
    expect(productSeoDescription(kit, 'vi', '611.111 ₫').length).toBeLessThanOrEqual(SEARCH_DESCRIPTION_CHARS);
    expect(productSeoDescription(kit, 'en', '611,111 VND').length).toBeLessThanOrEqual(SEARCH_DESCRIPTION_CHARS + 20);
  });

  it('writes sitemap image URLs as valid XML text', () => {
    expect(sitemapXmlUrl('https://cdn.example/a.jpg?v=1786930688&width=1445')).toBe(
      'https://cdn.example/a.jpg?v=1786930688&amp;width=1445',
    );
    expect(sitemapXmlUrl('https://cdn.example/a.jpg?v=1&amp;w=2')).toBe('https://cdn.example/a.jpg?v=1&amp;w=2');
    expect(sitemapXmlUrl(`https://cdn.example/a<b>"c'.jpg`)).toBe('https://cdn.example/a&lt;b&gt;&quot;c&apos;.jpg');
    expect(sitemapXmlUrl('https://modeluniverse.vn/uploads/products/a.webp')).toBe(
      'https://modeluniverse.vn/uploads/products/a.webp',
    );
  });

  it('marks private pages as not for search engines', () => {
    expect(privatePageMetadata('Giỏ hàng')).toEqual({ title: 'Giỏ hàng', robots: { index: false, follow: false } });
  });

  it('starts breadcrumbs at the localized home page and escapes JSON-LD', () => {
    const crumbs = breadcrumbSchema(base, 'vi', [['Cửa hàng', '/cua-hang']]);
    expect(crumbs.itemListElement.map((item) => item.item)).toEqual([`${base}/vi`, `${base}/vi/cua-hang`]);
    expect(jsonLd({ name: '</script>' })).not.toContain('</script>');
  });

  it('gives the condition variants of one model a single canonical page', () => {
    const rows = [
      { id: 287, modelFamilyId: 5, partnerId: null },
      { id: 129, modelFamilyId: 5, partnerId: null },
      { id: 288, modelFamilyId: 5, partnerId: null },
      { id: 300, modelFamilyId: 5, partnerId: 9 },
      { id: 400, modelFamilyId: null },
      { id: 401, modelFamilyId: null },
    ];
    expect(familyCanonicals(rows).map((row) => row.id)).toEqual([129, 300, 400, 401]);
    expect(canonicalOption([{ id: 288 }, { id: 129 }, { id: 287 }]).id).toBe(129);
  });

  it('states the shipping offer from the free-shipping tiers', () => {
    expect(shippingOfferText('vi')).toBe('freeship tới 50k cho đơn đủ điều kiện');
    expect(shippingOfferText('en')).toBe('free shipping up to 50k VND on eligible orders');
  });

  it('names a category as a kit line without doubling "Mô hình"', () => {
    expect(categoryKitName('Mô hình Motor Nuclear', 'vi')).toBe('Mô hình Motor Nuclear');
    expect(categoryKitName('Mecha Trung Quốc', 'vi')).toBe('Mô hình Mecha Trung Quốc');
    expect(categoryKitName('Mô hình SNAA', 'en')).toBe('SNAA');
  });
});
