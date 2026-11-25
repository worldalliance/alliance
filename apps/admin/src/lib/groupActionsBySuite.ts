import type { AdminActionListItemDto } from "@alliance/shared/client";

type SuiteGroup<T> = { id: number | null; name: string; actions: T[] };

/**
 * Suites in the order of their first unarchived action in `actions`, with
 * suites holding only archived actions last.
 */
export function groupBySuite<
  T extends Pick<AdminActionListItemDto, "archived" | "suite">,
>(actions: T[]): SuiteGroup<T>[] {
  const suites = new Map<number | null, SuiteGroup<T>>();
  for (const action of actions) {
    const id = action.suite?.id ?? null;
    const suite = suites.get(id) ?? {
      id,
      name: action.suite?.name ?? "No suite",
      actions: [],
    };
    suite.actions.push(action);
    suites.set(id, suite);
  }
  const rank = (suite: SuiteGroup<T>) => {
    const live = suite.actions.find((action) => !action.archived);
    return live
      ? actions.indexOf(live)
      : actions.length + actions.indexOf(suite.actions[0]);
  };
  return [...suites.values()].sort((a, b) => rank(a) - rank(b));
}
