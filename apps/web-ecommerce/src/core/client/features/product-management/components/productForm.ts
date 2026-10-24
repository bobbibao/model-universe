import { catalogPricing } from '@/shared/sale-pricing';
import type { ModelCondition, AssemblyState } from '@/shared/gunpla';
import type { AdminProduct, InventoryStatus, ProductGender, ProductPayload } from '@/shared/types/product';

// Form state: numeric fields are kept as strings while editing; lists are one item per line.
export interface ProductFormValues {
  scale: string;
  modelCode: string;
  condition: ModelCondition;
  assemblyState: AssemblyState;
  boxCondition: string;
  conditionNote: string;
  includedAccessories: string;
  missingAccessories: string;
  defects: string;
  descriptionEn: string;
  descriptionVi: string;
  name: string;
  brandName: string;
  description: string;
  categoryId: string;
  gender: ProductGender | '';
  availableSizes: string;
  price: string;
  pricingReferenceMemberVnd: string;
  pricingIssueCount: string;
  importPrice: string;
  stock: string;
  sku: string;
  weight: string;
  dimensions: string;
  // The packing size (package optimizer): all four empty means "use the shop's default box".
  packLengthCm: string;
  packWidthCm: string;
  packHeightCm: string;
  packWeightGram: string;
  packAnyOrientation: boolean;
  packFragile: boolean;
  productionDate: string;
  supplierId: string;
  isFeatured: boolean;
  isArchived: boolean;
  inventoryStatus: InventoryStatus;
}

export type ProductFormErrors = Partial<Record<keyof ProductFormValues | 'mainImage', string>>;

export const emptyProductForm: ProductFormValues = {
  scale: '',
  modelCode: '',
  condition: 'new',
  assemblyState: 'unassembled',
  boxCondition: '',
  conditionNote: '',
  includedAccessories: '',
  missingAccessories: '',
  defects: '',
  descriptionEn: '',
  descriptionVi: '',
  name: '',
  brandName: '',
  description: '',
  categoryId: '',
  gender: 'unisex',
  availableSizes: '',
  price: '',
  pricingReferenceMemberVnd: '',
  pricingIssueCount: '0',
  importPrice: '',
  stock: '0',
  sku: '',
  weight: '',
  dimensions: '',
  packLengthCm: '',
  packWidthCm: '',
  packHeightCm: '',
  packWeightGram: '',
  packAnyOrientation: false,
  packFragile: true,
  productionDate: '',
  supplierId: '',
  isFeatured: false,
  isArchived: false,
  inventoryStatus: 'available',
};

// A hold set by the shop agent (or an admin) hides the product from the storefront until it is released here.
export const INVENTORY_STATUS_VALUES: InventoryStatus[] = ['available', 'quarantine', 'donation_pending', 'recycle'];

export const toFormValues = (product: AdminProduct): ProductFormValues => ({
  scale: product.scale || '',
  modelCode: product.modelCode || '',
  condition: product.condition || 'new',
  assemblyState: product.assemblyState || 'unassembled',
  boxCondition: product.boxCondition || '',
  conditionNote: product.conditionNote || '',
  includedAccessories: (product.includedAccessories || []).join('\n'),
  missingAccessories: (product.missingAccessories || []).join('\n'),
  defects: (product.defects || []).join('\n'),
  descriptionEn: product.descriptionEn || product.description || '',
  descriptionVi: product.descriptionVi || '',
  name: product.name,
  brandName: product.brandName,
  description: product.description || '',
  categoryId: product.categoryId ? String(product.categoryId) : '',
  gender: product.gender,
  availableSizes: product.availableSizes.join(', '),
  price: String(product.price),
  pricingReferenceMemberVnd: product.pricingReferenceMemberVnd ? String(product.pricingReferenceMemberVnd) : '',
  pricingIssueCount: String(product.pricingIssueCount || 0),
  importPrice: String(product.importPrice),
  stock: String(product.stock),
  sku: product.sku,
  weight: product.weight || '',
  dimensions: product.dimensions || '',
  packLengthCm: product.packaging ? String(product.packaging.lengthCm) : '',
  packWidthCm: product.packaging ? String(product.packaging.widthCm) : '',
  packHeightCm: product.packaging ? String(product.packaging.heightCm) : '',
  packWeightGram: product.packaging ? String(product.packaging.weightGram) : '',
  packAnyOrientation: product.packaging?.orientation === 'any',
  packFragile: product.packaging?.fragile ?? true,
  productionDate: product.productionDate ? product.productionDate.slice(0, 10) : '',
  supplierId: product.supplierId ? String(product.supplierId) : '',
  isFeatured: product.isFeatured,
  isArchived: product.isArchived,
  inventoryStatus: product.inventoryStatus,
});

