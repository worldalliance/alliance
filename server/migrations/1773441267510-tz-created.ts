import { MigrationInterface, QueryRunner } from "typeorm";

export class TzCreated1773441267510 implements MigrationInterface {
    name = 'TzCreated1773441267510'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "recent_search" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "recent_search" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "mail" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "mail" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "comment" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "comment" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "general_update_activity" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "general_update_activity" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "form_response" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "form_response" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "action" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`DROP INDEX "public"."IDX_action_activity_type_createdAt"`);
        await queryRunner.query(`ALTER TABLE "action_activity" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "action_activity" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "forum_digest_log" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "forum_digest_log" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "ai_detection_result" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "ai_detection_result" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "ai_detection_result" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "ai_detection_result" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`CREATE INDEX "IDX_action_activity_type_createdAt" ON "action_activity" ("type", "createdAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_action_activity_type_createdAt"`);
        await queryRunner.query(`ALTER TABLE "ai_detection_result" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "ai_detection_result" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "ai_detection_result" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "ai_detection_result" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "forum_digest_log" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "forum_digest_log" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "action_activity" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "action_activity" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`CREATE INDEX "IDX_action_activity_type_createdAt" ON "action_activity" ("createdAt", "type") `);
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "action" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "form_response" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "form_response" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "general_update_activity" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "general_update_activity" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "comment" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "comment" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "mail" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "mail" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "recent_search" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "recent_search" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
    }

}
