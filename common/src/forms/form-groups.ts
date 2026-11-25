import { z } from "zod";

/** Consecutive page elements sharing an id render as one grey box. */
export const formGroupSchema = z.string().min(1);

/** A maximal run of consecutive elements with the same group, or with none. */
export type ElementRun = {
  group: string | undefined;
  start: number;
  end: number;
};

export function elementRuns(
  elements: readonly { group?: string }[],
): ElementRun[] {
  const runs: ElementRun[] = [];
  elements.forEach(({ group }, index) => {
    const last = runs.at(-1);
    if (last !== undefined && last.group === group) last.end = index + 1;
    else runs.push({ group, start: index, end: index + 1 });
  });
  return runs;
}

/** Each group's runs after its first, which make the group invalid. */
export function splitGroupRuns(
  elements: readonly { group?: string }[],
): ElementRun[] {
  const seen = new Set<string>();
  return elementRuns(elements).filter(({ group }) => {
    if (group === undefined) return false;
    if (seen.has(group)) return true;
    seen.add(group);
    return false;
  });
}
