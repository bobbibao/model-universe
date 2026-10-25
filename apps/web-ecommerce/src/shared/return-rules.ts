export const RETURN_REASONS = [
  'defective',
  'not_as_described',
  'changed_mind',
  'other',
  'wrong_item',
  'missing_accessories',
  'undisclosed_defect',
  'shipping_damage',
] as const;
export type ReturnReason = (typeof RETURN_REASONS)[number];
export const SUPPORT_OUTCOMES = [
  'parts',
  'exchange',
  'repair',
  'partial_refund',
  'full_refund',
  'compensation',
] as const;
export type SupportOutcome = (typeof SUPPORT_OUTCOMES)[number];
