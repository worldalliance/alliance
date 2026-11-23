import { SPLIT_LAUNCH_REFUSED } from "@alliance/common/suite-split";
import { BadRequestException, ConflictException } from "@nestjs/common";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { Action } from "src/actions/entities/action.entity";
import { In, type EntityManager } from "typeorm";
import { SuiteSplit } from "./entities/suite-split.entity";
import { impliedOptional } from "./split-groups";
import { currentSplitVersion } from "./split-store";

/**
 * Waits out a convert or save of the actions' suites, which lock the suite
 * row, so the split read after it sees what they committed; a convert or save
 * that starts later waits for the writer and then reads its writes.
 */
async function lockSuitesOf(
  manager: EntityManager,
  actionIds: readonly number[],
): Promise<void> {
  await manager.query(
    `SELECT 1 FROM action_suite WHERE id IN (SELECT "suiteId" FROM action WHERE id = ANY($1)) FOR SHARE`,
    [actionIds],
  );
}

/**
 * Refuses, inside the writing transaction, a change that leaves an action of
 * a split suite with a `member_action` event: split suites can't launch yet.
 * Writers of events or of an action's suite call it after their writes.
 */
export async function assertNoSplitLaunch(
  manager: EntityManager,
  actionIds: readonly number[],
): Promise<void> {
  if (actionIds.length === 0) return;
  await lockSuitesOf(manager, actionIds);
  const launched = await manager
    .createQueryBuilder(ActionEvent, "event")
    .innerJoin("event.action", "action")
    .innerJoin(SuiteSplit, "split", 'split."suiteId" = action."suiteId"')
    .where("action.id IN (:...actionIds)", { actionIds })
    .andWhere('event."newStatus" = :status', {
      status: ActionStatus.MemberAction,
    })
    .getExists();
  if (launched) throw new ConflictException(SPLIT_LAUNCH_REFUSED);
}

export const SPLIT_ACTION_FIELDS =
  "In a suite that uses groups, the grid decides who takes part and what's optional. Clear this action's participants and prerequisites, and set optional work in the suite's groups.";

/**
 * Refuses, inside the writing transaction, leaving an action of a split suite
 * with its own cohort rule or prerequisites, or, unless it is `entering` the
 * suite, with an optional flag the grid doesn't imply. An entering action
 * takes the flag the grid implies. Writers of those fields or of an action's
 * suite call it after their writes.
 */
export async function followSplitGrid(
  manager: EntityManager,
  params: { actionIds: readonly number[]; entering: boolean },
): Promise<void> {
  const { actionIds, entering } = params;
  if (actionIds.length === 0) return;
  await lockSuitesOf(manager, actionIds);
  const actions = await manager.find(Action, {
    where: { id: In([...actionIds]) },
    relations: { suite: true },
  });
  const splitSuiteIds = new Set(
    (
      await manager.find(SuiteSplit, {
        where: {
          suiteId: In(
            actions.flatMap(({ suite }) => (suite ? [suite.id] : [])),
          ),
        },
      })
    ).map(({ suiteId }) => suiteId),
  );
  for (const action of actions) {
    if (!action.suite || !splitSuiteIds.has(action.suite.id)) continue;
    if (
      action.cohortExpression !== null ||
      action.prerequisiteActionIds.length > 0
    ) {
      throw new BadRequestException(SPLIT_ACTION_FIELDS);
    }
    const version = await currentSplitVersion(manager, action.suite.id);
    const optional = impliedOptional(version?.groups ?? [], action.id);
    if (action.optional === optional) continue;
    if (!entering) throw new BadRequestException(SPLIT_ACTION_FIELDS);
    await manager.update(Action, action.id, { optional });
  }
}

export const SPLIT_CORRECTION_REFUSED =
  "In a suite that uses groups, members move between groups rather than having one action's decision changed.";

/** Refuses correcting one action's decision of a split suite. */
export async function assertNotSplitAction(
  manager: EntityManager,
  actionId: number,
): Promise<void> {
  const split = await manager
    .createQueryBuilder(Action, "action")
    .innerJoin(SuiteSplit, "split", 'split."suiteId" = action."suiteId"')
    .where("action.id = :actionId", { actionId })
    .getExists();
  if (split) throw new ConflictException(SPLIT_CORRECTION_REFUSED);
}
