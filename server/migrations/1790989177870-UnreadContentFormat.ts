import { MigrationInterface, QueryRunner } from "typeorm";

export class UnreadContentFormat1790989177870 implements MigrationInterface {
    name = 'UnreadContentFormat1790989177870'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."unread_content_format_enum" AS ENUM('legacy', 'referenced')`);
        await queryRunner.query(`ALTER TABLE "unread_content" ADD "format" "public"."unread_content_format_enum" NOT NULL DEFAULT 'legacy'`);
        await queryRunner.query(`ALTER TABLE "unread_content" ADD "content" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "unread_content" DROP COLUMN "content"`);
        await queryRunner.query(`ALTER TABLE "unread_content" DROP COLUMN "format"`);
        await queryRunner.query(`DROP TYPE "public"."unread_content_format_enum"`);
    }

}
