import {
  elementRuns,
  splitGroupRuns,
} from "@alliance/common/forms/form-groups";
import type { PageItem } from "@alliance/common/forms/form-schema";

const newGroupId = () => crypto.randomUUID();

function withGroup<T extends PageItem>(element: T, group: string | undefined) {
  const next = { ...element };
  if (group === undefined) delete next.group;
  else next.group = group;
  return next;
}

/** The run of the group the element at `index` is in, or null. */
export function groupRunAt(fields: readonly PageItem[], index: number) {
  return (
    elementRuns(fields).find(
      (run) => run.group !== undefined && index >= run.start && index < run.end,
    ) ?? null
  );
}

/** Whether the element at `index` opens and closes its group's run, or null outside one. */
export function groupEdges(fields: readonly PageItem[], index: number) {
  const group = fields[index]?.group;
  return group === undefined
    ? null
    : {
        first: fields[index - 1]?.group !== group,
        last: fields[index + 1]?.group !== group,
      };
}

/** Each group's runs after its first get fresh ids, so every group stays one run. */
function splitApart(fields: PageItem[]): PageItem[] {
  const renamed = new Map<number, string>();
  for (const { start, end } of splitGroupRuns(fields)) {
    const group = newGroupId();
    for (let index = start; index < end; index++) renamed.set(index, group);
  }
  return fields.map((element, index) =>
    renamed.has(index) ? withGroup(element, renamed.get(index)) : element,
  );
}

/**
 * Puts `start` up to `end` into a new group, or takes them out of theirs with
 * `group: null`. A group the change cuts through splits in two.
 */
export function regroup({
  fields,
  start,
  end,
  group,
}: {
  fields: readonly PageItem[];
  start: number;
  end: number;
  group: "new" | null;
}): PageItem[] {
  const id = group === "new" ? newGroupId() : undefined;
  return splitApart(
    fields.map((element, index) =>
      index >= start && index < end ? withGroup(element, id) : element,
    ),
  );
}

/**
 * Settles the group of the elements just placed at `start` up to `end`: between
 * two members of one group they join it; otherwise each keeps its group only
 * while still next to the rest of it, on this page and on `left`, the page it
 * came from if another.
 */
export function settlePlaced({
  fields,
  start,
  end,
  left = [],
}: {
  fields: readonly PageItem[];
  start: number;
  end: number;
  left?: readonly PageItem[];
}): PageItem[] {
  const around = fields[start - 1]?.group;
  const stale = new Set([
    ...splitGroupRuns(fields).map((run) => run.group),
    ...left.map((element) => element.group),
  ]);
  return fields.map((element, index) => {
    if (index < start || index >= end) return element;
    if (around !== undefined && around === fields[end]?.group) {
      return withGroup(element, around);
    }
    return element.group !== undefined && stale.has(element.group)
      ? withGroup(element, undefined)
      : element;
  });
}

/**
 * Settles the group of the element just inserted at `index`: between two
 * members of one group it joins it, and it keeps its own only beside another
 * member, as a duplicate is.
 */
export function settleInserted(
  fields: readonly PageItem[],
  index: number,
): PageItem[] {
  const before = fields[index - 1]?.group;
  const after = fields[index + 1]?.group;
  const own = fields[index]?.group;
  const group =
    before !== undefined && before === after
      ? before
      : own !== undefined && (own === before || own === after)
        ? own
        : undefined;
  return fields.map((element, at) =>
    at === index ? withGroup(element, group) : element,
  );
}

/** The elements with each group given a fresh id, as a copied page needs. */
export function withFreshGroupIds(fields: readonly PageItem[]): PageItem[] {
  const fresh = new Map<string, string>();
  return fields.map((element) => {
    if (element.group === undefined) return element;
    if (!fresh.has(element.group)) fresh.set(element.group, newGroupId());
    return withGroup(element, fresh.get(element.group));
  });
}
