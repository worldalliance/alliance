import { MigrationInterface, QueryRunner } from "typeorm";

export class CustomStatTypeNotNull1793123016106 implements MigrationInterface {
  name = "CustomStatTypeNotNull1793123016106";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "action" SET "customStatType" = 'none' WHERE "customStatType" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "action" ALTER COLUMN "customStatType" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "action" ALTER COLUMN "customStatType" SET DEFAULT 'none'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "action" ALTER COLUMN "customStatType" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "action" ALTER COLUMN "customStatType" DROP NOT NULL`,
    );
  }
}
