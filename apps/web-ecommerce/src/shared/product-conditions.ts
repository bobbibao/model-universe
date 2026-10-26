// The conditions a unit can be sold in (Admin > Products > Conditions). The shop starts with the four built-in ones and
// the owner adds more over time; each condition carries the rules a unit in it must meet, so the code never checks a
// condition by name:
// - uniqueUnit: every unit is one of a kind (like second hand): one piece per listing, at least three real uploaded
//   photos, and stock only through its inspected intake (buy-back, pawn) or a verified return;
// - requiresMissingAccessories: the listing must say which accessories are missing;
// - requiresDefects: the listing must describe each defect.
// Built-in conditions can be renamed, reordered and described, but not removed or have their rules changed: buy-back
// intake, partner listings and the owner's catalogue rely on them.

export interface ProductConditionType {
  key: string;
  nameVi: string;
  nameEn: string;
  descriptionVi: string | null;
  descriptionEn: string | null;
  skuSuffix: string;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
  uniqueUnit: boolean;
  requiresMissingAccessories: boolean;
  requiresDefects: boolean;
}

export const BUILT_IN_CONDITIONS: ProductConditionType[] = [
  {
    key: 'new',
    nameVi: 'Mới',
    nameEn: 'New',
    descriptionVi: 'Hàng mới nguyên hộp.',
    descriptionEn: 'New in its box.',
    skuSuffix: 'N',
    sortOrder: 10,
    isActive: true,
    isSystem: true,
    uniqueUnit: false,
    requiresMissingAccessories: false,
    requiresDefects: false,
  },
  {
    key: 'preowned',
    nameVi: '2hand',
    nameEn: 'Pre-owned',
    descriptionVi: 'Hàng đã qua sử dụng, mỗi sản phẩm là một chiếc riêng có ảnh thật.',
    descriptionEn: 'Second hand: each one is a single unit with photos of the actual item.',
    skuSuffix: '2H',
    sortOrder: 20,
    isActive: true,
    isSystem: true,
    uniqueUnit: true,
    requiresMissingAccessories: false,
    requiresDefects: false,
  },
  {
    key: 'incomplete',
    nameVi: 'Thiếu phụ kiện',
    nameEn: 'Missing accessories',
    descriptionVi: 'Còn đủ mô hình nhưng thiếu các phụ kiện được liệt kê.',
    descriptionEn: 'The model is complete but the listed accessories are missing.',
    skuSuffix: 'TPK',
    sortOrder: 30,
    isActive: true,
    isSystem: true,
    uniqueUnit: false,
    requiresMissingAccessories: true,
    requiresDefects: false,
  },
  {
    key: 'defective',
    nameVi: 'Có lỗi',
    nameEn: 'Defective',
    descriptionVi: 'Có lỗi riêng được công bố bên dưới; giá đã tính theo lỗi.',
    descriptionEn: 'Has the individual defects listed below; the price reflects them.',
    skuSuffix: 'LOI',
    sortOrder: 40,
    isActive: true,
    isSystem: true,
    uniqueUnit: false,
    requiresMissingAccessories: false,
    requiresDefects: true,
  },
];

// A condition key: lower-case letters, digits and hyphens, 2–40 characters, starting with a letter.
export const CONDITION_KEY_PATTERN = /^[a-z][a-z0-9-]{1,39}$/;
// An SKU suffix: upper-case letters and digits, 1–8 characters.
export const SKU_SUFFIX_PATTERN = /^[A-Z0-9]{1,8}$/;

export const conditionName = (types: readonly ProductConditionType[], key: string | null | undefined, en: boolean) => {
  // Shop display terminology stays the same in both locales; stored condition names/rules are unchanged.
  if (key === 'new') return 'New';
  if (key === 'preowned') return '2hand';
  const type = types.find((item) => item.key === key) ?? BUILT_IN_CONDITIONS.find((item) => item.key === key);
  return type ? (en ? type.nameEn : type.nameVi) : (key ?? '');
};

export const conditionDescription = (
  types: readonly ProductConditionType[],
  key: string | null | undefined,
  en: boolean,
) => {
  const type = types.find((item) => item.key === key) ?? BUILT_IN_CONDITIONS.find((item) => item.key === key);
  return (en ? type?.descriptionEn : type?.descriptionVi) ?? '';
};
