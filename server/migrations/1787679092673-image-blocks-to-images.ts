import { createHash } from "crypto";

import jsonStableStringify from "json-stable-stringify";
import { MigrationInterface, QueryRunner } from "typeorm";

import {
  convertImageBlocks,
  type ConversionDirection,
} from "./lib/image-blocks-to-images";

// Dropping `expandable` can give two snapshots the same content hash. The
// unique index requires merging their references before deleting the duplicate.
//
// `down` restores the block shape but not the duplicates, and empty alt text
// comes back as `""` rather than absent. Neither is recoverable from what `up`
// leaves behind.
//
// The deployment command has a 10-minute timeout that also covers install,
// restart, and health checks. A timeout bypasses the deploy script's rollback,
// so batches keep locks short and avoid loading the full table on db.t3.micro.

const BATCH_SIZE = 200;

// `$.**` is lax recursive descent, Postgres 12+; RDS and CI both run 17. The
// filter keeps the scan to rows that can actually change, so a schema with no
// image blocks is never read or shipped over the wire.
const KIND_TO_FIND: Record<ConversionDirection, string> = {
  up: "image",
  down: "images",
};

// `owner` identifies join-table pairs that may already reference the survivor.
const SNAPSHOT_REFERENCES = [
  { table: "form", column: "formSnapshotId", owner: null },
  { table: "form_response", column: "formSnapshotId", owner: null },
  { table: "general_update", column: "schemaSnapshotId", owner: null },
  { table: "action_update", column: "schemaSnapshotId", owner: null },
  { table: "form_snapshot_history", column: "formSnapshotId", owner: "formId" },
  {
    table: "general_update_snapshot_history",
    column: "schemaSnapshotId",
    owner: "generalUpdateId",
  },
  {
    table: "action_update_snapshot_history",
    column: "schemaSnapshotId",
    owner: "actionUpdateId",
  },
] as const;

function hashSchema(schema: unknown): string {
  return createHash("sha256")
    .update(jsonStableStringify(schema) ?? "")
    .digest("hex");
}

async function mergeSnapshot(
  queryRunner: QueryRunner,
  duplicateId: number,
  survivingId: number,
): Promise<void> {
  for (const { table, column, owner } of SNAPSHOT_REFERENCES) {
    if (owner) {
      await queryRunner.query(
        `DELETE FROM "${table}" dup WHERE dup."${column}" = $1 AND EXISTS (
           SELECT 1 FROM "${table}" kept
           WHERE kept."${owner}" = dup."${owner}" AND kept."${column}" = $2
         )`,
        [duplicateId, survivingId],
      );
    }
    await queryRunner.query(
      `UPDATE "${table}" SET "${column}" = $2 WHERE "${column}" = $1`,
      [duplicateId, survivingId],
    );
  }
  await queryRunner.query(`DELETE FROM "form_snapshot" WHERE "id" = $1`, [
    duplicateId,
  ]);
}

async function migrateFormSnapshots(
  queryRunner: QueryRunner,
  direction: ConversionDirection,
): Promise<void> {
  await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
  await queryRunner.query(`SET LOCAL statement_timeout = '120s'`);

  let lastId = 0;
  let rewritten = 0;
  let merged = 0;
  for (;;) {
    const rows: { id: number; payload: unknown }[] = await queryRunner.query(
      `SELECT id, "schema" AS payload FROM "form_snapshot"
       WHERE id > $1 AND jsonb_path_exists("schema", $2::jsonpath)
       ORDER BY id ASC LIMIT $3`,
      [lastId, `$.**.kind ? (@ == "${KIND_TO_FIND[direction]}")`, BATCH_SIZE],
    );
    if (rows.length === 0) break;
    // The cursor advances even over rows the walk leaves alone (a matching
    // `kind` somewhere it doesn't convert), so the loop always terminates.
    lastId = rows[rows.length - 1].id;

    const changed: { id: number; schema: string; hash: string }[] = [];
    for (const row of rows) {
      if (row.payload === null || row.payload === undefined) continue;
      const before = JSON.stringify(row.payload);
      convertImageBlocks(row.payload, direction);
      const after = JSON.stringify(row.payload);
      if (before === after) continue;
      changed.push({
        id: row.id,
        schema: after,
        hash: hashSchema(row.payload),
      });
    }
    if (changed.length === 0) continue;

    // Rows being rewritten are excluded because they still hold their old
    // hash; every other row in the table owns whatever hash it carries.
    const existing: { id: number; hash: string }[] = await queryRunner.query(
      `SELECT id, hash FROM "form_snapshot"
       WHERE hash = ANY($1::text[]) AND NOT (id = ANY($2::int[]))`,
      [changed.map((row) => row.hash), changed.map((row) => row.id)],
    );
    const survivorByHash = new Map(existing.map((row) => [row.hash, row.id]));

    for (const row of changed) {
      const survivor = survivorByHash.get(row.hash);
      if (survivor === undefined) {
        survivorByHash.set(row.hash, row.id);
        await queryRunner.query(
          `UPDATE "form_snapshot" SET "schema" = $1::jsonb, "hash" = $2 WHERE "id" = $3`,
          [row.schema, row.hash, row.id],
        );
        rewritten++;
        continue;
      }
      await mergeSnapshot(queryRunner, row.id, survivor);
      merged++;
    }
  }

  console.log(
    `[image-blocks-to-images] ${direction}: rewrote ${rewritten} snapshots, merged ${merged} duplicates`,
  );
}

export class ImageBlocksToImages1787679092673 implements MigrationInterface {
  name = "ImageBlocksToImages1787679092673";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await migrateFormSnapshots(queryRunner, "up");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await migrateFormSnapshots(queryRunner, "down");
  }
}
