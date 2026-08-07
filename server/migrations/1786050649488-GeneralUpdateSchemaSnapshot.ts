import { MigrationInterface, QueryRunner } from 'typeorm';

const SNAPSHOT_FK = 'FK_30683fd986c47362a0d134f045e';
const HISTORY_UPDATE_FK = 'FK_b4daa572c1ac826893c3b7835a2';
const HISTORY_SNAPSHOT_FK = 'FK_02a721e6e24f64067a5ac3ae588';

export class GeneralUpdateSchemaSnapshot1786050649488
  implements MigrationInterface
{
  name = 'GeneralUpdateSchemaSnapshot1786050649488';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // No backfill: general_update is empty everywhere, so the inline schema
    // column can just be dropped in favour of a form_snapshot reference.
    await queryRunner.query(`ALTER TABLE "general_update" DROP COLUMN "schema"`);
    await queryRunner.query(
      `ALTER TABLE "general_update" ADD "schemaSnapshotId" integer NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "general_update" ADD CONSTRAINT "${SNAPSHOT_FK}" FOREIGN KEY ("schemaSnapshotId") REFERENCES "form_snapshot"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "general_update_snapshot_history" ("generalUpdateId" integer NOT NULL, "schemaSnapshotId" integer NOT NULL, CONSTRAINT "PK_aeac1be4f30bb64fa69e2337a49" PRIMARY KEY ("generalUpdateId", "schemaSnapshotId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b4daa572c1ac826893c3b7835a" ON "general_update_snapshot_history" ("generalUpdateId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_02a721e6e24f64067a5ac3ae58" ON "general_update_snapshot_history" ("schemaSnapshotId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "general_update_snapshot_history" ADD CONSTRAINT "${HISTORY_UPDATE_FK}" FOREIGN KEY ("generalUpdateId") REFERENCES "general_update"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "general_update_snapshot_history" ADD CONSTRAINT "${HISTORY_SNAPSHOT_FK}" FOREIGN KEY ("schemaSnapshotId") REFERENCES "form_snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "general_update_snapshot_history" DROP CONSTRAINT "${HISTORY_SNAPSHOT_FK}"`,
    );
    await queryRunner.query(
      `ALTER TABLE "general_update_snapshot_history" DROP CONSTRAINT "${HISTORY_UPDATE_FK}"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_02a721e6e24f64067a5ac3ae58"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b4daa572c1ac826893c3b7835a"`,
    );
    await queryRunner.query(`DROP TABLE "general_update_snapshot_history"`);

    await queryRunner.query(
      `ALTER TABLE "general_update" DROP CONSTRAINT "${SNAPSHOT_FK}"`,
    );
    await queryRunner.query(
      `ALTER TABLE "general_update" DROP COLUMN "schemaSnapshotId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "general_update" ADD "schema" jsonb NOT NULL`,
    );
  }
}
