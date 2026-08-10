import { createHash } from 'crypto';
import jsonStableStringify from 'json-stable-stringify';
import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  displayBlocksToMarkdown,
  markdownToDisplayBlocks,
} from './lib/action-update-markdown';

const CONTENT_FK = 'FK_891d217b99508a780a59d9e118c';
const SNAPSHOT_FK = 'FK_c414e1d9b6104aeb650cee77fbd';
const HISTORY_UPDATE_FK = 'FK_aede5f878f9b062c41183e4b541';
const HISTORY_SNAPSHOT_FK = 'FK_f1676d822f5defabb4fbc722a2d';

function hashSchema(schema: unknown): string {
  return createHash('sha256')
    .update(jsonStableStringify(schema) ?? '')
    .digest('hex');
}

export class ActionUpdateSchemaSnapshot1786385686467 implements MigrationInterface {
  name = 'ActionUpdateSchemaSnapshot1786385686467';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Generated as `NOT NULL`, which no existing row can satisfy. Added
    // nullable, backfilled, then tightened below.
    await queryRunner.query(
      `ALTER TABLE "action_update" ADD "schemaSnapshotId" integer`,
    );
    await queryRunner.query(
      `CREATE TABLE "action_update_snapshot_history" ("actionUpdateId" integer NOT NULL, "schemaSnapshotId" integer NOT NULL, CONSTRAINT "PK_cd2b6b6d708f0905096171ae855" PRIMARY KEY ("actionUpdateId", "schemaSnapshotId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_aede5f878f9b062c41183e4b54" ON "action_update_snapshot_history" ("actionUpdateId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f1676d822f5defabb4fbc722a2" ON "action_update_snapshot_history" ("schemaSnapshotId") `,
    );

    const updates: {
      id: number;
      body: string | null;
      attachments: string[] | null;
    }[] = await queryRunner.query(
      `SELECT au."id", ec."body", ec."attachments"
       FROM "action_update" au
       LEFT JOIN "editable_content" ec ON ec."id" = au."contentId"`,
    );

