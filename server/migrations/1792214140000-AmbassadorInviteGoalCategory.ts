import { MigrationInterface, QueryRunner } from "typeorm";

export class AmbassadorInviteGoalCategory1792214140000 implements MigrationInterface {
    name = 'AmbassadorInviteGoalCategory1792214140000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_notification_user_groupingKey_category"`);
        await queryRunner.query(`ALTER TYPE "public"."notification_category_enum" RENAME TO "notification_category_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."notification_category_enum" AS ENUM('action_event', 'forum_reply', 'friend_request', 'friend_request_accepted', 'action_update', 'likes', 'removed_from_community', 'removed_from_community_for_leader', 'member_left_community', 'member_suspended_removed_from_community', 'member_joined_community', 'community_assigned', 'new_member_referred', 'group_member_joined', 'community_invite_created', 'community_invite_rejected', 'community_invite_accepted', 'onetime_invite_request_created', 'onetime_invite_request_approved', 'onetime_invite_request_rejected', 'community_invite_request_created', 'community_invite_request_approved', 'community_invite_request_rejected', 'ambassador_invite_goal')`);
        await queryRunner.query(`ALTER TABLE "notification" ALTER COLUMN "category" TYPE "public"."notification_category_enum" USING "category"::"text"::"public"."notification_category_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notification_category_enum_old"`);
        await queryRunner.query(`CREATE INDEX "IDX_notification_user_groupingKey_category" ON "notification" ("userId", "groupingKey", "category") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_notification_user_groupingKey_category"`);
        await queryRunner.query(`CREATE TYPE "public"."notification_category_enum_old" AS ENUM('action_event', 'forum_reply', 'friend_request', 'friend_request_accepted', 'action_update', 'likes', 'removed_from_community', 'removed_from_community_for_leader', 'member_left_community', 'member_suspended_removed_from_community', 'member_joined_community', 'community_assigned', 'new_member_referred', 'group_member_joined', 'community_invite_created', 'community_invite_rejected', 'community_invite_accepted', 'onetime_invite_request_created', 'onetime_invite_request_approved', 'onetime_invite_request_rejected', 'community_invite_request_created', 'community_invite_request_approved', 'community_invite_request_rejected')`);
        await queryRunner.query(`ALTER TABLE "notification" ALTER COLUMN "category" TYPE "public"."notification_category_enum_old" USING "category"::"text"::"public"."notification_category_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."notification_category_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."notification_category_enum_old" RENAME TO "notification_category_enum"`);
        await queryRunner.query(`CREATE INDEX "IDX_notification_user_groupingKey_category" ON "notification" ("userId", "groupingKey", "category") `);
    }

}
