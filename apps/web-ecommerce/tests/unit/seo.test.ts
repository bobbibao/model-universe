import {
  breadcrumbSchema,
  canonicalOption,
  familyCanonicals,
  jsonLd,
  pageMetadata,
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
});
