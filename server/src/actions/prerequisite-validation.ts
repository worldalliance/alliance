import { R, type Result } from "@alliance/common/result";
import { BadRequestException } from "@nestjs/common";
import { ArrayContains, In, Raw, type EntityManager } from "typeorm";
import { Action } from "./entities/action.entity";

export type PrerequisiteNode = {
  id: number;
  name: string;
  prerequisiteActionIds: number[];
  deadline: Date | null;
};

/**
 * Check every prerequisite edge touching the changed actions. A prerequisite
 * needs a deadline that comes before its dependent's, or a member could wait
 * forever or become ready after the dependent closed.
 *
 * @param actions Every action with prerequisites, and every action an edge
 *   touching a changed action names.
 */
export function checkPrerequisites(params: {
  actions: ReadonlyMap<number, PrerequisiteNode>;
  changedIds: number[];
}): Result<void, string> {
  const { actions, changedIds } = params;
  for (const id of changedIds) {
    const cycle = findCycleThrough(id, actions);
    if (cycle) {
      const names = cycle.map((step) => `"${actions.get(step)?.name}"`);
      return R.failure(`Prerequisites can't loop: ${names.join(" → ")}.`);
    }
  }
  const changed = new Set(changedIds);
  for (const dependent of actions.values()) {
    for (const upstreamId of dependent.prerequisiteActionIds) {
      if (!changed.has(dependent.id) && !changed.has(upstreamId)) continue;
      const upstream = actions.get(upstreamId);
      if (!upstream) {
        return R.failure(
          `"${dependent.name}" has a prerequisite, #${upstreamId}, that doesn't exist.`,
        );
      }
      if (!upstream.deadline) {
        return R.failure(
          `"${upstream.name}" needs a deadline to be a prerequisite of "${dependent.name}".`,
        );
      }
      if (dependent.deadline && upstream.deadline >= dependent.deadline) {
        return R.failure(
          `"${upstream.name}" is a prerequisite of "${dependent.name}", so its deadline must come first.`,
        );
      }
    }
  }
  return R.success(undefined);
}

function findCycleThrough(
  start: number,
  actions: ReadonlyMap<number, PrerequisiteNode>,
): number[] | null {
  const visited = new Set<number>();
  const walk = (id: number, path: number[]): number[] | null => {
    for (const next of actions.get(id)?.prerequisiteActionIds ?? []) {
      if (next === start) return [...path, next];
      if (visited.has(next)) continue;
      visited.add(next);
      const found = walk(next, [...path, next]);
      if (found) return found;
    }
    return null;
  };
  return walk(start, [start]);
}

// Serializes the checks, so two concurrent writes can't each pass against
// the other's uncommitted state. Held until the transaction ends, so a waiting
// check then reads the first write's committed rows. Every caller takes it
// after its own writes; taking it before one would deadlock against a writer
// holding that row and waiting here.
const lockPrerequisiteGraph = (em: EntityManager) =>
  em.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
    "action-prerequisites",
  ]);

/**
 * Run inside the transaction that changed prerequisites or schedules, after
 * the change, so a violation rolls it back.
 */
export async function assertPrerequisitesValid(params: {
  em: EntityManager;
  actionIds: number[];
}): Promise<void> {
  const { em, actionIds } = params;
  await lockPrerequisiteGraph(em);
  const withPrerequisites = await em.find(Action, {
    where: {
      prerequisiteActionIds: Raw((column) => `cardinality(${column}) > 0`),
    },
    select: { id: true, prerequisiteActionIds: true },
  });
  const ids = new Set([
    ...actionIds,
    ...withPrerequisites.flatMap((action) => [
      action.id,
      ...action.prerequisiteActionIds,
    ]),
  ]);
  const actions = await em.find(Action, {
    where: { id: In([...ids]) },
    relations: { events: true },
  });
  const result = checkPrerequisites({
    actions: new Map(
      actions.map((action) => [
        action.id,
        {
          id: action.id,
          name: action.name,
          prerequisiteActionIds: action.prerequisiteActionIds,
          deadline: action.memberActionPhase.deadlineEvent?.date ?? null,
        },
      ]),
    ),
    changedIds: actionIds,
  });
  if (!result.ok) throw new BadRequestException(result.error);
}

/**
 * An action other actions wait for can't be deleted out from under them. Run
 * inside the deleting transaction, after the delete.
 */
export async function assertNotAPrerequisite(params: {
  em: EntityManager;
  actionId: number;
}): Promise<void> {
  const { em, actionId } = params;
  await lockPrerequisiteGraph(em);
  const dependents = await em.find(Action, {
    where: { prerequisiteActionIds: ArrayContains([actionId]) },
    select: { id: true, name: true },
  });
  if (dependents.length > 0) {
    throw new BadRequestException(
      `This action is a prerequisite of ${dependents.map((action) => `"${action.name}"`).join(", ")}. Remove it from their prerequisites first.`,
    );
  }
}
