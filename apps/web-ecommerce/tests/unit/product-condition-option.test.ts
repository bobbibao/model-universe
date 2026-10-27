import { initialConditionOptionId } from '../../src/shared/product-condition-option';

describe('SKU selection on a product detail URL', () => {
  const options = [{ id: 287, stock: 0 }, { id: 129, stock: 2 }, { id: 288, stock: 0 }];

  it('keeps a sold-out SKU selected when a sibling is in stock', () => {
    expect(initialConditionOptionId(options, 287, null)).toBe(287);
    expect(initialConditionOptionId(options, 288, null)).toBe(288);
  });

  it('honors an explicit retained condition link, including sold-out merchandise', () => {
    expect(initialConditionOptionId(options, 129, 288)).toBe(288);
  });

  it('falls back to the URL SKU for an unknown condition instead of changing merchandise', () => {
    expect(initialConditionOptionId(options, 287, 999)).toBe(287);
    expect(initialConditionOptionId([], 287, null)).toBe(287);
  });
});
