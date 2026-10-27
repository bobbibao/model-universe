import { initialConditionOptionId, orderConditionOptions } from '../../src/shared/product-condition-option';

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

  it('keeps every sibling in creation order when the selected SKU, price or stock changes', () => {
    for (const selected of [129, 287, 288]) {
      const input = [selected, ...[288, 129, 287].filter(id => id !== selected)]
        .map(id => ({ id, stock: id === selected ? 0 : 5, salePrice: 1000000 - id, isMain: id === selected }));
      const before = input.map(option => option.id);
      expect(orderConditionOptions(input).map(option => option.id)).toEqual([129, 287, 288]);
      expect(input.map(option => option.id)).toEqual(before);
    }
  });
});
