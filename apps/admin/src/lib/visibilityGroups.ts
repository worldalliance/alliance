import type { Page, PageItem } from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { withBlockVisibility } from "./blockVisibility";
import { stableStringify } from "./schemaDiff";
import { DropPosition } from "./useDragReorder";

/**
 * Builder-only grouping of consecutive top-level page elements that share one
 * visibility condition, as element id → group key. Never part of the schema:
 * each member still carries its own `visibleIfFormula`.
 */
export type VisibilityGroups = ReadonlyMap<string, string>;

export enum SegmentKind {
  Single = "single",
  Group = "group",
}

export enum NeighborDirection {
  Previous = "previous",
  Next = "next",
}

export type PageSegment =
  | { kind: SegmentKind.Single; index: number }
  | { kind: SegmentKind.Group; key: string; start: number; end: number };

const newGroupKey = () => crypto.randomUUID();

export function sameVisibility(
  a: VisibleIfFormula | undefined,
  b: VisibleIfFormula | undefined,
): boolean {
  return a != null && b != null && stableStringify(a) === stableStringify(b);
}

type Run = { key: string; ids: string[] };

function collectRuns(
  fields: PageItem[],
  keyOf: (id: string) => string | undefined,
): Run[] {
  const runs: Run[] = [];
  let run: (Run & { formula: VisibleIfFormula }) | null = null;
  for (const element of fields) {
    const formula = element.visibleIfFormula;
    const key = element.id ? keyOf(element.id) : undefined;
    if (
      run &&
      element.id &&
      key !== undefined &&
      key === run.key &&
      sameVisibility(run.formula, formula)
    ) {
      run.ids.push(element.id);
      continue;
    }
    if (run && run.ids.length >= 2) runs.push(run);
    run =
      element.id && key !== undefined && formula
        ? { key, ids: [element.id], formula }
        : null;
  }
  if (run && run.ids.length >= 2) runs.push(run);
  return runs;
}

/** Maximal runs of at least two elements with matching, present conditions. */
export function deriveVisibilityGroups(pages: Page[]): VisibilityGroups {
  const groups = new Map<string, string>();
  for (const page of pages) {
    // Every element proposes the same key, so runs split only on conditions.
    for (const run of collectRuns(page.fields, () => "")) {
      const key = newGroupKey();
      for (const id of run.ids) groups.set(id, key);
    }
  }
  return groups;
}

/**
 * Keeps each group a consecutive, uniform run of at least two: a member whose
 * condition no longer matches, or a non-member placed between members, splits
 * the group, and the first remaining run keeps its key.
 */
export function normalizeVisibilityGroups(
  pages: Page[],
  groups: VisibilityGroups,
): VisibilityGroups {
  const next = new Map<string, string>();
  const usedKeys = new Set<string>();
  for (const page of pages) {
    for (const run of collectRuns(page.fields, (id) => groups.get(id))) {
      const key = usedKeys.has(run.key) ? newGroupKey() : run.key;
      usedKeys.add(key);
      for (const id of run.ids) next.set(id, key);
    }
  }
  const unchanged =
    next.size === groups.size &&
    [...next].every(([id, key]) => groups.get(id) === key);
  return unchanged ? groups : next;
}

export function pageSegments(
  fields: PageItem[],
  groups: VisibilityGroups,
): PageSegment[] {
  const segments: PageSegment[] = [];
  fields.forEach((element, index) => {
    const key = element.id ? groups.get(element.id) : undefined;
    const last = segments.at(-1);
    if (key === undefined) {
      segments.push({ kind: SegmentKind.Single, index });
    } else if (last?.kind === SegmentKind.Group && last.key === key) {
      last.end = index + 1;
    } else {
      segments.push({
        kind: SegmentKind.Group,
        key,
        start: index,
        end: index + 1,
      });
    }
  });
  return segments;
}

function groupMemberIds(groups: VisibilityGroups, key: string): Set<string> {
  return new Set([...groups].filter(([, k]) => k === key).map(([id]) => id));
}

function withoutIds(
  groups: VisibilityGroups,
  ids: ReadonlySet<string>,
): Map<string, string> {
  return new Map([...groups].filter(([id]) => !ids.has(id)));
}

