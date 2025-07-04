import { MigrationInterface, QueryRunner } from 'typeorm';

export class ActionBodyColumns1751592853058 implements MigrationInterface {
  name = 'ActionBodyColumns1751592853058';
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove no-longer-needed columns
    await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "whyJoin"`);
    await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "howTo"`);

    // Preserve data: rename description ➔ body
    await queryRunner.query(
      `ALTER TABLE "action" RENAME COLUMN "description" TO "body"`,
    );

    // New optional column
    await queryRunner.query(
      `ALTER TABLE "action" ADD "taskContents" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Roll back new column
    await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "taskContents"`);

    // Rename body ➔ description (restores original name and keeps the data)
    await queryRunner.query(
      `ALTER TABLE "action" RENAME COLUMN "body" TO "description"`,
    );

    // Restore previously-removed columns
    await queryRunner.query(
      `ALTER TABLE "action" ADD "howTo" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "action" ADD "whyJoin" character varying NOT NULL`,
    );
  }
}
