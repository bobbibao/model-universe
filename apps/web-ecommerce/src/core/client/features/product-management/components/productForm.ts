import { catalogPricing } from '@/shared/sale-pricing';
import { parseDateValue } from '@/components/DateTimeInput/date-values';
import type { ModelCondition, AssemblyState } from '@/shared/gunpla';
import { BUILT_IN_CONDITIONS, type ProductConditionType } from '@/shared/product-conditions';
import type { AdminProduct, InventoryStatus, ProductPayload } from '@/shared/types/product';

// Form state: numeric fields are kept as strings while editing; lists are one item per line.
export interface ProductFormValues {
  scale: string;
  modelCode: string;
  condition: ModelCondition;
  conditionPercent: string;
  conditionNodeIds: number[];
  serviceReferenceEnabled: boolean;
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
  price: string;
  pricingReferenceMemberVnd: string;
  // Read only here: an admin approves S and the real list price R on the pricing approvals page.
  targetPriceApproved: boolean;
  listPriceVerified: boolean;
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
  conditionPercent: '',
  conditionNodeIds: [],
  serviceReferenceEnabled: true,
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
  price: '',
  pricingReferenceMemberVnd: '',
  targetPriceApproved: false,
  listPriceVerified: false,
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
  isArchived: true,
  inventoryStatus: 'available',
};

// A hold set by the shop agent (or an admin) hides the product from the storefront until it is released here.
export const INVENTORY_STATUS_VALUES: InventoryStatus[] = ['available', 'quarantine', 'donation_pending', 'recycle'];

