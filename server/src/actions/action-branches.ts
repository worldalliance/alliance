import type { CohortExpression } from "@alliance/common/cohort-expression";
import type {
  ActionFormVariant,
  ParsedActionFormVariant,
} from "./entities/action-form-variant.entity";
import type { Action } from "./entities/action.entity";

export type ActionBranch = ParsedActionFormVariant & { rule: CohortExpression };

/** An action's cohort as decisions apply it: on a branched action, a member must also match a branch. */
export function routedCohortExpression(
  cohortExpression: CohortExpression | null,
  branches: readonly ActionBranch[],
): CohortExpression | null {
  if (cohortExpression == null || branches.length === 0) {
    return cohortExpression;
  }
  return {
    type: "AND",
    children: [
      cohortExpression,
      { type: "OR", children: branches.map((branch) => branch.rule) },
    ],
  };
}

export function isActionBranch(
  variant: ParsedActionFormVariant,
): variant is ActionBranch {
  return variant.rule != null;
}

export function sortBranches<T extends ActionBranch>(branches: T[]): T[] {
  return branches.sort((a, b) => a.position - b.position || a.id - b.id);
}

export function firstMatchingBranchIds(params: {
  branches: readonly ActionBranch[];
  matches: readonly ReadonlySet<number>[];
  userIds: Iterable<number>;
}): Map<number, number> {
  const { branches, ...rest } = params;
  return new Map(
    [...firstMatchIndexes(rest)].map(([userId, index]) => [
      userId,
      branches[index].id,
    ]),
  );
}

/** Each member's index of the first set holding them; members in none are absent. */
export function firstMatchIndexes(params: {
  matches: readonly ReadonlySet<number>[];
  userIds: Iterable<number>;
}): Map<number, number> {
  const { matches, userIds } = params;
  const indexByUser = new Map<number, number>();
  for (const userId of userIds) {
    const index = matches.findIndex((members) => members.has(userId));
    if (index >= 0) indexByUser.set(userId, index);
  }
  return indexByUser;
}

export function applyVariantToAction(
  action: Action,
  variant: ActionFormVariant,
): void {
  action.taskFormId = variant.formId;
  action.name = variant.nameOverride ?? action.name;
  action.shortDescription =
    variant.shortDescriptionOverride ?? action.shortDescription;
  action.body = variant.bodyOverride ?? action.body;
  action.timeEstimate = variant.timeEstimateOverride ?? action.timeEstimate;
  action.image = variant.imageOverride ?? action.image;
  action.squareThumbnailImage =
    variant.squareThumbnailImageOverride ?? action.squareThumbnailImage;
  action.squareThumbnailImageAlt =
    variant.squareThumbnailImageAltOverride ?? action.squareThumbnailImageAlt;
}
