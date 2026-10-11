import { NotFoundException } from "@nestjs/common";
import {
  type EntityManager,
  type EntityTarget,
  type ObjectLiteral,
  type QueryDeepPartialEntity,
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

/** Updates the row only while it is live, since a save of a loaded copy would
 * undo a deletion committed since the load. Reports whether it was live, or
 * throws `NotFoundException(notFound)` when it was not and `notFound` is set. */
export async function updateLive<
  T extends ObjectLiteral & { deletedAt: Date | null },
>(
  manager: EntityManager,
  params: {
    target: new () => T;
    id: RowId;
    changes: QueryDeepPartialEntity<T>;
    notFound?: string;
  },
): Promise<boolean> {
  const { affected } = await manager
    .createQueryBuilder()
    .update(params.target)
    .set(params.changes)
    .where('id = :id AND "deletedAt" IS NULL', { id: params.id })
    .execute();
  if (affected !== 1 && params.notFound !== undefined) {
    throw new NotFoundException(params.notFound);
  }
  return affected === 1;
}

// Outside a transaction the lock ends with its own statement.
function assertTransaction(manager: EntityManager): void {
  if (!manager.queryRunner?.isTransactionActive) {
    throw new Error("row locks need an active transaction");
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
 * Locks `row` `FOR NO KEY UPDATE` and reports whether it is live. A save of a
 * loaded copy needs this first, as it would otherwise undo a deletion
 * committed since the load. The lock waits on a deletion without blocking
 * rows attaching to `row`.
 */
export async function lockForSave(
  manager: EntityManager,
  row: LiveRow,
): Promise<boolean> {
  assertTransaction(manager);
  return manager.exists(row.target, {
    where: { id: row.id },
    lock: { mode: "for_no_key_update" },
  });
}

/**
 * Runs `write` once every parent is {@link lockLive | locked live} and
 * `saved`, the row a save of a loaded copy writes back, is
 * {@link lockForSave | locked for the save}. Parents are locked before
 * `saved`, the order a cascading deletion takes them.
 *
 * Joins the manager's transaction, or opens one. A gone row throws
 * `NotFoundException` with its own `notFound` message, else the shared one,
 * else one naming the gone row's entity in words.
 */
export function writeUnderLive<T>(
  manager: EntityManager,
  params: {
    parents?: Array<LiveRow & { notFound?: string }>;
    notFound?: string;
    saved?: LiveRow & { notFound?: string };
    write: (manager: EntityManager) => Promise<T>;
  },
): Promise<T> {
  const { parents = [], notFound, saved, write } = params;
  const notFoundFor = (
    em: EntityManager,
    row: LiveRow & { notFound?: string },
  ) => {
    const entity = em.connection
      .getMetadata(row.target)
      .name.replace(/\B[A-Z]/g, (c) => ` ${c.toLowerCase()}`);
    return new NotFoundException(
      row.notFound ?? notFound ?? `${entity} not found`,
    );
  };
  const guarded = async (em: EntityManager): Promise<T> => {
    const gone = await firstGone(em, parents);
    if (gone) throw notFoundFor(em, gone);
    if (saved && !(await lockForSave(em, saved))) {
      throw notFoundFor(em, saved);
    }
    return write(em);
  };
  return manager.queryRunner?.isTransactionActive
    ? guarded(manager)
    : manager.transaction(guarded);
}
