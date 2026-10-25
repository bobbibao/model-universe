import {
  buildProductPayload,
  emptyProductForm,
  validateInventory,
  validatePricing,
} from '../../src/core/client/features/product-management/components/productForm';
import { parseProductPackaging } from '../../src/shared/packing/rules';

const inventory = { ...emptyProductForm, sku: 'MODEL-001' };
const packaging = { packLengthCm: '30', packWidthCm: '15', packHeightCm: '10', packWeightGram: '3000' };

describe('product form numeric and inherited data contracts', () => {
  test('an empty package keeps the shop default and preserves descriptive text separately', () => {
    const values = { ...inventory, weight: '3 kg', dimensions: '30 × 15 × 10 cm' };
    expect(validateInventory(values)).toEqual({});
    expect(buildProductPayload(values, '/uploads/model.webp', [])).toMatchObject({
      weight: '3 kg',
      dimensions: '30 × 15 × 10 cm',
      packaging: null,
    });
  });

  test.each(['-2', '2.5', '1e2', '9007199254740992'])(
    'stock %s is rejected without changing the entered value',
    (stock) => {
      const values = { ...inventory, stock };
      expect(validateInventory(values).stock).toBe('stockInvalid');
      expect(values.stock).toBe(stock);
    },
  );

  test('partial package values identify each missing measurement', () => {
    expect(validateInventory({ ...inventory, packLengthCm: '30' })).toMatchObject({
      packWidthCm: 'packagingSideInvalid',
      packHeightCm: 'packagingSideInvalid',
      packWeightGram: 'packagingWeightInvalid',
    });
  });

  test('decimal dimensions and values above carrier limits fail at their own fields', () => {
    expect(
      validateInventory({
        ...inventory,
        ...packaging,
        packLengthCm: '30.5',
        packWidthCm: '201',
        packWeightGram: '50001',
      }),
    ).toMatchObject({
      packLengthCm: 'packagingSideInvalid',
      packWidthCm: 'packagingSideInvalid',
      packWeightGram: 'packagingWeightInvalid',
    });
  });

  test('valid package boundaries agree with server parsing and do not overwrite descriptive metadata', () => {
    const values = {
      ...inventory,
      ...packaging,
      packLengthCm: '200',
      packWeightGram: '50000',
      weight: 'Approx. 3 kg',
      dimensions: 'Display size differs from shipping box',
    };
    expect(validateInventory(values)).toEqual({});
    const payload = buildProductPayload(values, '/uploads/model.webp', []);
    expect(parseProductPackaging(payload.packaging).error).toBeNull();
    expect(payload).toMatchObject({ weight: values.weight, dimensions: values.dimensions });
  });

  test('pre-owned items cannot represent multiple unique units', () => {
    expect(validateInventory({ ...inventory, condition: 'preowned', stock: '2' }).stock).toBe('preownedStockInvalid');
    expect(validateInventory({ ...inventory, condition: 'preowned', stock: '1' })).toEqual({});
  });

  test('typed received dates reject rollover dates and accept a real leap day or empty value', () => {
    expect(validateInventory({ ...inventory, productionDate: '2026-02-30' }).productionDate).toBe(
      'receivedDateInvalid',
    );
    expect(validateInventory({ ...inventory, productionDate: '2026-13-01' }).productionDate).toBe(
      'receivedDateInvalid',
    );
    expect(validateInventory({ ...inventory, productionDate: '2024-02-29' })).toEqual({});
    expect(validateInventory({ ...inventory, productionDate: '' })).toEqual({});
  });

  test('invalid issue counts identify the editable count instead of the derived price', () => {
    expect(validatePricing({ ...inventory, pricingReferenceMemberVnd: '1100000', pricingIssueCount: '1.5' })).toEqual({
      pricingIssueCount: 'issueCountInvalid',
    });
    expect(validatePricing({ ...inventory, pricingReferenceMemberVnd: '1100000.5' }).price).toBe('priceInvalid');
  });

  test('legacy prices do not validate an issue count that has no reference and is not submitted', () => {
    const values = { ...inventory, price: '1100000', pricingReferenceMemberVnd: '', pricingIssueCount: '' };
    expect(validatePricing(values)).toEqual({});
    expect(buildProductPayload(values, '/uploads/model.webp', [])).not.toHaveProperty('pricingIssueCount');
  });
});
