import { createHash } from 'crypto';
import jsonStableStringify from 'json-stable-stringify';
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops the root `title` from stored form schemas. It duplicated `form.title`
 * (the column every reader actually uses) and nothing read it, so the two were
 * free to drift — and on production data they had. `formSchema` is a
 * `strictObject`, so the leftover key would now be rejected on the next save.
 *
 * The snapshot `hash` is content-addressed (sha256 of a stable stringify) and
 * unique, so every rewritten row has its hash recomputed. Two snapshots that
 * differed only by title collapse onto one hash; that case is handled by
 * repointing the duplicate's references at the surviving row and deleting it.
 * Verified against staging (a copy of production): 1344 rows change, 0
 * collisions.
 *
 * Rows are processed in id-keyset batches so the migration never loads the
 * whole table into memory (the app box and RDS instance are small).
 */
export class StripFormSchemaTitle1786064937264 implements MigrationInterface {
  private static readonly BATCH_SIZE = 200;

  public async up(queryRunner: QueryRunner): Promise<void> {
    let lastId = 0;
    let updated = 0;
    let merged = 0;
    for (;;) {
      const rows: { id: number; schema: Record<string, unknown> }[] =
        await queryRunner.query(
          `SELECT id, schema FROM form_snapshot
           WHERE id > $1 ORDER BY id ASC LIMIT $2`,
          [lastId, StripFormSchemaTitle1786064937264.BATCH_SIZE],
        );
      if (rows.length === 0) break;

      for (const row of rows) {
        lastId = row.id;
        if (!(row.schema && 'title' in row.schema)) continue;

        const cleaned = { ...row.schema };
        delete cleaned.title;
        const hash = hashSchema(cleaned);

        const existing: { id: number }[] = await queryRunner.query(
          `SELECT id FROM form_snapshot WHERE hash = $1 AND id <> $2`,
          [hash, row.id],
        );
        if (existing.length > 0) {
          await mergeInto(queryRunner, row.id, existing[0].id);
          merged++;
          continue;
        }

        await queryRunner.query(
          `UPDATE form_snapshot SET schema = $1::jsonb, hash = $2 WHERE id = $3`,
          [JSON.stringify(cleaned), hash, row.id],
        );
        updated++;
      }
    }
    console.log(
      `[strip-form-schema-title] rewrote ${updated} snapshots, merged ${merged} duplicates`,
    );
  }

  public async down(): Promise<void> {
    // Irreversible: the stripped title is dead data with no reader, and the
    // originals are not retained. `form.title` still holds the real one.
  }
}

// --- self-contained transform (frozen; must not import app code) ------------

function hashSchema(schema: unknown): string {
  return createHash('sha256')
    .update(jsonStableStringify(schema) ?? '')
    .digest('hex');
}

/**
 * Folds a snapshot that became byte-identical to `survivorId` into it. Join
 * tables can already hold the survivor for the same owner, hence the
 * conflict-tolerant inserts.
 */
async function mergeInto(
  queryRunner: QueryRunner,
  duplicateId: number,
  survivorId: number,
): Promise<void> {
  await queryRunner.query(
    `UPDATE form SET "formSnapshotId" = $1 WHERE "formSnapshotId" = $2`,
    [survivorId, duplicateId],
  );
  await queryRunner.query(
    `UPDATE form_response SET "formSnapshotId" = $1 WHERE "formSnapshotId" = $2`,
    [survivorId, duplicateId],
  );
  await queryRunner.query(
    `UPDATE general_update SET "schemaSnapshotId" = $1 WHERE "schemaSnapshotId" = $2`,
    [survivorId, duplicateId],
  );
  await queryRunner.query(
    `INSERT INTO form_snapshot_history ("formId", "formSnapshotId")
     SELECT "formId", $1 FROM form_snapshot_history WHERE "formSnapshotId" = $2
     ON CONFLICT DO NOTHING`,
    [survivorId, duplicateId],
  );
  await queryRunner.query(
    `INSERT INTO general_update_snapshot_history ("generalUpdateId", "schemaSnapshotId")
     SELECT "generalUpdateId", $1 FROM general_update_snapshot_history
     WHERE "schemaSnapshotId" = $2
     ON CONFLICT DO NOTHING`,
    [survivorId, duplicateId],
  );
  await queryRunner.query(`DELETE FROM form_snapshot WHERE id = $1`, [
    duplicateId,
  ]);
}
