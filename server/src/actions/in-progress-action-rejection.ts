import type { CohortExpression } from "@alliance/common/cohort-expression";
import { BadRequestException } from "@nestjs/common";
import { countBy } from "es-toolkit";

export enum CohortExpressionOwner {
  Action = "action",
  FollowUpForm = "follow_up_form",
  ImportedAction = "imported_action",
}

const IN_PROGRESS_ACTION_HINTS: Record<CohortExpressionOwner, string> = {
  [CohortExpressionOwner.Action]:
    " Add the action as a prerequisite to wait for it.",
  [CohortExpressionOwner.FollowUpForm]: "",
  [CohortExpressionOwner.ImportedAction]: "",
};

/**
 * Distinct actions whose `InProgressAction` leaves `next` has more of than
 * `stored`. Prerequisites replace the leaf, so only existing uses may stay,
 * wherever they move in the tree.
 */
export function findAddedInProgressActionIds(params: {
  stored: CohortExpression | null;
  next: CohortExpression;
}): number[] {
  const inProgressActionIds = (expr: CohortExpression): number[] => {
    switch (expr.type) {
      case "InProgressAction":
        return [expr.actionId];
      case "AND":
      case "OR":
        return expr.children.flatMap(inProgressActionIds);
      case "NOT":
        return inProgressActionIds(expr.child);
      case "Tag":
      case "Manual":
      case "CompletedAction":
      case "MissedActionDeadline":
      case "FormFieldValue":
      case "GroupLead":
      case "USMember":
      case "NonUSMember":
        return [];
      default:
        throw new Error(
          `unknown cohort expression: ${JSON.stringify(expr satisfies never)}`,
        );
    }
  };
  const remaining = countBy(
    params.stored ? inProgressActionIds(params.stored) : [],
    (id) => id,
  );
  const added = new Set<number>();
  for (const id of inProgressActionIds(params.next)) {
    if (remaining[id] > 0) remaining[id] -= 1;
    else added.add(id);
  }
  return [...added];
}

export function assertNoAddedInProgressActions(params: {
  stored: CohortExpression | null;
  next: CohortExpression;
  owner: CohortExpressionOwner;
}): void {
  const added = findAddedInProgressActionIds(params);
  if (added.length > 0) {
    throw new BadRequestException(
      `In-Progress Action conditions can't be added anymore (action ids: ${added.join(", ")}).${IN_PROGRESS_ACTION_HINTS[params.owner]}`,
    );
  }
}
