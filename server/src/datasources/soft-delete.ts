import { NotFoundException } from "@nestjs/common";
import {
  type EntityManager,
  type EntityMetadata,
  type EntityTarget,
  type FindOptionsWhere,
  type ObjectLiteral,
  type QueryDeepPartialEntity,
} from "typeorm";
import type { ForeignKeyMetadata } from "typeorm/metadata/ForeignKeyMetadata";

type RowId = number | string;

export type LiveRow = { target: EntityTarget<ObjectLiteral>; id: RowId };

type ReferenceStep = {
  foreignKey: ForeignKeyMetadata;
  parentIds: RowId[];
};

export class SoftDeleteRestrictedError extends Error {}

/**
 * `ON DELETE SET NULL` references a soft delete leaves in place, keyed
 * `Entity.relation`, for readers that still need the hidden row.
 */
const KEPT_REFERENCES: ReadonlySet<string> = new Set([
  // Unread messages keep starting after a read message once it is hidden.
  "Participant.lastReadMessage",
  // A reply keeps its quote for a restore; reads already hide a deleted target.
  "Message.replyTo",
  // A signup keeps its invite link for the link's signup totals and a restore.
  "User.referredByShareUrl",
]);

function isKeptReference(foreignKey: ForeignKeyMetadata): boolean {
  const relation = foreignKey.entityMetadata.relations.find((candidate) =>
    candidate.foreignKeys.includes(foreignKey),
  );
  return (
    relation !== undefined &&
    KEPT_REFERENCES.has(
      `${foreignKey.entityMetadata.name}.${relation.propertyName}`,
    )
  );
}