function withVisibility({
  pages,
  ids,
  formula,
}: {
  pages: Page[];
  ids: ReadonlySet<string>;
  formula: VisibleIfFormula | undefined;
}): Page[] {
  return pages.map((page) => ({
    ...page,
    fields: page.fields.map((element) => {
      if (!element.id || !ids.has(element.id)) return element;
      if (element.type === "display") {
        return withBlockVisibility(element, formula);
      }
      const { visibleIfFormula: _previous, ...rest } = element;
      return formula ? { ...rest, visibleIfFormula: formula } : rest;
    }),
  }));
}

export type GroupedPages = { pages: Page[]; groups: VisibilityGroups };

/** Members from `fields[index]` on leave for a group of their own. */
export function splitGroup(
  groups: VisibilityGroups,
  params: { fields: PageItem[]; key: string; index: number },
): VisibilityGroups {
  const { fields, key, index } = params;
  const next = new Map(groups);
  const splitKey = newGroupKey();
  for (const element of fields.slice(index)) {
    if (element.id && groups.get(element.id) === key) {
      next.set(element.id, splitKey);
    }
  }
  return next;
}

export function detachMember(
  groups: VisibilityGroups,
  id: string,
): VisibilityGroups {
  return withoutIds(groups, new Set([id]));
}

export function ungroup(
  groups: VisibilityGroups,
  key: string,
): VisibilityGroups {
  return withoutIds(groups, groupMemberIds(groups, key));
}

/** Clearing the condition dissolves the group. */
export function setGroupVisibility({
  pages,
  groups,
  key,
  formula,
}: GroupedPages & {
  key: string;
  formula: VisibleIfFormula | undefined;
}): GroupedPages {
  const ids = groupMemberIds(groups, key);
  return {
    pages: withVisibility({ pages, ids, formula }),
    groups: formula ? groups : withoutIds(groups, ids),
  };
}

/**
 * The element adopts its neighbor's condition and joins the neighbor's group,
 * or forms a new one with a conditional neighbor outside any group.
 */
export function joinNeighbor({
  pages,
  groups,
  element,
  neighbor,
}: GroupedPages & { element: PageItem; neighbor: PageItem }): GroupedPages {
  if (!element.id || !neighbor.id || !neighbor.visibleIfFormula) {
    throw new Error(
      "join needs two elements with ids and a neighbor condition",
    );
  }
  const key = groups.get(neighbor.id) ?? newGroupKey();
  return {
    pages: withVisibility({
      pages,
      ids: new Set([element.id]),
      formula: neighbor.visibleIfFormula,
    }),
    groups: new Map(groups).set(neighbor.id, key).set(element.id, key),
  };
}

export function mergeGroups({
  pages,
  groups,
  previousKey,
  nextKey,
  formula,
}: GroupedPages & {
  previousKey: string;
  nextKey: string;
  formula: VisibleIfFormula;
}): GroupedPages {
  const ids = new Set([
    ...groupMemberIds(groups, previousKey),
    ...groupMemberIds(groups, nextKey),
  ]);
  const next = new Map(groups);
  for (const id of ids) next.set(id, previousKey);
  return { pages: withVisibility({ pages, ids, formula }), groups: next };
}

/**
 * Where one step `direction` takes the element at `index`: past its neighbor,
 * or past the whole of a group it doesn't belong to, so stepping never lands
 * inside another group and splits it. Null at the page's edge.
 */
export function stepPast({
  fields,
  groups,
  index,
  direction,
}: {
  fields: PageItem[];
  groups: VisibilityGroups;
  index: number;
  direction: NeighborDirection;
}): { dropIndex: number; position: DropPosition } | null {
  const forward = direction === NeighborDirection.Next;
  const neighborIndex = index + (forward ? 1 : -1);
  const neighbor = fields[neighborIndex];
  if (!neighbor) return null;
  const keyOf = (element: PageItem | undefined) =>
    element?.id ? groups.get(element.id) : undefined;
  const neighborKey = keyOf(neighbor);
  const group =
    neighborKey !== undefined && neighborKey !== keyOf(fields[index])
      ? pageSegments(fields, groups).find(
          (segment) =>
            segment.kind === SegmentKind.Group && segment.key === neighborKey,
        )
      : undefined;
  const dropIndex =
    group?.kind === SegmentKind.Group
      ? forward
        ? group.end - 1
        : group.start
      : neighborIndex;
  return {
    dropIndex,
    position: forward ? DropPosition.After : DropPosition.Before,
  };
}
