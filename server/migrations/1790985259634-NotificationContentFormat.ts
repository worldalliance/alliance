import { MigrationInterface, QueryRunner } from "typeorm";

export class NotificationContentFormat1790985259634 implements MigrationInterface {
    name = 'NotificationContentFormat1790985259634'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."notification_format_enum" AS ENUM('legacy', 'referenced')`);
        await queryRunner.query(`ALTER TABLE "notification" ADD "format" "public"."notification_format_enum" NOT NULL DEFAULT 'legacy'`);
        await queryRunner.query(`ALTER TABLE "notification" ADD "content" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification" DROP COLUMN "content"`);
        await queryRunner.query(`ALTER TABLE "notification" DROP COLUMN "format"`);
        await queryRunner.query(`DROP TYPE "public"."notification_format_enum"`);
    }

}
