import type { ParsedSplit } from "./entities/action-suite-split.entity";
import type { ParsedAction } from "./entities/action.entity";
import { splitPrerequisiteActionIds } from "./suite-split";

type SplitArms = {
  id: number;
  arms: Pick<ParsedSplit["arms"][number], "actionId">[];
};

export function splitIdByArm(splits: SplitArms[]): Map<number, number> {
  return new Map(
    splits.flatMap((split) =>
      split.arms.map((arm) => [arm.actionId, split.id] as const),
    ),
  );
}

/**
 * Makes each arm among `actions` wait on every sibling arm's prerequisites,
 * so a member is routed once all of them have settled. Mutates `actions`,
 * which must be fresh loads the caller doesn't save.
 */
export function awaitSplitPrerequisites(params: {
  actions: Pick<ParsedAction, "id" | "prerequisiteActionIds">[];
  splits: SplitArms[];
}): void {
  const { actions, splits } = params;
  const byId = new Map(actions.map((action) => [action.id, action]));
  for (const split of splits) {
    const arms = split.arms.flatMap((arm) => {
      const action = byId.get(arm.actionId);
      return action ? [action] : [];
    });
    if (arms.length === 0) continue;
    if (arms.length !== split.arms.length) {
      throw new Error(`Loaded only some arms of split ${split.id}`);
    }
    const union = splitPrerequisiteActionIds(arms);
    for (const arm of arms) arm.prerequisiteActionIds = union;
  }
}

/**
 * Groups the arms of each split so a writer decides them together, keeping
 * `items`' order otherwise. A group takes its last arm's place, after
 * everything any of its arms reads.
 */
export function groupSplitArms<T extends { action: { id: number } }>(
  items: T[],
  splitIdByArm: ReadonlyMap<number, number>,
): T[][] {
  const lastIndex = new Map<number, number>();
  items.forEach((item, index) => {
    const splitId = splitIdByArm.get(item.action.id);
    if (splitId !== undefined) lastIndex.set(splitId, index);
  });
  return items.flatMap((item, index) => {
    const splitId = splitIdByArm.get(item.action.id);
    if (splitId === undefined) return [[item]];
    if (lastIndex.get(splitId) !== index) return [];
    return [
      items.filter((other) => splitIdByArm.get(other.action.id) === splitId),
    ];
  });
}
