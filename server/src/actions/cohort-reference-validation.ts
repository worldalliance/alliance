import {
  collectCohortDependencies,
  type CohortExpression,
} from "@alliance/common/cohort-expression";
import { BadRequestException } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { Action, parseAction } from "./entities/action.entity";

/**
 * A cohort expression naming a deleted action silently matches nobody. Run
 * inside the deleting transaction, after the delete, so the action's own
 * expression and follow-up forms are already gone.
 */
export async function assertNotInACohort(params: {
  em: EntityManager;
  actionId: number;
}): Promise<void> {
  const { em, actionId } = params;
  const actions = (
    await em.find(Action, {
      relations: { followUpForms: true },
      select: {
        id: true,
        name: true,
        cohortExpression: true,
        followUpForms: { id: true, cohortExpression: true },
      },
      order: { id: "ASC" },
    })
  ).map(parseAction);
  const names = (expression: CohortExpression | null) =>
    collectCohortDependencies(expression).actionIds.has(actionId);
  const referrers = actions.flatMap((action) => [
    ...(names(action.cohortExpression) ? [`"${action.name}"`] : []),
    ...(action.followUpForms.some((form) => names(form.cohortExpression))
      ? [`a follow-up form of "${action.name}"`]
      : []),
  ]);
  if (referrers.length > 0) {
    throw new BadRequestException(
      `This action is named in the cohort of ${referrers.join(", ")}. Remove it from there first.`,
    );
  }
}
