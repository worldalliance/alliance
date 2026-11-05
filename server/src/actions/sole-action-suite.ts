import type { EntityManager } from "typeorm";
import {
  ActionSuite,
  loadedActionSuiteActions,
} from "./entities/action-suite.entity";
import { Action } from "./entities/action.entity";

export const sharesSuite = (suite: ActionSuite, actionId: number) =>
  loadedActionSuiteActions(suite).some((action) => action.id !== actionId);

export async function renameSoleActionSuite(
  em: EntityManager,
  params: { suiteId: number; actionId: number; name: string },
): Promise<void> {
  const { suiteId, actionId, name } = params;
  const others = await em
    .createQueryBuilder(Action, "action")
    .where('action."suiteId" = :suiteId', { suiteId })
    .andWhere("action.id != :actionId", { actionId })
    .getCount();
  if (others === 0) await em.update(ActionSuite, suiteId, { name });
}
