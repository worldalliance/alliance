import { PARTITION_LAUNCH_REFUSED } from "@alliance/common/suite-partition";
import { BadRequestException, ConflictException } from "@nestjs/common";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { Action } from "src/actions/entities/action.entity";
import { In, type EntityManager } from "typeorm";
import { SuitePartition } from "./entities/suite-partition.entity";
import { impliedOptional } from "./partition-parts";
import { currentPartitionVersion } from "./partition-store";

/**
 * Waits out a convert or save of the actions' suites, which lock the suite
 * row, so the partition read after it sees what they committed; a convert or save
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
 * a partitioned suite with a `member_action` event: partitioned suites can't launch yet.
 * Writers of events or of an action's suite call it after their writes.
 */
export async function assertNoPartitionLaunch(
  manager: EntityManager,
  actionIds: readonly number[],
): Promise<void> {
  if (actionIds.length === 0) return;
  await lockSuitesOf(manager, actionIds);
  const launched = await manager
    .createQueryBuilder(ActionEvent, "event")
    .innerJoin("event.action", "action")
    .innerJoin(
      SuitePartition,
      "partition",
      'partition."suiteId" = action."suiteId"',
    )
    .where("action.id IN (:...actionIds)", { actionIds })
    .andWhere('event."newStatus" = :status', {
      status: ActionStatus.MemberAction,
    })
    .getExists();
  if (launched) throw new ConflictException(PARTITION_LAUNCH_REFUSED);
}

export const PARTITION_ACTION_FIELDS =
  "In a partitioned suite, the partition decides who gets each action and whether it's optional. Clear this action's participants and prerequisites, and set optional work in the suite's partition.";

/**
 * Refuses, inside the writing transaction, leaving an action of a partitioned suite
 * with its own cohort rule or prerequisites, or, unless it is `entering` the
 * suite, with an optional flag the grid doesn't imply. An entering action
 * takes the flag the grid implies. Writers of those fields or of an action's
 * suite call it after their writes.
 */
export async function followGrid(
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
  const partitionSuiteIds = new Set(
    (
      await manager.find(SuitePartition, {
        where: {
          suiteId: In(
            actions.flatMap(({ suite }) => (suite ? [suite.id] : [])),
          ),
        },
      })
    ).map(({ suiteId }) => suiteId),
  );
  for (const action of actions) {
    if (!action.suite || !partitionSuiteIds.has(action.suite.id)) continue;
    if (
      action.cohortExpression !== null ||
      action.prerequisiteActionIds.length > 0
    ) {
      throw new BadRequestException(PARTITION_ACTION_FIELDS);
    }
    const version = await currentPartitionVersion(manager, action.suite.id);
    const optional = impliedOptional(version?.parts ?? [], action.id);
    if (action.optional === optional) continue;
    if (!entering) throw new BadRequestException(PARTITION_ACTION_FIELDS);
    await manager.update(Action, action.id, { optional });
  }
}

export const PARTITION_CORRECTION_REFUSED =
  "In a partitioned suite, staff move members between parts rather than changing one action's decision.";

/** Refuses correcting one action's decision of a partitioned suite. */
export async function assertNotPartitionAction(
  manager: EntityManager,
  actionId: number,
): Promise<void> {
  const partition = await manager
    .createQueryBuilder(Action, "action")
    .innerJoin(
      SuitePartition,
      "partition",
      'partition."suiteId" = action."suiteId"',
    )
    .where("action.id = :actionId", { actionId })
    .getExists();
  if (partition) throw new ConflictException(PARTITION_CORRECTION_REFUSED);
}
