import { parseFilterChoices } from '../../src/core/server/services/catalog/ProductFilterInput';

describe('catalog facet query input', () => {
  it('keeps legacy links and normalizes repeated values without splitting brand punctuation', () => {
    expect(parseFilterChoices(undefined)).toEqual([]);
    expect(parseFilterChoices('new')).toEqual(['new']);
    expect(parseFilterChoices(['new', ' preowned ', 'new', ''])).toEqual(['new', 'preowned']);
    expect(parseFilterChoices("A&B's Lab, Japan")).toEqual(["A&B's Lab, Japan"]);
  });
  it.each([null, 1, {}, [['new']], ['new', {}], Array(51).fill('new'), 'a'.repeat(201)])(
    'rejects invalid or excessive choices: %j',
    (input) => {
      expect(() => parseFilterChoices(input)).toThrow();
    },
  );
});
