import { parsePinnedCategories } from './usePinnedCategories';

describe('parsePinnedCategories', () => {
  it('devuelve una lista vacía sin preferencia', () => {
    expect(parsePinnedCategories(undefined)).toEqual([]);
    expect(parsePinnedCategories('')).toEqual([]);
  });

  it('lee el array JSON de ids', () => {
    expect(parsePinnedCategories('["a","b"]')).toEqual(['a', 'b']);
  });

  it('ignora valores corruptos o que no sean ids', () => {
    expect(parsePinnedCategories('no es json')).toEqual([]);
    expect(parsePinnedCategories('{"a":1}')).toEqual([]);
    expect(parsePinnedCategories('["a", 1, null, "b"]')).toEqual(['a', 'b']);
  });
});
