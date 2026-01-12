/**
 * Returns the "least" element (as determined by the comparator) with the given filter condition.
 *
 * @param elements Array of elements to filter
 * @param comparator Function used to determine the order of the elements. It is expected to return a negative value if the first argument is less than the second argument, zero if they're equal, and a positive value otherwise.
 * @param filter Only elements that pass this filter will be considered
 * @returns
 */
export function findLeast<T>(
  elements: T[],
  comparator: (a: T, b: T) => number,
): T | null;
export function findLeast<T, S extends T>(
  elements: T[],
  comparator: (a: T, b: T) => number,
  filter: (element: T) => element is S,
): S | null;
export function findLeast<T>(
  elements: T[],
  comparator: (a: T, b: T) => number,
  filter: (element: T) => boolean,
): T | null;
export function findLeast<T, S extends T>(
  elements: T[],
  comparator: (a: T, b: T) => number,
  filter?:
    | ((element: T) => element is S)
    | ((element: T) => boolean)
    | undefined,
): S | null {
  return elements.reduce(
    (acc, element) => {
      if (
        (!filter || filter(element)) &&
        (acc === null || comparator(element, acc) < 0)
      ) {
        return element as S;
      }
      return acc;
    },
    null as S | null,
  );
}
