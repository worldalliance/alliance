import { lockLiveIds } from "src/datasources/soft-delete";
import type { EntityManager } from "typeorm";
import type { ActionFormAssignment } from "./entities/action-form-assignment.entity";
import { ActionFormVariant } from "./entities/action-form-variant.entity";
import { Action } from "./entities/action.entity";

type AssignmentInsert = Pick<
  ActionFormAssignment,
  "actionId" | "userId" | "variantId"
>;

/**
 * The assignments among `inserts` whose action and variant are live, locked
 * until `em`'s transaction ends. An assignment to an action or variant deleted
 * meanwhile would stay live and never be re-randomized.
 */
export async function liveAssignments<T extends AssignmentInsert>(
  em: EntityManager,
  inserts: T[],
): Promise<T[]> {
  // Actions before variants, the order an action's deletion locks them.
  const liveActions = await lockLiveIds(em, {
    target: Action,
    ids: [...new Set(inserts.map((i) => i.actionId))],
  });
  const liveVariants = await lockLiveIds(em, {
    target: ActionFormVariant,
    ids: [...new Set(inserts.flatMap((i) => i.variantId ?? []))],
  });
  return inserts.filter(
    (i) =>
      liveActions.has(i.actionId) &&
      (i.variantId === null || liveVariants.has(i.variantId)),
  );
}

export function variantForNewAssignment(params: {
  variants: ActionFormVariant[];
  submittedFormId: number | undefined;
}): number | null {
  const { variants, submittedFormId } = params;
  if (submittedFormId === undefined) {
    return pickVariantForNewUser(variants);
  }
  return variants.find((v) => v.formId === submittedFormId)?.id ?? null;
}

function pickVariantForNewUser(variants: ActionFormVariant[]): number | null {
  if (variants.length === 0) return null;

  const r = Math.random();
  let acc = 0;
  for (const v of variants) {
    acc += v.splitValue;
    if (r < acc) return v.id;
  }
  return null;
}
