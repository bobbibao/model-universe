import { NEW_ITEM_CONDITION, conditionIssues, isNewCondition } from '../../src/shared/item-condition';

// The condition a customer chooses for a buyback, trade or pawn: only the new-unit choices are priced on the web.
describe('item condition choices', () => {
  const describe_ = (what: string) => what;

  it('declares nothing for a new unit, opened or limited included', () => {
    expect(conditionIssues(NEW_ITEM_CONDITION, describe_)).toEqual([]);
    expect(isNewCondition({ ...NEW_ITEM_CONDITION, box: 'opened', version: 'limited' })).toBe(true);
  });

  it('turns every other choice into a declared issue', () => {
    const issues = conditionIssues(
      {
        version: 'standard',
        assemblyState: 'assembled',
        box: 'none',
        accessories: 'missing',
        defects: 'broken',
        history: 'repaired',
      },
      describe_,
    );
    expect(issues.map((issue) => issue.type)).toEqual([
      'missing_box',
      'missing_accessory',
      'broken_part',
      'other',
      'other',
    ]);
    expect(issues.filter((issue) => issue.type === 'other').map((issue) => issue.description)).toEqual([
      'assembly:assembled',
      'history:repaired',
    ]);
    expect(issues.every((issue) => issue.quantity === 1)).toBe(true);
  });

  it('never prices serious damage on the web', () => {
    expect(isNewCondition({ ...NEW_ITEM_CONDITION, defects: 'serious' })).toBe(false);
    expect(conditionIssues({ ...NEW_ITEM_CONDITION, defects: 'serious' }, describe_)).toEqual([]);
  });
});