    for (const update of updates) {
      const schema = markdownToDisplayBlocks({
        body: update.body ?? '',
        attachments: update.attachments ?? [],
      });
      const snapshotId = await this.findOrCreateSnapshot(queryRunner, schema);

      await queryRunner.query(
        `UPDATE "action_update" SET "schemaSnapshotId" = $1 WHERE "id" = $2`,
        [snapshotId, update.id],
      );
      await queryRunner.query(
        `INSERT INTO "action_update_snapshot_history" ("actionUpdateId", "schemaSnapshotId")
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [update.id, snapshotId],
      );
    }

    await queryRunner.query(
      `ALTER TABLE "action_update" ALTER COLUMN "schemaSnapshotId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_update" ADD CONSTRAINT "${SNAPSHOT_FK}" FOREIGN KEY ("schemaSnapshotId") REFERENCES "form_snapshot"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_update_snapshot_history" ADD CONSTRAINT "${HISTORY_UPDATE_FK}" FOREIGN KEY ("actionUpdateId") REFERENCES "action_update"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_update_snapshot_history" ADD CONSTRAINT "${HISTORY_SNAPSHOT_FK}" FOREIGN KEY ("schemaSnapshotId") REFERENCES "form_snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );

    // Dropped only after the backfill has read through it. The `editable_content`
    // rows themselves are left in place, now unreferenced.
    await queryRunner.query(
      `ALTER TABLE "action_update" DROP CONSTRAINT "${CONTENT_FK}"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_update" DROP COLUMN "contentId"`,
    );

    // Authoring is now a second step after creation, so `visibleAt` becomes the
    // publish gate it was always named for: null until an admin writes the body,
    // set when they do. Every existing row was created with its body already in
    // place, so keeping the timestamps as they are publishes all of them.
    await queryRunner.query(
      `ALTER TABLE "action_update" ALTER COLUMN "visibleAt" DROP NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "action_update" ADD "notifiedAt" TIMESTAMP WITH TIME ZONE`,
    );
    // Existing updates all dispatched at creation time, so they are already
    // notified — without this the editor's new send button would offer to
    // notify their cohorts a second time.
    //
    // `notifyType` alone doesn't identify them: the old inline editor sent
    // `notifyType: 'none'` on every title/body edit, so an edited update reads
    // as never-notified however many members it reached. What the dispatch
    // actually wrote is the ground truth — in `notification` for updates that
    // predate unread content, and in `unread_content` since.
    await queryRunner.query(
      `UPDATE "action_update" au SET "notifiedAt" = au."visibleAt"
       WHERE au."notifyType" <> 'none'
          OR EXISTS (
            SELECT 1 FROM "unread_content" uc
            WHERE uc."contentType" = 'action_update' AND uc."contentId" = au."id"
          )
          OR EXISTS (
            SELECT 1 FROM "notification" n WHERE n."actionUpdateId" = au."id"
          )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "action_update" DROP COLUMN "notifiedAt"`,
    );

    // The old column was NOT NULL, and the old code read it as "already
    // visible". Unpublished drafts have no honest value here, so they become
    // visible on the way back down rather than blocking the revert.
    await queryRunner.query(
      `UPDATE "action_update" SET "visibleAt" = now() WHERE "visibleAt" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_update" ALTER COLUMN "visibleAt" SET NOT NULL`,
    );

    // Generated as `NOT NULL`; same reason as `schemaSnapshotId` on the way up.
    await queryRunner.query(
      `ALTER TABLE "action_update" ADD "contentId" integer`,
    );

    // The original markdown is gone, so each update gets a fresh
    // `editable_content` rendered back out of its blocks. The pre-migration
    // rows are still in the table, now unreferenced.
    const updates: { id: number; schema: unknown }[] = await queryRunner.query(
      `SELECT au."id", fs."schema"
         FROM "action_update" au
         JOIN "form_snapshot" fs ON fs."id" = au."schemaSnapshotId"`,
    );

    for (const update of updates) {
      const rows: { id: number }[] = await queryRunner.query(
        `INSERT INTO "editable_content" ("body", "attachments")
         VALUES ($1, '[]'::jsonb) RETURNING "id"`,
        [displayBlocksToMarkdown(update.schema)],
      );
      await queryRunner.query(
        `UPDATE "action_update" SET "contentId" = $1 WHERE "id" = $2`,
        [rows[0].id, update.id],
      );
    }

    await queryRunner.query(
      `ALTER TABLE "action_update" ALTER COLUMN "contentId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_update" ADD CONSTRAINT "${CONTENT_FK}" FOREIGN KEY ("contentId") REFERENCES "editable_content"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "action_update_snapshot_history" DROP CONSTRAINT "${HISTORY_SNAPSHOT_FK}"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_update_snapshot_history" DROP CONSTRAINT "${HISTORY_UPDATE_FK}"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_update" DROP CONSTRAINT "${SNAPSHOT_FK}"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f1676d822f5defabb4fbc722a2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_aede5f878f9b062c41183e4b54"`,
    );
    await queryRunner.query(`DROP TABLE "action_update_snapshot_history"`);
    await queryRunner.query(
      `ALTER TABLE "action_update" DROP COLUMN "schemaSnapshotId"`,
    );
  }

  private async findOrCreateSnapshot(
    queryRunner: QueryRunner,
    schema: unknown,
  ): Promise<number> {
    const rows: { id: number }[] = await queryRunner.query(
      `INSERT INTO "form_snapshot" ("schema", "hash") VALUES ($1::jsonb, $2)
       ON CONFLICT ("hash") DO UPDATE SET "schema" = "form_snapshot"."schema"
       RETURNING "id"`,
      [JSON.stringify(schema), hashSchema(schema)],
    );
    return rows[0].id;
  }
}
