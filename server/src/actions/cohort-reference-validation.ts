import {
  collectCohortDependencies,
  type CohortExpression,
} from "@alliance/common/cohort-expression";
import { BadRequestException } from "@nestjs/common";
import { isUUID } from "class-validator";
import { In, type EntityManager } from "typeorm";
import { Tag } from "../user/entities/tag.entity";
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

/**
 * A Tag leaf naming no existing tag, or none at all, silently matches nobody.
 * Ids `previous` already names pass, so a tag deleted under a saved cohort
 * doesn't block unrelated edits to its action or follow-up form.
 */
export async function assertTagsExist(params: {
  em: EntityManager;
  expression: CohortExpression;
  previous?: CohortExpression;
}): Promise<void> {
  const { em, expression, previous } = params;
  const kept = collectCohortDependencies(previous).tagIds;
  const tagIds = [...collectCohortDependencies(expression).tagIds].filter(
    (id) => !kept.has(id),
  );
  const uuids = tagIds.filter((id) => isUUID(id));
  const found = new Set(
    uuids.length === 0
      ? []
      : (
          await em.find(Tag, { select: { id: true }, where: { id: In(uuids) } })
        ).map((tag) => tag.id),
  );
  const missing = tagIds.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new BadRequestException(
      `No tag has id ${missing.map((id) => `"${id}"`).join(", ")}. Every Tag condition in the cohort must name an existing tag.`,
    );
  }
}
