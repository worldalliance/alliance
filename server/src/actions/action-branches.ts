import type { CohortExpression } from "@alliance/common/cohort-expression";
import type {
  ActionBranch,
  ParsedActionBranch,
} from "./entities/action-branch.entity";
import type { Action } from "./entities/action.entity";

/** An action's cohort as decisions apply it: on a branched action, a member must also match a branch. */
export function routedCohortExpression(
  cohortExpression: CohortExpression | null,
  branches: readonly ParsedActionBranch[],
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

export function sortBranches<T extends Pick<ActionBranch, "id" | "position">>(
  branches: T[],
): T[] {
  return branches.sort((a, b) => a.position - b.position || a.id - b.id);
}

export function firstMatchingBranchIds(params: {
  branches: readonly Pick<ActionBranch, "id">[];
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

/** The form a member was assigned, and the branch whose copy they see, if any. */
export type AssignedForm = {
  formId: number;
  branch: ActionBranch | null;
};

export function applyAssignedForm(
  action: Action,
  { formId, branch }: AssignedForm,
): void {
  action.taskFormId = formId;
  if (!branch) return;
  action.name = branch.nameOverride ?? action.name;
  action.shortDescription =
    branch.shortDescriptionOverride ?? action.shortDescription;
  action.body = branch.bodyOverride ?? action.body;
  action.timeEstimate = branch.timeEstimateOverride ?? action.timeEstimate;
  action.image = branch.imageOverride ?? action.image;
  action.squareThumbnailImage =
    branch.squareThumbnailImageOverride ?? action.squareThumbnailImage;
  action.squareThumbnailImageAlt =
    branch.squareThumbnailImageAltOverride ?? action.squareThumbnailImageAlt;
}
