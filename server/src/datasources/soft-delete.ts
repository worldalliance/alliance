import { NotFoundException } from "@nestjs/common";
import {
  type EntityManager,
  type EntityTarget,
  type ObjectLiteral,
} from "typeorm";

type RowId = number | string;

export type LiveRow = { target: EntityTarget<ObjectLiteral>; id: RowId };

/**
 * Takes on each row the lock a foreign key check takes, which a deletion's
 * `FOR UPDATE` waits on, and reports whether every row is live. A writer that
 * inserts a reference after this in the same transaction cannot attach it to
 * a row deleted meanwhile.
 *
 * Holds only against a deleter that locks the row `FOR UPDATE`, as `DELETE`
 * does. A plain update setting `deletedAt` takes a weaker lock that does not
 * wait on this one.
 */
export async function lockLive(
  manager: EntityManager,
  rows: LiveRow[],
): Promise<boolean> {
  return (await firstGone(manager, rows)) === null;
}

/** {@link lockLive}, throwing `gone()` when a row is deleted. */
export async function assertLive(
  manager: EntityManager,
  params: { rows: LiveRow[]; gone: () => Error },
): Promise<void> {
  if (await firstGone(manager, params.rows)) throw params.gone();
}

// Outside a transaction the lock ends with its own statement.
function assertTransaction(manager: EntityManager): void {
  if (!manager.queryRunner?.isTransactionActive) {
    throw new Error("lockLive needs a transaction");
  }
}

/** The ids among `ids` whose `target` rows are live, each {@link lockLive |
 * locked} in one statement. */
export async function lockLiveIds<Id extends RowId>(
  manager: EntityManager,
  params: { target: EntityTarget<ObjectLiteral>; ids: Id[] },
): Promise<Set<Id>> {
  const { target, ids } = params;
  assertTransaction(manager);
  if (ids.length === 0) return new Set();
  // One array parameter, as a pass can lock more ids than a statement takes
  // parameters; raw rows, as an entity load also runs its relation id loaders.
  const live: { id: RowId }[] = await manager
    .createQueryBuilder(target, "row")
    .select("row.id", "id")
    .where("row.id = ANY(:ids)", { ids })
    .orderBy("row.id", "ASC")
    .setLock("for_key_share")
    .getRawMany();
  // Postgres matches a uuid in any case but returns it lowercase.
  const isUuid =
    manager.connection.getMetadata(target).primaryColumns[0].type === "uuid";
  const key = (id: RowId) =>
    isUuid && typeof id === "string" ? id.toLowerCase() : id;
  const liveKeys = new Set(live.map((row) => key(row.id)));
  return new Set(ids.filter((id) => liveKeys.has(key(id))));
}

async function firstGone<R extends LiveRow>(
  manager: EntityManager,
  rows: R[],
): Promise<R | null> {
  assertTransaction(manager);
  // One statement per run of a target keeps the caller's lock order across
  // targets.
  const runs: R[][] = [];
  for (const row of rows) {
    const run = runs.at(-1);
    if (run?.[0].target === row.target) run.push(row);
    else runs.push([row]);
  }
  for (const run of runs) {
    const liveIds = await lockLiveIds(manager, {
      target: run[0].target,
      ids: run.map((row) => row.id),
    });
    const gone = run.find((row) => !liveIds.has(row.id));
    if (gone) return gone;
  }
  return null;
}

/** The row, locked {@link lockLive | live}, or null once it is deleted. */
export async function liveOrNull<T extends { id?: RowId }>(params: {
  manager: EntityManager;
  target: EntityTarget<ObjectLiteral>;
  row: T | null | undefined;
}): Promise<T | null | undefined> {
  const { manager, target, row } = params;
  if (row?.id === undefined) return row;
  return (await lockLive(manager, [{ target, id: row.id }])) ? row : null;
}

/**
 * Runs `write` once every parent is {@link lockLive | locked live}.
 *
 * Joins the manager's transaction, or opens one. A gone parent throws
 * `NotFoundException` with its own `notFound` message, else the shared one,
 * else one naming the gone row's entity.
 */
export function writeUnderLive<T>(
  manager: EntityManager,
  params: {
    parents: Array<LiveRow & { notFound?: string }>;
    notFound?: string;
    write: (manager: EntityManager) => Promise<T>;
  },
): Promise<T> {
  const { parents, notFound, write } = params;
  const guarded = async (em: EntityManager): Promise<T> => {
    const gone = await firstGone(em, parents);
    if (gone) {
      throw new NotFoundException(
        gone.notFound ??
          notFound ??
          `${em.connection.getMetadata(gone.target).name} not found`,
      );
    }
    return write(em);
  };
  return manager.queryRunner?.isTransactionActive
    ? guarded(manager)
    : manager.transaction(guarded);
}
