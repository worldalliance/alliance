import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionActivityFollowUp1773345794874 implements MigrationInterface {
    name = 'ActionActivityFollowUp1773345794874'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_activity" DROP CONSTRAINT "UQ_activity_user_action_type"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_action_activity_type_createdAt"`);
        await queryRunner.query(`ALTER TYPE "public"."action_activity_type_enum" RENAME TO "action_activity_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."action_activity_type_enum" AS ENUM('user_joined', 'user_completed', 'user_declined', 'user_wont_complete', 'user_dismissed', 'user_submitted_follow_up_form')`);
        await queryRunner.query(`ALTER TABLE "action_activity" ALTER COLUMN "type" TYPE "public"."action_activity_type_enum" USING "type"::"text"::"public"."action_activity_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."action_activity_type_enum_old"`);
        await queryRunner.query(`CREATE INDEX "IDX_action_activity_type_createdAt" ON "action_activity" ("type", "createdAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_action_activity_type_createdAt"`);
        await queryRunner.query(`CREATE TYPE "public"."action_activity_type_enum_old" AS ENUM('user_joined', 'user_completed', 'user_declined', 'user_wont_complete', 'user_dismissed')`);
        await queryRunner.query(`ALTER TABLE "action_activity" ALTER COLUMN "type" TYPE "public"."action_activity_type_enum_old" USING "type"::"text"::"public"."action_activity_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."action_activity_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."action_activity_type_enum_old" RENAME TO "action_activity_type_enum"`);
        await queryRunner.query(`CREATE INDEX "IDX_action_activity_type_createdAt" ON "action_activity" ("createdAt", "type") `);
        await queryRunner.query(`ALTER TABLE "action_activity" ADD CONSTRAINT "UQ_activity_user_action_type" UNIQUE ("actionId", "userId", "type")`);
    }

}
