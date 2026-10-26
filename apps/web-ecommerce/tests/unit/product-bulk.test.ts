import { parseProductBulk } from '../../src/core/server/services/catalog/ProductBulkInput';

const valid = () => ({
  requestKey: '12345678-1234-1234-1234-123456789ABC',
  items: [{ id: 2, expectedUpdatedAt: '2026-10-26T08:00:00Z' }],
  changes: { isFeatured: false },
});

describe('bulk product input boundary', () => {
  it('canonicalizes versions, row order, key and explicitly false values', () => {
    const input = valid();
    input.items.push({ id: 1, expectedUpdatedAt: '2026-10-26T15:00:00+07:00' });
    expect(parseProductBulk(input)).toEqual({
      requestKey: input.requestKey.toLowerCase(),
      items: [1, 2].map((id) => ({ id, expectedUpdatedAt: '2026-10-26T08:00:00.000Z' })),
      changes: { isFeatured: false },
    });
    expect(parseProductBulk({ ...valid(), changes: { condition: ' preowned ' } }).changes).toEqual({
      condition: 'preowned',
    });
  });
  it.each(['price', 'stock', 'sku', 'brandName', 'categoryId', 'supplierId', 'scale', 'listingStatus', 'isArchived'])(
    'rejects unsupported %s even alongside a valid field',
    (field) => expect(() => parseProductBulk({ ...valid(), changes: { isFeatured: true, [field]: 1 } })).toThrow(),
  );
  it.each([{}, null, { isFeatured: 'false' }, { condition: '' }, { condition: null }, { condition: 'a'.repeat(81) }])(
    'rejects an empty or invalid patch: %j',
    (changes) => expect(() => parseProductBulk({ ...valid(), changes })).toThrow(),
  );
  it('rejects invalid, duplicate and oversized row sets and unknown payload fields', () => {
    const input = valid();
    for (const items of [
      [],
      [input.items[0], input.items[0]],
      [{ id: 0, expectedUpdatedAt: 'bad' }],
      [{ ...input.items[0], price: 1 }],
      Array.from({ length: 51 }, (_, i) => ({ ...input.items[0], id: i + 1 })),
    ]) {
      expect(() => parseProductBulk({ ...input, items })).toThrow();
    }
    expect(() => parseProductBulk({ ...input, actorUserId: 1 })).toThrow();
    expect(() => parseProductBulk({ ...input, requestKey: 'invalid' })).toThrow();
  });
});
