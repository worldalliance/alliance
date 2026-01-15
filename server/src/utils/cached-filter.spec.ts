import { CachedFilter } from './cached-filter';

type TestItem = {
  id: number;
  name: string;
  age: number;
  team: string;
};

describe('CachedFilter', () => {
  const items: TestItem[] = [
    { id: 1, name: 'Alice', age: 40, team: 'red' },
    { id: 2, name: 'bob', age: 30, team: 'blue' },
    { id: 3, name: 'alice', age: 20, team: 'red' },
    { id: 4, name: 'bob', age: 25, team: 'red' },
  ];

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('filters items by params with exact matches', () => {
    const cached = new CachedFilter(items);

    expect(cached.filtered({ name: 'alice' })).toEqual([items[2]]);
    expect(
      cached.filtered({
        name: 'bob',
        age: 25,
      }),
    ).toEqual([items[3]]);
    expect(
      cached.filtered({
        name: 'bob',
        age: 40,
      }),
    ).toEqual([]);
  });

  it('caches by param key set regardless of key order', () => {
    const cached = new CachedFilter(items);

    const first = cached.filtered({ age: 30, name: 'bob' });
    const second = cached.filtered({ name: 'bob', age: 30 });

    expect(first).toEqual([items[1]]);
    expect(second).toEqual([items[1]]);
  });

  it('stores cached maps for filtered queries', () => {
    const cached = new CachedFilter(items);
    const maps = (
      cached as unknown as { maps: Map<string, Map<string, TestItem[]>> }
    ).maps;
    const key = JSON.stringify(['age', 'name']);

    expect(maps.size).toBe(0);

    cached.filtered({ name: 'bob', age: 30 });

    const firstMap = maps.get(key);
    expect(maps.size).toBe(1);
    expect(firstMap).toBeDefined();
    expect(firstMap?.size).toBe(items.length);

    cached.filtered({ age: 30, name: 'bob' });
    expect(maps.get(key)).toBe(firstMap);
  });

  it('matches uses a cached bucket map keyed by cacheKey', () => {
    const cached = new CachedFilter(items);
    const bucket = jest.fn((input: { team: string }) => input.team);

    const first = cached.filteredCustom({
      getBucket: bucket,
      input: { team: 'red' },
      bucketType: 'team',
    });

    expect(first).toEqual([items[0], items[2], items[3]]);
    expect(bucket).toHaveBeenCalledTimes(items.length + 1);

    const second = cached.filteredCustom({
      getBucket: bucket,
      input: { team: 'red' },
      bucketType: 'team',
    });

    expect(second).toEqual([items[0], items[2], items[3]]);
    expect(bucket).toHaveBeenCalledTimes(items.length + 2);

    cached.filteredCustom({
      getBucket: bucket,
      input: { team: 'blue' },
      bucketType: 'team-alt',
    });

    expect(bucket).toHaveBeenCalledTimes(items.length * 2 + 3);
  });

  it('stores cached maps for matches by cacheKey', () => {
    const cached = new CachedFilter(items);
    const maps = (
      cached as unknown as { maps: Map<string, Map<string, TestItem[]>> }
    ).maps;
    const bucket = (input: { team: string }) => input.team;

    expect(maps.size).toBe(0);

    cached.filteredCustom({
      getBucket: bucket,
      input: { team: 'red' },
      bucketType: 'team',
    });

    const firstMap = maps.get('custom_team');
    expect(maps.size).toBe(1);
    expect(firstMap).toBeDefined();
    expect(firstMap?.size).toBe(2);

    cached.filteredCustom({
      getBucket: bucket,
      input: { team: 'red' },
      bucketType: 'team',
    });

    expect(maps.get('custom_team')).toBe(firstMap);
  });
});
