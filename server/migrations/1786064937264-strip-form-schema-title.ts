import { createHash } from 'crypto';
import jsonStableStringify from 'json-stable-stringify';
import { MigrationInterface, QueryRunner } from 'typeorm';

const BATCH_SIZE = 200;

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
 * A row whose current hash equals some other row's *cleaned* hash necessarily
 * has no `title` of its own, so it is never itself a candidate for rewriting —
 * that's what makes a whole batch safe to update in one statement despite the
 * unique index on `hash`.
 *
 * The first staging attempt of this migration blocked on a query and sat there
 * until the deploy's SSH session was killed at its 10-minute limit — no error,
 * so the deploy script's rollback trap never fired either. Hence the shape
 * here: statement/lock timeouts so a block fails fast and rolls back, batched
 * queries so the transaction holds its locks for seconds rather than minutes,
 * and the `title` filter so a retry skips whatever a previous run finished.
 */
export class StripFormSchemaTitle1786064937264 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    await queryRunner.query(`SET LOCAL statement_timeout = '120s'`);

    let lastId = 0;
    let updated = 0;
    let merged = 0;
    for (;;) {
      const rows: { id: number; schema: Record<string, unknown> }[] =
        await queryRunner.query(
          `SELECT id, schema FROM form_snapshot
           WHERE jsonb_exists(schema, 'title') AND id > $1
           ORDER BY id ASC LIMIT $2`,
          [lastId, BATCH_SIZE],
        );
      if (rows.length === 0) break;
      lastId = rows[rows.length - 1].id;

      const cleaned = rows.map((row) => {
        const schema = { ...row.schema };
        delete schema.title;
        return { id: row.id, hash: hashSchema(schema) };
      });

      const existing: { id: number; hash: string }[] = await queryRunner.query(
        `SELECT id, hash FROM form_snapshot
         WHERE hash = ANY($1::text[]) AND NOT (id = ANY($2::int[]))`,
        [cleaned.map((row) => row.hash), cleaned.map((row) => row.id)],
      );

      const survivorByHash = new Map(existing.map((row) => [row.hash, row.id]));
      const updates: { id: number; hash: string }[] = [];
      const duplicates: { duplicateId: number; survivorId: number }[] = [];
      for (const row of cleaned) {
        const survivorId = survivorByHash.get(row.hash);
        if (survivorId !== undefined) {
          duplicates.push({ duplicateId: row.id, survivorId });
          continue;
        }
        survivorByHash.set(row.hash, row.id);
        updates.push(row);
      }

      if (updates.length > 0) {
        // `schema - 'title'` runs server-side so the schemas never travel back
        // over the wire — the CLI logs every parameter, and these are large.
        await queryRunner.query(
          `UPDATE form_snapshot fs
           SET schema = fs.schema - 'title'::text, hash = v.hash
           FROM unnest($1::int[], $2::text[]) AS v(id, hash)
           WHERE fs.id = v.id`,
          [updates.map((row) => row.id), updates.map((row) => row.hash)],
        );
        updated += updates.length;
      }

      for (const duplicate of duplicates) {
        await mergeInto(
          queryRunner,
          duplicate.duplicateId,
          duplicate.survivorId,
        );
        merged++;
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