const isWholeNumber = (value: string, min: number) => /^\d+$/.test(value.trim()) && Number(value) >= min;

export const lines = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

// What makes a unit incomplete or defective is shown to customers, so it must be written down.
export const validateCondition = (values: ProductFormValues): ProductFormErrors => {
  const errors: ProductFormErrors = {};
  if (values.condition === 'incomplete' && lines(values.missingAccessories).length === 0)
    errors.missingAccessories = 'missingAccessoriesRequired';
  if (values.condition === 'defective' && lines(values.defects).length === 0) errors.defects = 'defectsRequired';
  return errors;
};

export const validateBasics = (values: ProductFormValues): ProductFormErrors => {
  const errors: ProductFormErrors = {};
  if (!values.name.trim()) errors.name = 'nameRequired';
  if (!values.brandName.trim()) errors.brandName = 'brandRequired';
  return { ...errors, ...validateCondition(values) };
};

export const validatePricing = (values: ProductFormValues): ProductFormErrors => {
  const errors: ProductFormErrors = {};
  if (values.pricingReferenceMemberVnd) {
    try {
      catalogPricing(Number(values.pricingReferenceMemberVnd), Number(values.pricingIssueCount));
    } catch {
      errors.price = 'priceInvalid';
    }
  } else if (!isWholeNumber(values.price, 1)) errors.price = 'priceInvalid';
  if (values.importPrice && !isWholeNumber(values.importPrice, 0)) errors.importPrice = 'importPriceInvalid';
  return errors;
};

export const validateInventory = (values: ProductFormValues): ProductFormErrors => {
  const errors: ProductFormErrors = {};
  if (!isWholeNumber(values.stock, 0)) errors.stock = 'stockInvalid';
  if (!values.sku.trim()) errors.sku = 'skuRequired';
  const pack = [values.packLengthCm, values.packWidthCm, values.packHeightCm, values.packWeightGram];
  if (pack.some((value) => value.trim()) && !pack.every((value) => isWholeNumber(value, 1)))
    errors.packLengthCm = 'packagingInvalid';
  return errors;
};

export const validateProductForm = (values: ProductFormValues): ProductFormErrors => ({
  ...validateBasics(values),
  ...validatePricing(values),
  ...validateInventory(values),
});

// The price fields of a payload: R and B follow S by the catalogue formula (the server recomputes them).
export const pricingPayload = (values: ProductFormValues) => {
  if (!values.pricingReferenceMemberVnd) return { price: Number(values.price) };
  const pricing = catalogPricing(Number(values.pricingReferenceMemberVnd), Number(values.pricingIssueCount));
  return {
    pricingReferenceMemberVnd: pricing.referenceMemberVnd,
    pricingIssueCount: pricing.ordinaryIssueCount,
    price: pricing.listPriceVnd,
    buybackPriceVnd: pricing.buybackPriceVnd,
  };
};

export const conditionPayload = (values: ProductFormValues) => ({
  condition: values.condition,
  assemblyState: values.assemblyState,
  boxCondition: values.boxCondition || null,
  conditionNote: values.conditionNote.trim() || null,
  includedAccessories: lines(values.includedAccessories),
  missingAccessories: lines(values.missingAccessories),
  defects: lines(values.defects),
});

export const buildProductPayload = (values: ProductFormValues, imageUrl: string, images: string[]): ProductPayload => ({
  scale: values.scale || null,
  modelCode: values.modelCode || null,
  ...conditionPayload(values),
  descriptionEn: values.descriptionEn,
  descriptionVi: values.descriptionVi,
  name: values.name.trim(),
  brandName: values.brandName.trim(),
  sku: values.sku.trim(),
  description: values.description.trim(),
  gender: values.gender as ProductGender,
  categoryId: values.categoryId ? Number(values.categoryId) : null,
  supplierId: values.supplierId ? Number(values.supplierId) : null,
  availableSizes: values.availableSizes
    .split(',')
    .map((size) => size.trim())
    .filter(Boolean),
  ...pricingPayload(values),
  importPrice: values.importPrice ? Number(values.importPrice) : 0,
  stock: Number(values.stock),
  weight: values.weight.trim(),
  dimensions: values.dimensions.trim(),
  packaging: values.packLengthCm.trim()
    ? {
        lengthCm: Number(values.packLengthCm),
        widthCm: Number(values.packWidthCm),
        heightCm: Number(values.packHeightCm),
        weightGram: Number(values.packWeightGram),
        orientation: values.packAnyOrientation ? 'any' : 'flat',
        fragile: values.packFragile,
      }
    : null,
  productionDate: values.productionDate || null,
  imageUrl,
  images,
  isFeatured: values.isFeatured,
  isArchived: values.isArchived,
  inventoryStatus: values.inventoryStatus,
});
