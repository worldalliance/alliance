import { MigrationInterface, QueryRunner } from 'typeorm';

export class Schemasnapshot1758296250267 implements MigrationInterface {
  name = 'Schemasnapshot1758296250267';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Add column (nullable so the backfill can succeed even if some rows can't be populated immediately)
    await queryRunner.query(
      `ALTER TABLE "form_response" ADD COLUMN "schemaSnapshot" jsonb`,
    );

    await queryRunner.query(`
      UPDATE "form_response" fr
      SET "schemaSnapshot" = f."schema"
      FROM "form" f
      WHERE f."id" = fr."formId"
    `);

    // 4) Enforce NOT NULL
    await queryRunner.query(
      `ALTER TABLE "form_response" ALTER COLUMN "schemaSnapshot" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "form_response" DROP COLUMN "schemaSnapshot"`,
    );
  }
}
