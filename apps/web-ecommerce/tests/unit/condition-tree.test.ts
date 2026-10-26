import {
  ancestors,
  conditionPath,
  effectiveItemType,
  normalizeSelection,
  type ConditionNode,
} from '../../src/shared/condition-tree';
import { CONDITION_TREE_DEFAULTS } from '../../src/shared/condition-tree-defaults';
import { estimateBuyback, CONDITION_BUYBACK_RULE_VERSION } from '../../src/shared/buyback-pricing';
import { estimatePawn } from '../../src/shared/pawn-rules';

const nodes: ConditionNode[] = CONDITION_TREE_DEFAULTS.map(
  ([key, parent, nameVi, nameEn, selectable, selectionMode], index) => ({
    id: index + 1,
    parentId: parent ? CONDITION_TREE_DEFAULTS.findIndex((row) => row[0] === parent) + 1 : null,
    key,
    nameVi,
    nameEn,
    selectable,
    selectionMode: selectionMode ?? 'multiple',
    description: null,
    itemTypes: ['new', 'preowned'],
    isActive: true,
    version: 0,
    sortOrder: index,
  }),
);
const id = (key: string) => nodes.find((node) => node.key === key)!.id;

describe('condition combinations', () => {
  it.each(['preowned', 'incomplete', 'defective'])(
    'reads legacy %s independently of the additive New default',
    (condition) => {
      expect(effectiveItemType({ condition, modelFamilyId: null, itemTypeKey: 'new' })).toBe('preowned');
    },
  );
  it('uses the reviewed type of a canonical SKU', () => {
    expect(effectiveItemType({ condition: 'new', modelFamilyId: 1, itemTypeKey: 'preowned' })).toBe('preowned');
    expect(effectiveItemType({ condition: 'new', modelFamilyId: null, itemTypeKey: 'new' })).toBe('new');
  });
  it('supports an empty no-issues combination for either item type', () => {
    expect(normalizeSelection([], nodes, 'new')).toEqual([]);
    expect(normalizeSelection([], nodes, 'preowned')).toEqual([]);
  });
  it('canonicalizes order, duplicates and broad ancestors of selected specific defects', () => {
    const selected = [id('loose-joint'), id('missing-box'), id('loose-left-arm'), id('missing-box')];
    const expected = [id('missing-box'), id('loose-left-arm')].sort((a, b) => a - b);
    expect(normalizeSelection(selected, nodes, 'preowned')).toEqual(expected);
    expect(normalizeSelection([...selected].reverse(), nodes, 'preowned')).toEqual(expected);
  });
  it('allows independent defects but rejects mutually exclusive box branches', () => {
    expect(() => normalizeSelection([id('missing-box'), id('loose-left-arm')], nodes, 'preowned')).not.toThrow();
    expect(() => normalizeSelection([id('missing-box'), id('dented-box')], nodes, 'preowned')).toThrow('loại trừ');
    expect(() => normalizeSelection([id('dented-box'), id('torn-box')], nodes, 'preowned')).not.toThrow();
  });
  it('keeps item type independent of defects', () => {
    expect(normalizeSelection([id('dented-box')], nodes, 'new')).toEqual([id('dented-box')]);
  });
  it('rejects group selection, unknown IDs, invalid values and oversized selections', () => {
    for (const value of [[id('box')], [999999], ['1'], [0], [1.5], Array(101).fill(id('missing-box'))])
      expect(() => normalizeSelection(value, nodes, 'new')).toThrow();
  });
  it('retires a branch for new selections while preserving a stored selection', () => {
    const retired = nodes.map((node) => (node.id === id('box') ? { ...node, isActive: false } : node));
    expect(() => normalizeSelection([id('missing-box')], retired, 'preowned')).toThrow();
    expect(normalizeSelection([id('missing-box')], retired, 'preowned', [id('missing-box')])).toEqual([
      id('missing-box'),
    ]);
  });
  it('enforces type applicability and finds arbitrarily nested paths', () => {
    const restricted = nodes.map((node) =>
      node.id === id('box')
        ? { ...node, itemTypes: ['preowned'] as const as unknown as ConditionNode['itemTypes'] }
        : node,
    );
    expect(() => normalizeSelection([id('missing-box')], restricted, 'new')).toThrow();
    expect(conditionPath(id('loose-left-arm'), nodes)).toBe('Khớp / Lỏng khớp / Khớp tay / Tay trái');
    expect(ancestors(id('loose-left-arm'), nodes)).toHaveLength(3);
  });
  it('detects cycles instead of recursing forever', () => {
    const cycle = nodes.map((node) => (node.id === id('joints') ? { ...node, parentId: id('loose-left-arm') } : node));
    expect(() => ancestors(id('loose-left-arm'), cycle)).toThrow('vòng lặp');
  });
  it('does not deduct an approved combination defect twice and snapshots the new rule', () => {
    const issues = [{ type: 'missing_box' as const, quantity: 1 }];
    const quote = estimateBuyback(700000, issues, { approved: true, conditionMatched: true });
    expect(quote).toMatchObject({
      ruleVersion: CONDITION_BUYBACK_RULE_VERSION,
      estimateVnd: 560000,
      issueDeductionVnd: 0,
      manualReview: null,
    });
    expect(estimatePawn(700000, { approved: true }).amountVnd).toBe(350000);
    expect(estimateBuyback(700000, issues, { approved: true }).estimateVnd).toBeNull();
    expect(estimateBuyback(null, issues, { approved: false, conditionMatched: false }).estimateVnd).toBeNull();
  });
});
