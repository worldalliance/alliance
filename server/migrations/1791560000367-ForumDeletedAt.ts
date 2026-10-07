import { MigrationInterface, QueryRunner } from "typeorm";

export class ForumDeletedAt1791560000367 implements MigrationInterface {
    name = 'ForumDeletedAt1791560000367'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "comment" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`);
        // The old flag kept no deletion time, so the migration's own time marks it.
        await queryRunner.query(`UPDATE "post" SET "deletedAt" = now() WHERE "deleted"`);
        await queryRunner.query(`UPDATE "comment" SET "deletedAt" = now() WHERE "deleted"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // The app installs these triggers at boot; they read the dropped column.
        await queryRunner.query(`DROP TRIGGER IF EXISTS "comment_stamp_legacy_deleted" ON "comment"`);
        await queryRunner.query(`DROP TRIGGER IF EXISTS "post_stamp_legacy_deleted" ON "post"`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS "stamp_legacy_deleted"()`);
        // Dropping deletedAt makes every soft-deleted row live again.
        await queryRunner.query(`UPDATE "comment" SET "deleted" = true WHERE "deletedAt" IS NOT NULL`);
        await queryRunner.query(`UPDATE "post" SET "deleted" = true WHERE "deletedAt" IS NOT NULL`);
        await queryRunner.query(`ALTER TABLE "comment" DROP COLUMN "deletedAt"`);
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "deletedAt"`);
    }

}
