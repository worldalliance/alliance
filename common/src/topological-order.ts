import { R, type Result } from "./result";

/**
 * The items `roots` reach, each after the items it depends on, or the items
 * along a cycle, ending where it started. Ids `itemOf` doesn't know are
 * skipped.
 */
export function topologicalOrder<T extends NonNullable<unknown>>({
  roots,
  itemOf,
  dependenciesOf,
}: {
  roots: Iterable<string>;
  itemOf: (id: string) => T | undefined;
  dependenciesOf: (item: T) => Iterable<string>;
}): Result<T[], T[]> {
  const ordered: T[] = [];
  const done = new Set<string>();
  const path: { id: string; item: T }[] = [];
  const visit = (id: string): T[] | undefined => {
    if (done.has(id)) return undefined;
    const item = itemOf(id);
    if (item === undefined) return undefined;
    const start = path.findIndex((step) => step.id === id);
    if (start !== -1) {
      return [...path.slice(start).map((step) => step.item), item];
    }
    path.push({ id, item });
    for (const dependency of dependenciesOf(item)) {
      const cycle = visit(dependency);
      if (cycle !== undefined) return cycle;
    }
    path.pop();
    done.add(id);
    ordered.push(item);
    return undefined;
  };
  for (const root of roots) {
    const cycle = visit(root);
    if (cycle !== undefined) return R.failure(cycle);
  }
  return R.success(ordered);
}
