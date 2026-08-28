import { MigrationInterface, QueryRunner } from "typeorm";

export class CommunityDescriptionNotNull1787951778054
  implements MigrationInterface
{
  name = "CommunityDescriptionNotNull1787951778054";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "community" SET "description" = '' WHERE "description" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "community" ALTER COLUMN "description" SET DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "community" ALTER COLUMN "description" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "community" ALTER COLUMN "description" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "community" ALTER COLUMN "description" DROP DEFAULT`,
    );
  }
}
