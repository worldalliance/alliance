import { MigrationInterface, QueryRunner } from "typeorm";

export class ContractReinstatedNotification1793043806549 implements MigrationInterface {
    name = 'ContractReinstatedNotification1793043806549'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification" ADD "reinstatedSuspensionId" integer`);
        await queryRunner.query(`ALTER TYPE "public"."EmailType" RENAME TO "EmailType_old"`);
        await queryRunner.query(`CREATE TYPE "public"."EmailType" AS ENUM('verification', 'password_reset', 'welcome', 'other', 'commitment', 'memberaction', 'commitmentreminder', 'memberactionreminder', 'forum_digest', 'forum_reply', 'missed_deadline', 'missed_second_deadline', 'custom_action_reminder', 'contract_suspended', 'contract_reinstated', 'contract_reminder', 'waitlist_confirmation', 'waitlist_link', 'waitlist_staff')`);
        await queryRunner.query(`ALTER TABLE "mail" ALTER COLUMN "emailType" TYPE "public"."EmailType" USING "emailType"::"text"::"public"."EmailType"`);
        await queryRunner.query(`DROP TYPE "public"."EmailType_old"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_notification_user_groupingKey_category"`);
        await queryRunner.query(`ALTER TYPE "public"."notification_category_enum" RENAME TO "notification_category_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."notification_category_enum" AS ENUM('action_event', 'forum_reply', 'friend_request', 'friend_request_accepted', 'action_update', 'likes', 'removed_from_community', 'removed_from_community_for_leader', 'member_left_community', 'member_suspended_removed_from_community', 'member_joined_community', 'community_assigned', 'new_member_referred', 'group_member_joined', 'contract_reinstated', 'community_invite_created', 'community_invite_rejected', 'community_invite_accepted', 'onetime_invite_request_created', 'onetime_invite_request_approved', 'onetime_invite_request_rejected', 'community_invite_request_created', 'community_invite_request_approved', 'community_invite_request_rejected', 'ambassador_invite_goal')`);
        await queryRunner.query(`ALTER TABLE "notification" ALTER COLUMN "category" TYPE "public"."notification_category_enum" USING "category"::"text"::"public"."notification_category_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notification_category_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."notification_preference_kind_enum" RENAME TO "notification_preference_kind_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."notification_preference_kind_enum" AS ENUM('action_announced', 'action_reminders', 'missed_deadline', 'action_updates', 'group_members_with_uncompleted_tasks', 'contract_suspended', 'contract_reinstated', 'comments_and_replies', 'messages', 'friend_requests', 'friend_request_accepted', 'likes', 'group_member_joined', 'member_joined_community', 'community_assigned', 'removed_from_community', 'removed_from_community_for_leader', 'member_left_community', 'member_suspended_removed_from_community', 'new_member_referred', 'recruiting_goals', 'community_invite_created', 'community_invite_accepted', 'community_invite_rejected', 'community_invite_request_created', 'community_invite_request_approved', 'community_invite_request_rejected', 'onetime_invite_request_created', 'onetime_invite_request_approved', 'onetime_invite_request_rejected')`);
        await queryRunner.query(`ALTER TABLE "notification_preference" ALTER COLUMN "kind" TYPE "public"."notification_preference_kind_enum" USING "kind"::"text"::"public"."notification_preference_kind_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notification_preference_kind_enum_old"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_cf312e3030ae033e18489a943e" ON "notification" ("reinstatedSuspensionId") WHERE "reinstatedSuspensionId" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_notification_user_groupingKey_category" ON "notification" ("userId", "groupingKey", "category") `);
        await queryRunner.query(`ALTER TABLE "notification" ADD CONSTRAINT "FK_3626adb9d9a099ee7b67efc7548" FOREIGN KEY ("reinstatedSuspensionId") REFERENCES "contract_event"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification" DROP CONSTRAINT "FK_3626adb9d9a099ee7b67efc7548"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_notification_user_groupingKey_category"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cf312e3030ae033e18489a943e"`);
        await queryRunner.query(`CREATE TYPE "public"."notification_preference_kind_enum_old" AS ENUM('action_announced', 'action_reminders', 'missed_deadline', 'action_updates', 'group_members_with_uncompleted_tasks', 'contract_suspended', 'comments_and_replies', 'messages', 'friend_requests', 'friend_request_accepted', 'likes', 'group_member_joined', 'member_joined_community', 'community_assigned', 'removed_from_community', 'removed_from_community_for_leader', 'member_left_community', 'member_suspended_removed_from_community', 'new_member_referred', 'recruiting_goals', 'community_invite_created', 'community_invite_accepted', 'community_invite_rejected', 'community_invite_request_created', 'community_invite_request_approved', 'community_invite_request_rejected', 'onetime_invite_request_created', 'onetime_invite_request_approved', 'onetime_invite_request_rejected')`);
        await queryRunner.query(`ALTER TABLE "notification_preference" ALTER COLUMN "kind" TYPE "public"."notification_preference_kind_enum_old" USING "kind"::"text"::"public"."notification_preference_kind_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."notification_preference_kind_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."notification_preference_kind_enum_old" RENAME TO "notification_preference_kind_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."notification_category_enum_old" AS ENUM('action_event', 'forum_reply', 'friend_request', 'friend_request_accepted', 'action_update', 'likes', 'removed_from_community', 'removed_from_community_for_leader', 'member_left_community', 'member_suspended_removed_from_community', 'member_joined_community', 'community_assigned', 'new_member_referred', 'group_member_joined', 'community_invite_created', 'community_invite_rejected', 'community_invite_accepted', 'onetime_invite_request_created', 'onetime_invite_request_approved', 'onetime_invite_request_rejected', 'community_invite_request_created', 'community_invite_request_approved', 'community_invite_request_rejected', 'ambassador_invite_goal')`);
        await queryRunner.query(`ALTER TABLE "notification" ALTER COLUMN "category" TYPE "public"."notification_category_enum_old" USING "category"::"text"::"public"."notification_category_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."notification_category_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."notification_category_enum_old" RENAME TO "notification_category_enum"`);
        await queryRunner.query(`CREATE INDEX "IDX_notification_user_groupingKey_category" ON "notification" ("userId", "groupingKey", "category") `);
        await queryRunner.query(`CREATE TYPE "public"."EmailType_old" AS ENUM('verification', 'password_reset', 'welcome', 'other', 'commitment', 'memberaction', 'commitmentreminder', 'memberactionreminder', 'forum_digest', 'forum_reply', 'missed_deadline', 'missed_second_deadline', 'custom_action_reminder', 'contract_suspended', 'contract_reminder', 'waitlist_confirmation', 'waitlist_link', 'waitlist_staff')`);
        await queryRunner.query(`ALTER TABLE "mail" ALTER COLUMN "emailType" TYPE "public"."EmailType_old" USING "emailType"::"text"::"public"."EmailType_old"`);
        await queryRunner.query(`DROP TYPE "public"."EmailType"`);
        await queryRunner.query(`ALTER TYPE "public"."EmailType_old" RENAME TO "EmailType"`);
        await queryRunner.query(`ALTER TABLE "notification" DROP COLUMN "reinstatedSuspensionId"`);
    }

}