function quote(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function primaryColumnName(metadata: EntityMetadata): string {
  const [primary, ...rest] = metadata.primaryColumns;
  if (!primary || rest.length > 0) {
    throw new Error(`${metadata.name} needs exactly one primary column`);
  }
  return primary.databaseName;
}

function deleteDateColumnName(metadata: EntityMetadata): string {
  if (!metadata.deleteDateColumn) {
    throw new Error(`${metadata.name} has no delete date column`);
  }
  return metadata.deleteDateColumn.databaseName;
}

function foreignKeyColumnName(foreignKey: ForeignKeyMetadata): string {
  const [column, ...rest] = foreignKey.columns;
  if (!column || rest.length > 0) {
    throw new Error(
      `${foreignKey.entityMetadata.name}.${foreignKey.name} needs exactly one column`,
    );
  }
  return column.databaseName;
}

function referencingForeignKeys(
  manager: EntityManager,
  metadata: EntityMetadata,
): ForeignKeyMetadata[] {
  return manager.connection.entityMetadatas.flatMap((candidate) =>
    candidate.foreignKeys.filter(
      (foreignKey) => foreignKey.referencedEntityMetadata === metadata,
    ),
  );
}

/**
 * Marks rows deleted and applies, as updates, what their foreign keys'
 * `ON DELETE` actions did when the rows were physically deleted:
 *
 * - CASCADE marks referencing rows deleted, recursively, including rows a
 *   prior deletion already marked. Rows of a table without a delete date
 *   (join tables, transient records) are physically deleted.
 * - SET NULL detaches referencing rows outside this deletion.
 * - RESTRICT and NO ACTION throw {@link SoftDeleteRestrictedError} while a
 *   live referencing row outside this deletion remains.
 *
 * Rows already marked keep their original deletion time. Runs inside the
 * caller's transaction when there is one, and locks every row it marks
 * `FOR UPDATE`, so a writer holding a parent through {@link lockLive} cannot
 * attach a child mid-deletion. Resolves to how many of `ids` were live once
 * locked, which is how many this deletion marked.
 */
export async function softDeleteCascade<Entity extends ObjectLiteral>(
  manager: EntityManager,
  params: { target: EntityTarget<Entity>; ids: readonly RowId[] },
): Promise<number> {
  if (params.ids.length === 0) return 0;
  if (!manager.queryRunner?.isTransactionActive) {
    return manager.transaction((transactional) =>
      softDeleteCascade(transactional, params),
    );
  }
  const root = manager.connection.getMetadata(params.target);

  const locked: { live: boolean }[] = await manager.query(
    `SELECT ${quote(deleteDateColumnName(root))} IS NULL AS live FROM ${quote(root.tableName)} WHERE ${quote(primaryColumnName(root))} = ANY($1) FOR UPDATE`,
    [params.ids],
  );

  const marked = new Map<EntityMetadata, Set<RowId>>();
  const removals: ReferenceStep[] = [];
  const detaches: ReferenceStep[] = [];
  const restrictions: ReferenceStep[] = [];
  const queue: { metadata: EntityMetadata; ids: RowId[] }[] = [
    { metadata: root, ids: [...params.ids] },
  ];
  marked.set(root, new Set(params.ids));

  for (let next = queue.shift(); next; next = queue.shift()) {
    for (const foreignKey of referencingForeignKeys(manager, next.metadata)) {
      const step = { foreignKey, parentIds: next.ids };
      switch (foreignKey.onDelete) {
        case "CASCADE": {
          const child = foreignKey.entityMetadata;
          if (!child.deleteDateColumn) {
            if (referencingForeignKeys(manager, child).length > 0) {
              throw new Error(
                `${child.name} is deleted physically but other rows reference it`,
              );
            }
            removals.push(step);
            break;
          }
          const rows: { id: RowId }[] = await manager.query(
            `SELECT ${quote(primaryColumnName(child))} AS id FROM ${quote(child.tableName)} WHERE ${quote(foreignKeyColumnName(foreignKey))} = ANY($1) FOR UPDATE`,
            [next.ids],
          );
          const seen = marked.get(child) ?? new Set<RowId>();
          marked.set(child, seen);
          const fresh = rows.map((row) => row.id).filter((id) => !seen.has(id));
          fresh.forEach((id) => seen.add(id));
          if (fresh.length > 0) queue.push({ metadata: child, ids: fresh });
          break;
        }
        case "SET NULL":
          if (!isKeptReference(foreignKey)) detaches.push(step);
          break;
        case "RESTRICT":
        case "NO ACTION":
        case undefined:
          restrictions.push(step);
          break;
        case "DEFAULT":
          throw new Error(
            `unsupported ON DELETE DEFAULT on ${foreignKey.entityMetadata.name}`,
          );
        default:
          throw new Error(
            `unknown ON DELETE: ${foreignKey.onDelete satisfies never}`,
          );
      }
    }
  }

  // A condition on `metadata`'s rows this deletion leaves in place, whose
  // parameters number from $2. An undated table's rows all count.
  const survivors = (
    metadata: EntityMetadata,
  ): { condition: string; params: RowId[][] } =>
    metadata.deleteDateColumn
      ? {
          condition: `NOT (${quote(primaryColumnName(metadata))} = ANY($2))`,
          params: [[...(marked.get(metadata) ?? [])]],
        }
      : { condition: "TRUE", params: [] };

  for (const { foreignKey, parentIds } of restrictions) {
    const child = foreignKey.entityMetadata;
    const { condition, params } = survivors(child);
    const live = child.deleteDateColumn
      ? ` AND ${quote(child.deleteDateColumn.databaseName)} IS NULL`
      : "";
    const [{ blocked }]: { blocked: boolean }[] = await manager.query(
      `SELECT EXISTS (SELECT 1 FROM ${quote(child.tableName)} WHERE ${quote(foreignKeyColumnName(foreignKey))} = ANY($1) AND ${condition}${live}) AS blocked`,
      [parentIds, ...params],
    );
    if (blocked) {
      throw new SoftDeleteRestrictedError(
        `${child.name} rows still reference the ${foreignKey.referencedEntityMetadata.name} being deleted`,
      );
    }
  }

  for (const { foreignKey, parentIds } of detaches) {
    const child = foreignKey.entityMetadata;
    const column = quote(foreignKeyColumnName(foreignKey));
    const { condition, params } = survivors(child);
    await manager.query(
      `UPDATE ${quote(child.tableName)} SET ${column} = NULL WHERE ${column} = ANY($1) AND ${condition}`,
      [parentIds, ...params],
    );
  }

  for (const { foreignKey, parentIds } of removals) {
    await manager.query(
      `DELETE FROM ${quote(foreignKey.entityMetadata.tableName)} WHERE ${quote(foreignKeyColumnName(foreignKey))} = ANY($1)`,
      [parentIds],
    );
  }

  for (const [metadata, ids] of marked) {
    if (ids.size === 0) continue;
    const deletedAt = quote(deleteDateColumnName(metadata));
    await manager.query(
      `UPDATE ${quote(metadata.tableName)} SET ${deletedAt} = now() WHERE ${quote(primaryColumnName(metadata))} = ANY($1) AND ${deletedAt} IS NULL`,
      [[...ids]],
    );
  }
  return locked.filter((row) => row.live).length;
}

/** {@link softDeleteCascade} for the live rows matching `where`; resolves to
 * how many it marked. */
export async function softDeleteWhere<Entity extends ObjectLiteral>(
  manager: EntityManager,
  params: { target: EntityTarget<Entity>; where: FindOptionsWhere<Entity> },
): Promise<number> {
  const metadata = manager.connection.getMetadata(params.target);
  const [primary] = metadata.primaryColumns;
  const rows = await manager.find(params.target, { where: params.where });
  const ids = rows.map((row): RowId => primary.getEntityValue(row));
  return softDeleteCascade(manager, { target: params.target, ids });
}

/**
 * Takes on each row the lock a foreign key check takes, which a deletion's
 * `FOR UPDATE` waits on, and reports whether every row is live. A writer that
 * inserts a reference after this in the same transaction cannot attach it to
 * a row deleted meanwhile.
 *
 * Holds only against a deleter that locks the row `FOR UPDATE`, as `DELETE`
 * and {@link softDeleteCascade} do. A plain update setting `deletedAt` takes
 * a weaker lock that does not wait on this one.
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
 * undo a deletion committed since the load. Reports whether it was live. */
export async function updateLive<
  T extends ObjectLiteral & { deletedAt: Date | null },
>(
  manager: EntityManager,
  params: {
    target: new () => T;
    id: RowId;
    changes: QueryDeepPartialEntity<T>;
  },
): Promise<boolean> {
  const { affected } = await manager
    .createQueryBuilder()
    .update(params.target)
    .set(params.changes)
    .where('id = :id AND "deletedAt" IS NULL', { id: params.id })
    .execute();
  return affected === 1;
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
 * Runs `write` once every parent is {@link lockLive | locked live} and
 * `saved`, the row a save of a loaded copy writes back, is locked
 * `FOR UPDATE` (or its `lock` mode): that save would otherwise undo a deletion
 * committed since the load. Parents are locked before `saved`, the order a
 * cascading deletion takes them.
 *
 * Joins the manager's transaction, or opens one. A gone row throws
 * `NotFoundException` with its own `notFound` message, else the shared one,
 * else one naming the gone row's entity.
 */
export function writeUnderLive<T>(
  manager: EntityManager,
  params: {
    parents?: Array<LiveRow & { notFound?: string }>;
    notFound?: string;
    saved?: LiveRow & {
      notFound?: string;
      lock?: "pessimistic_write" | "for_no_key_update";
    };
    write: (manager: EntityManager) => Promise<T>;
  },
): Promise<T> {
  const { parents = [], notFound, saved, write } = params;
  const notFoundFor = (em: EntityManager, row: LiveRow, message?: string) =>
    new NotFoundException(
      message ?? `${em.connection.getMetadata(row.target).name} not found`,
    );
  const guarded = async (em: EntityManager): Promise<T> => {
    const gone = await firstGone(em, parents);
    if (gone) throw notFoundFor(em, gone, gone.notFound ?? notFound);
    if (
      saved &&
      !(await em.exists(saved.target, {
        where: { id: saved.id },
        lock: { mode: saved.lock ?? "pessimistic_write" },
      }))
    ) {
      throw notFoundFor(em, saved, saved.notFound ?? notFound);
    }
    return write(em);
  };
  return manager.queryRunner?.isTransactionActive
    ? guarded(manager)
    : manager.transaction(guarded);
}
