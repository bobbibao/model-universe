import { ASSEMBLY_STATES, type AssemblyState } from './gunpla';
import type { BuybackIssue } from './buyback-pricing';

// The condition a customer declares for a buyback, trade or pawn by choosing among options instead of free text
// (owner request of 2026-10-26). Every choice other than the new-unit one becomes a declared issue, so the web never
// prices such a unit automatically: an admin quotes it from the photos.
export const ITEM_CONDITION_CHOICES = {
  version: ['standard', 'limited'],
  assemblyState: ASSEMBLY_STATES,
  box: ['sealed', 'opened', 'damaged', 'none'],
  accessories: ['complete', 'missing'],
  defects: ['none', 'minor', 'broken', 'serious'],
  history: ['original', 'repaired'],
} as const;

export interface ItemCondition {
  version: (typeof ITEM_CONDITION_CHOICES.version)[number];
  assemblyState: AssemblyState;
  box: (typeof ITEM_CONDITION_CHOICES.box)[number];
  accessories: (typeof ITEM_CONDITION_CHOICES.accessories)[number];
  defects: (typeof ITEM_CONDITION_CHOICES.defects)[number];
  history: (typeof ITEM_CONDITION_CHOICES.history)[number];
}

export const NEW_ITEM_CONDITION: ItemCondition = {
  version: 'standard',
  assemblyState: 'unassembled',
  box: 'sealed',
  accessories: 'complete',
  defects: 'none',
  history: 'original',
};

// The issues a declared condition stands for; `describe` gives the customer's words for an "other" issue.
export const conditionIssues = (condition: ItemCondition, describe: (what: string) => string): BuybackIssue[] => {
  const issues: BuybackIssue[] = [];
  const add = (type: BuybackIssue['type'], description = '') => issues.push({ type, quantity: 1, description });
  if (condition.box === 'damaged') add('damaged_box');
  if (condition.box === 'none') add('missing_box');
  if (condition.accessories === 'missing') add('missing_accessory');
  if (condition.defects === 'minor') add('scratch_area');
  if (condition.defects === 'broken') add('broken_part');
  if (condition.assemblyState !== 'unassembled') add('other', describe(`assembly:${condition.assemblyState}`));
  if (condition.history === 'repaired') add('other', describe('history:repaired'));
  return issues;
};

// A unit declared new like the shop's: the only one the web prices automatically.
export const isNewCondition = (condition: ItemCondition) =>
  condition.defects !== 'serious' && conditionIssues(condition, () => '-').length === 0;