export const toFormValues = (product: AdminProduct): ProductFormValues => ({
  scale: product.scale || '',
  modelCode: product.modelCode || '',
  condition: product.modelFamilyId ? product.itemTypeKey ?? 'new' : product.condition === 'new' ? 'new' : 'preowned',
  conditionPercent: product.conditionPercent != null ? String(product.conditionPercent) : '',
  conditionNodeIds: product.conditionNodeIds ?? [],
  serviceReferenceEnabled: product.serviceReferenceEnabled ?? true,
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
  price: String(product.price),
  pricingReferenceMemberVnd: product.pricingReferenceMemberVnd ? String(product.pricingReferenceMemberVnd) : '',
  targetPriceApproved: !!product.targetPriceApprovedAt,
  listPriceVerified: product.listPriceVerified ?? false,
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

const isWholeNumber = (value: string, min: number) =>
  /^\d+$/.test(value.trim()) && Number.isSafeInteger(Number(value)) && Number(value) >= min;

export const lines = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

// The rules of a condition (Admin > Products > Conditions): what a unit in it must disclose and whether it is unique.
export const conditionRules = (types: readonly ProductConditionType[], key: string) =>
  types.find((type) => type.key === key) ?? BUILT_IN_CONDITIONS.find((type) => type.key === key);

type PhotoInput = { url?: string; file?: File };
// Validate before uploading/saving, so the editor can open the image tab and keep the draft intact.
export const validateProductImages = (
  values: ProductFormValues,
  mainImage: PhotoInput | null,
  types: readonly ProductConditionType[] = BUILT_IN_CONDITIONS,
): ProductFormErrors => {
  if (!mainImage) return { mainImage: 'mainImageRequired' };
  if (values.isArchived || values.condition !== 'preowned') return {};
  if (!mainImage.file && !mainImage.url?.startsWith('/uploads/')) return { mainImage: 'actualPhotosRequired' };
  return {};
};

// What makes a unit incomplete or defective is shown to customers, so it must be written down.
export const validateCondition = (
  values: ProductFormValues,
  types: readonly ProductConditionType[] = BUILT_IN_CONDITIONS,
): ProductFormErrors => {
  const errors: ProductFormErrors = {};
  if (values.condition !== 'new' && values.conditionPercent.trim()) {
    const num = Number(values.conditionPercent);
    if (!isWholeNumber(values.conditionPercent, 1) || num < 1 || num > 100) {
      errors.conditionPercent = 'conditionPercentInvalid';
    }
  }
  return errors;
};

export const validateBasics = (
  values: ProductFormValues,
  types: readonly ProductConditionType[] = BUILT_IN_CONDITIONS,
): ProductFormErrors => {
  const errors: ProductFormErrors = {};
  if (!values.name.trim()) errors.name = 'nameRequired';
  if (!values.brandName.trim()) errors.brandName = 'brandRequired';
  return { ...errors, ...validateCondition(values, types) };
};

export const validatePricing = (values: ProductFormValues): ProductFormErrors => {
  const errors: ProductFormErrors = {};
  // S is required: the shop sells at S until a real list price R is approved with its proof.
  if (!isWholeNumber(values.pricingReferenceMemberVnd, 1)) errors.price = 'priceInvalid';
  else
    try {
      catalogPricing(Number(values.pricingReferenceMemberVnd));
    } catch {
      errors.price = 'priceInvalid';
    }
  if (values.importPrice && !isWholeNumber(values.importPrice, 0)) errors.importPrice = 'importPriceInvalid';
  return errors;
};

export const validateReceivedDate = (values: ProductFormValues): ProductFormErrors =>
  values.productionDate && (values.productionDate.length !== 10 || !parseDateValue(values.productionDate))
    ? { productionDate: 'receivedDateInvalid' }
    : {};

export const validateInventory = (
  values: ProductFormValues,
  types: readonly ProductConditionType[] = BUILT_IN_CONDITIONS,
): ProductFormErrors => {
  const errors: ProductFormErrors = {};
  if (!values.sku.trim()) errors.sku = 'skuRequired';
  if (!isWholeNumber(values.stock, 0)) errors.stock = 'stockInvalid';
  Object.assign(errors, validateReceivedDate(values));
  const pack = [values.packLengthCm, values.packWidthCm, values.packHeightCm, values.packWeightGram];
  if (pack.some((value) => value.trim())) {
    for (const key of ['packLengthCm', 'packWidthCm', 'packHeightCm', 'packWeightGram'] as const) {
      const max = key === 'packWeightGram' ? 50_000 : 200;
      if (!isWholeNumber(values[key], 1) || Number(values[key]) > max)
        errors[key] = key === 'packWeightGram' ? 'packagingWeightInvalid' : 'packagingSideInvalid';
    }
  }
  return errors;
};

export const validateProductForm = (
  values: ProductFormValues,
  types: readonly ProductConditionType[] = BUILT_IN_CONDITIONS,
): ProductFormErrors => ({
  ...validateBasics(values, types),
  ...validatePricing(values),
  ...validateInventory(values, types),
});

// The price fields of a payload: the target price S and its B17 (the server recomputes it). The price charged is not
// sent: it is S until an approved real list price R replaces it (Admin > pricing approvals).
// Without S nothing is sent: validation asks for it, and the server keeps the price of a product saved before S.
export const pricingPayload = (values: ProductFormValues) => {
  if (!values.pricingReferenceMemberVnd) return {};
  const pricing = catalogPricing(Number(values.pricingReferenceMemberVnd));
  return { pricingReferenceMemberVnd: pricing.referenceMemberVnd, buybackPriceVnd: pricing.buybackPriceVnd };
};

export const conditionPayload = (values: ProductFormValues) => ({
  condition: values.condition,
  conditionPercent: values.conditionPercent.trim() ? Math.min(100, Math.max(1, Number(values.conditionPercent))) : null,
  itemTypeKey: values.condition === 'new' ? 'new' as const : 'preowned' as const,
  conditionNodeIds: values.conditionNodeIds,
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
  categoryId: values.categoryId ? Number(values.categoryId) : null,
  supplierId: values.supplierId ? Number(values.supplierId) : null,
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
  serviceReferenceEnabled: values.serviceReferenceEnabled,
});
