import { MigrationInterface, QueryRunner } from 'typeorm';

export class VisibilityMode1767910488984 implements MigrationInterface {
  name = 'VisibilityMode1767910488984';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "action" RENAME COLUMN "showToNonparticipating" TO "visibilityMode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action" DROP COLUMN "visibilityMode"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."action_visibilitymode_enum" AS ENUM('public', 'all_members', 'participating_groups')`,
    );
    await queryRunner.query(
      `ALTER TABLE "action" ADD "visibilityMode" "public"."action_visibilitymode_enum" NOT NULL DEFAULT 'public'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "action" DROP COLUMN "visibilityMode"`,
    );
    await queryRunner.query(`DROP TYPE "public"."action_visibilitymode_enum"`);
    await queryRunner.query(
      `ALTER TABLE "action" ADD "visibilityMode" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "action" RENAME COLUMN "visibilityMode" TO "showToNonparticipating"`,
    );
  }
}
