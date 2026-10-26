import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionFormBranches1792782370994 implements MigrationInterface {
    name = 'ActionFormBranches1792782370994'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_form_variant" ADD "rule" jsonb`);
        await queryRunner.query(`ALTER TABLE "action_form_variant" ADD "position" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "action_form_variant" ADD "nameOverride" character varying`);
        await queryRunner.query(`ALTER TABLE "action_form_variant" ADD "shortDescriptionOverride" character varying`);
        await queryRunner.query(`ALTER TABLE "action_form_variant" ADD "bodyOverride" character varying`);
        await queryRunner.query(`ALTER TABLE "action_form_variant" ADD "timeEstimateOverride" integer`);
        await queryRunner.query(`ALTER TABLE "action_form_variant" ADD "imageOverride" character varying`);
        await queryRunner.query(`ALTER TABLE "action_form_variant" ADD "squareThumbnailImageOverride" character varying`);
        await queryRunner.query(`ALTER TABLE "action_form_variant" ADD "squareThumbnailImageAltOverride" character varying`);
        await queryRunner.query(`ALTER TABLE "action_form_assignment" ADD "overriddenAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "action_form_assignment" ADD "overriddenById" integer`);
        await queryRunner.query(`ALTER TABLE "action_form_variant" ALTER COLUMN "splitValue" DROP NOT NULL`);
        await queryRunner.query(`DROP INDEX "public"."IDX_notification_user_groupingKey_category"`);
        await queryRunner.query(`ALTER TYPE "public"."notification_category_enum" RENAME TO "notification_category_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."notification_category_enum" AS ENUM('action_event', 'forum_reply', 'friend_request', 'friend_request_accepted', 'action_update', 'likes', 'removed_from_community', 'removed_from_community_for_leader', 'member_left_community', 'member_suspended_removed_from_community', 'member_joined_community', 'community_assigned', 'new_member_referred', 'group_member_joined', 'action_branch_moved', 'community_invite_created', 'community_invite_rejected', 'community_invite_accepted', 'onetime_invite_request_created', 'onetime_invite_request_approved', 'onetime_invite_request_rejected', 'community_invite_request_created', 'community_invite_request_approved', 'community_invite_request_rejected', 'ambassador_invite_goal')`);
        await queryRunner.query(`ALTER TABLE "notification" ALTER COLUMN "category" TYPE "public"."notification_category_enum" USING "category"::"text"::"public"."notification_category_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notification_category_enum_old"`);
        await queryRunner.query(`CREATE INDEX "IDX_notification_user_groupingKey_category" ON "notification" ("userId", "groupingKey", "category") `);
        await queryRunner.query(`ALTER TABLE "action_form_variant" ADD CONSTRAINT "CHK_action_form_variant_split_xor_rule" CHECK (("splitValue" IS NULL) <> ("rule" IS NULL))`);
        await queryRunner.query(`ALTER TABLE "action_form_assignment" ADD CONSTRAINT "FK_576e190435058471e684a8ae8d4" FOREIGN KEY ("overriddenById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_form_assignment" DROP CONSTRAINT "FK_576e190435058471e684a8ae8d4"`);
        await queryRunner.query(`ALTER TABLE "action_form_variant" DROP CONSTRAINT "CHK_action_form_variant_split_xor_rule"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_notification_user_groupingKey_category"`);
        await queryRunner.query(`CREATE TYPE "public"."notification_category_enum_old" AS ENUM('action_event', 'forum_reply', 'friend_request', 'friend_request_accepted', 'action_update', 'likes', 'removed_from_community', 'removed_from_community_for_leader', 'member_left_community', 'member_suspended_removed_from_community', 'member_joined_community', 'community_assigned', 'new_member_referred', 'group_member_joined', 'community_invite_created', 'community_invite_rejected', 'community_invite_accepted', 'onetime_invite_request_created', 'onetime_invite_request_approved', 'onetime_invite_request_rejected', 'community_invite_request_created', 'community_invite_request_approved', 'community_invite_request_rejected', 'ambassador_invite_goal')`);
        await queryRunner.query(`ALTER TABLE "notification" ALTER COLUMN "category" TYPE "public"."notification_category_enum_old" USING "category"::"text"::"public"."notification_category_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."notification_category_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."notification_category_enum_old" RENAME TO "notification_category_enum"`);
        await queryRunner.query(`CREATE INDEX "IDX_notification_user_groupingKey_category" ON "notification" ("category", "groupingKey", "userId") `);
        await queryRunner.query(`ALTER TABLE "action_form_variant" ALTER COLUMN "splitValue" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "action_form_assignment" DROP COLUMN "overriddenById"`);
        await queryRunner.query(`ALTER TABLE "action_form_assignment" DROP COLUMN "overriddenAt"`);
        await queryRunner.query(`ALTER TABLE "action_form_variant" DROP COLUMN "squareThumbnailImageAltOverride"`);
        await queryRunner.query(`ALTER TABLE "action_form_variant" DROP COLUMN "squareThumbnailImageOverride"`);
        await queryRunner.query(`ALTER TABLE "action_form_variant" DROP COLUMN "imageOverride"`);
        await queryRunner.query(`ALTER TABLE "action_form_variant" DROP COLUMN "timeEstimateOverride"`);
        await queryRunner.query(`ALTER TABLE "action_form_variant" DROP COLUMN "bodyOverride"`);
        await queryRunner.query(`ALTER TABLE "action_form_variant" DROP COLUMN "shortDescriptionOverride"`);
        await queryRunner.query(`ALTER TABLE "action_form_variant" DROP COLUMN "nameOverride"`);
        await queryRunner.query(`ALTER TABLE "action_form_variant" DROP COLUMN "position"`);
        await queryRunner.query(`ALTER TABLE "action_form_variant" DROP COLUMN "rule"`);
    }

}
