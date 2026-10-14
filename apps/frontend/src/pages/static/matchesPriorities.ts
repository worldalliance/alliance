import type { ActionPriority } from "../../content/featuredImpactActions";

export function matchesPriorities(
  tags: readonly ActionPriority[],
  selected: readonly ActionPriority[],
): boolean {
  return selected.length === 0 || tags.some((tag) => selected.includes(tag));
}
