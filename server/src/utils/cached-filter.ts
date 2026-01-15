/* eslint-disable @typescript-eslint/no-explicit-any */
function getMapKey<K extends PropertyKey>(
  params: Partial<Record<K, unknown>>,
): string {
  return JSON.stringify(Object.keys(params as object).sort());
}

function getKey<K extends PropertyKey>(
  params: Partial<Record<K, unknown>>,
): string {
  const keys = Object.keys(params as object).sort();
  return JSON.stringify(
    Object.fromEntries(keys.map((k) => [k, (params as any)[k]])),
  );
}

/**
 * Filters the items by the given params and caches the result by the type params signature.
 *
 * For example,
 * ```ts
 * const cachedFilter = new CachedFilter([
 *   { name: 'alice', age: 40, height: 180 },
 *   { name: 'bob', age: 30, height: 160 },
 *   { name: 'charlie', age: 20, height: 170 },
 *   { name: 'alice', age: 20, height: 170 },
 * ])
 *
 * // [{ name: 'alice', age: 40, height: 180 }, { name: 'alice', age: 20, height: 170 }]
 * // Takes O(n) time, but now all the future queries for { name: someName } will be O(1)
 * const filtered1 = cachedFilter.filtered({ name: 'alice' })
 *
 * // [] (no results)
 * // Takes O(n) time, but now all the future queries for { name: someName, age: someAge } will be O(1)
 * const filtered2 = cachedFilter.filtered({ name: 'bob', age: 25 })
 *
 * ```
 */
export class CachedFilter<T extends object> {
  private maps: Map<string, Map<string, T[]>> = new Map();

  constructor(public readonly items: T[]) {}

  /**
   * @param params the params which must equal (according to `JSON.stringify`) the keys of the items in `items`
   * @returns the items which match the params
   */
  public filtered<K extends keyof T, P extends Partial<Pick<T, K>>>(
    params: P,
  ): (T & P)[] {
    const key = getMapKey(params);

    let map = this.maps.get(key);
    if (!map) {
      map = new Map();

      for (const item of this.items) {
        const serializedParams = getKey(
          Object.fromEntries(
            Object.keys(params as object).map((k) => [k, item[k]]),
          ) as {
            [X in K]: T[X];
          },
        );

        let filteredItems = map.get(serializedParams);
        if (!filteredItems) {
          filteredItems = [];
          map.set(serializedParams, filteredItems);
        }
        filteredItems.push(item);
      }

      this.maps.set(key, map);
    }

    return (map.get(
      getKey(
        params as {
          [X in K]: T[X];
        },
      ),
    ) ?? []) satisfies T[] as (T & P)[];
  }

  public filteredCustom<K extends keyof T>(params: {
    getBucket: (input: {
      [X in K]: T[X];
    }) => string;
    input: {
      [X in K]: T[X];
    };
    bucketType: string;
  }): T[] {
    const { getBucket, input, bucketType } = params;
    const key = `custom_${bucketType}`;
    let map = this.maps.get(key);
    if (!map) {
      map = new Map();
      for (const item of this.items) {
        const b = getBucket(item);

        let filteredItems = map.get(b);
        if (!filteredItems) {
          filteredItems = [];
          map.set(b, filteredItems);
        }

        filteredItems.push(item);
      }

      this.maps.set(key, map);
    }

    return map.get(getBucket(input)) ?? [];
  }
}
