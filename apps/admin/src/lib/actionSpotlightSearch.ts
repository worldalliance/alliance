import type {
  ActionCategory,
  AdminActionListItemDto,
} from "@alliance/shared/client";
import { matchSorter } from "match-sorter";
import { launchTime } from "./actionTimelineData";

export const SPOTLIGHT_RESULT_LIMIT = 8;

export type SpotlightAction = Pick<
  AdminActionListItemDto,
  "id" | "name" | "slug" | "category" | "project" | "events"
>;

const ACTION_CATEGORIES: Record<
  ActionCategory,
  { label: string; order: number }
> = {
  environment: { label: "Environment", order: 0 },
  poverty: { label: "Poverty", order: 1 },
  democracy: { label: "Democracy", order: 2 },
  technology: { label: "Technology", order: 3 },
  meta: { label: "Meta", order: 4 },
};

export const actionCategoryLabel = (category: ActionCategory) =>
  ACTION_CATEGORIES[category].label;

export type CategoryCount = { category: ActionCategory; count: number };

export const categoryCounts = (actions: SpotlightAction[]): CategoryCount[] => {
  const counts = new Map<ActionCategory, number>();
  for (const action of actions) {
    for (const category of action.category) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([category, count]) => ({ category, count }))
    .sort(
      (a, b) =>
        ACTION_CATEGORIES[a.category].order -
        ACTION_CATEGORIES[b.category].order,
    );
};

export const matchingCategories = (
  categories: CategoryCount[],
  query: string,
): CategoryCount[] =>
  query === ""
    ? categories
    : matchSorter(categories, query, {
        keys: [({ category }) => actionCategoryLabel(category)],
        baseSort: (a, b) => a.index - b.index,
      });

export const searchActions = <A extends SpotlightAction>({
  actions,
  query,
  category,
}: {
  actions: A[];
  query: string;
  category: ActionCategory | null;
}): A[] => {
  const pool = category
    ? actions.filter((action) => action.category.includes(category))
    : actions;
  if (query === "") {
    return category
      ? [...pool]
          .sort((a, b) => launchTime(b.events) - launchTime(a.events))
          .slice(0, SPOTLIGHT_RESULT_LIMIT)
      : [];
  }
  const byId = pool.filter((action) => String(action.id) === query.trim());
  const byName = matchSorter(
    pool.filter((action) => !byId.includes(action)),
    query,
    { keys: ["name"] },
  );
  const listed = new Set([...byId, ...byName]);
  const byOther = matchSorter(
    pool.filter((action) => !listed.has(action)),
    query,
    { keys: ["slug", (action) => action.project?.name ?? ""] },
  );
  return [...byId, ...byName, ...byOther].slice(0, SPOTLIGHT_RESULT_LIMIT);
};
