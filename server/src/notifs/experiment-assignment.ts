import { randomInt } from "crypto";
import { chunk } from "es-toolkit";
import { Raw, type EntityManager } from "typeorm";
import {
  Experiment,
  ExperimentArm,
  ExperimentAssignment,
} from "./entities/experiment-assignment.entity";

// Postgres caps a statement at 65535 bind parameters; a row binds three.
const INSERT_CHUNK = 1000;

/** Each member's arm, drawn 50/50 the first time and kept from then on. */
export async function assignExperimentArms(
  em: EntityManager,
  params: { experiment: Experiment; userIds: readonly number[] },
): Promise<Map<number, ExperimentArm>> {
  const { experiment, userIds } = params;
  for (const ids of chunk([...userIds], INSERT_CHUNK)) {
    await em
      .createQueryBuilder()
      .insert()
      .into(ExperimentAssignment)
      .values(
        ids.map((userId) => ({
          userId,
          experiment,
          arm:
            randomInt(2) === 0 ? ExperimentArm.Control : ExperimentArm.Variant,
        })),
      )
      .orIgnore()
      .execute();
  }
  // The unique index covers a deleted member's assignment, which the insert
  // then skips.
  const assignments = await em.find(ExperimentAssignment, {
    where: {
      experiment,
      userId: Raw((column) => `${column} = ANY(:userIds)`, { userIds }),
    },
    withDeleted: true,
  });
  return new Map(assignments.map(({ userId, arm }) => [userId, arm]));
}
