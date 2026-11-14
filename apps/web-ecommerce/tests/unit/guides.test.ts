import { GUIDES, findGuide } from '../../src/shared/guides';
import { FAQ_LIST, faqForService } from '../../src/components/Services/serviceFaqItems';
import {
  SEARCH_DESCRIPTION_CHARS,
  articleSchema,
  faqSchema,
  openingHours,
  organizationSchema,
  productSpecifications,
} from '../../src/shared/seo';

const base = 'https://modeluniverse.vn';

describe('guides', () => {
  it('each guide has its own address, a direct answer and questions to quote', () => {
    expect(new Set(GUIDES.map((guide) => guide.slug)).size).toBe(GUIDES.length);
    for (const guide of GUIDES) {
      expect(guide.slug).toMatch(/^[a-z0-9-]+$/);
      expect(findGuide(guide.slug)).toBe(guide);
      expect(guide.description.length).toBeLessThanOrEqual(SEARCH_DESCRIPTION_CHARS);
      expect(guide.answer.length).toBeGreaterThan(120);
      expect(guide.sections.length).toBeGreaterThanOrEqual(2);
      expect(guide.questions.length).toBeGreaterThanOrEqual(2);
      expect(guide.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const link of guide.related) expect(link.path).toMatch(/^\/[a-z]/);
    }
  });

  it('links between guides point at guides that exist', () => {
    const paths = GUIDES.flatMap((guide) => guide.related.map((link) => link.path));
    for (const path of paths.filter((value) => value.startsWith('/huong-dan/')))
      expect(findGuide(path.replace('/huong-dan/', ''))).toBeDefined();
  });

  it('never states a price, which would go stale', () => {
    for (const guide of GUIDES) expect(JSON.stringify(guide)).not.toMatch(/\d[\d.]*\s?(₫|đ\b|VND|k\b)/);
  });

  it('describes a guide as an Article by the shop, with the answer as its abstract', () => {
    const guide = GUIDES[0];
    expect(articleSchema(base, 'vi', guide)).toMatchObject({
      '@type': 'Article',
      headline: guide.title,
      abstract: guide.answer,
      url: `${base}/vi/huong-dan/${guide.slug}`,
      dateModified: guide.updated,
      publisher: { '@id': `${base}/#organization` },
    });
  });
});

describe('answers on the service pages', () => {
  it('each service page shows questions from the reviewed list, word for word', () => {
    for (const service of ['sell', 'trade', 'pawn'] as const) {
      const items = faqForService(service);
      expect(items.length).toBeGreaterThanOrEqual(2);
      for (const item of items) expect(FAQ_LIST).toContain(item);
      expect(faqSchema(items).mainEntity.map((entry) => entry.name)).toEqual(items.map((item) => item.question));
    }
    expect(faqForService('pawn')[0].id).toBe('pawn-safety');
  });
});

describe('shop and product facts for answer engines', () => {
  it('publishes the opening hours shown on the contact page, and the map', () => {
    expect(openingHours('08:00 – 22:00')).toMatchObject({ opens: '08:00', closes: '22:00' });
    expect(openingHours('08:00 – 22:00').dayOfWeek).toHaveLength(7);
    const shop = organizationSchema(base, 'vi');
    expect(shop.openingHoursSpecification).toMatchObject({ opens: '08:00', closes: '22:00' });
    expect(shop.hasMap).toMatch(/^https:\/\/maps\.google\.com\//);
  });

  it('lists only the specifications a product states', () => {
    const kit = {
      name: 'MNP-XH03',
      brandName: 'Motor Nuclear',
      scale: '1/100',
      condition: 'preowned',
      modelCode: 'MNP-XH03',
    };
    expect(productSpecifications(kit, 'vi')).toEqual([
      { '@type': 'PropertyValue', name: 'Hãng', value: 'Motor Nuclear' },
      { '@type': 'PropertyValue', name: 'Mã sản phẩm', value: 'MNP-XH03' },
      { '@type': 'PropertyValue', name: 'Tỷ lệ', value: '1/100' },
      { '@type': 'PropertyValue', name: 'Tình trạng', value: '2hand' },
    ]);
    expect(productSpecifications({ name: 'Kit', condition: 'new' }, 'en')).toEqual([
      { '@type': 'PropertyValue', name: 'Condition', value: 'New' },
    ]);
  });
});
