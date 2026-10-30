import { catalogTableLayout } from '../../src/shared/catalog-table-layout';

describe('catalog table capacity', () => {
  test('uses another row instead of leaving almost one row empty', () => {
    expect(catalogTableLayout(550)?.pageSize).toBe(9);
    expect(catalogTableLayout(420)).toEqual({ pageSize: 7, rowHeight: 60 });
  });
  test('fills the body while respecting readable row height and API page limits', () => {
    for (let height = 112; height <= 3000; height++) {
      const layout = catalogTableLayout(height)!;
      expect(layout.rowHeight).toBeGreaterThanOrEqual(58);
      expect(layout.rowHeight * layout.pageSize).toBeCloseTo(height);
      expect(layout.pageSize).toBeLessThanOrEqual(100);
    }
    expect(catalogTableLayout(10000)?.pageSize).toBe(100);
  });
  test('waits for a measurable layout instead of requesting a hardcoded page size', () => {
    for (const height of [0, -1, NaN, Infinity]) expect(catalogTableLayout(height)).toBeNull();
  });
});
