// The condition a unit is sold in: the key of a condition from Admin > Products > Conditions
// (src/shared/product-conditions.ts). One model can be listed in several conditions at once (its main listing plus
// condition options, see `parentProductId` on the product), each with its own price, cost, stock and photos.
// The four built-in ones:
// - new: sealed or as new from the manufacturer;
// - preowned: second hand ("2hand"), a unique inspected unit;
// - incomplete: complete except for the accessories listed in `missingAccessories`;
// - defective: has the individual defects listed in `defects`.
export const CONDITIONS = ['new', 'preowned', 'incomplete', 'defective'] as const;
export type BuiltInCondition = (typeof CONDITIONS)[number];
export type ModelCondition = string;
export const isModelCondition = (value: unknown): value is BuiltInCondition =>
  typeof value === 'string' && (CONDITIONS as readonly string[]).includes(value);
export const ASSEMBLY_STATES = ['unassembled', 'partially_assembled', 'assembled', 'painted'] as const;
export type AssemblyState = typeof ASSEMBLY_STATES[number];
export interface GunplaAttributes {
  scale?: string | null;
  modelCode?: string | null;
  condition?: ModelCondition;
  assemblyState?: AssemblyState;
  boxCondition?: string | null;
  includedAccessories?: string[];
  missingAccessories?: string[];
  defects?: string[];
  conditionNote?: string | null;
  descriptionEn?: string | null;
  descriptionVi?: string | null;
}
