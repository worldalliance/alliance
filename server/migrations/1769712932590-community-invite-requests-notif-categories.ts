import { MigrationInterface, QueryRunner } from "typeorm";

export class CommunityInviteRequestsNotifCategories1769712932590 implements MigrationInterface {
    name = 'CommunityInviteRequestsNotifCategories1769712932590'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."notification_category_enum" RENAME TO "notification_category_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."notification_category_enum" AS ENUM('action_event', 'forum_reply', 'friend_request', 'friend_request_accepted', 'action_update', 'likes', 'community_invite_created', 'community_invite_rejected', 'community_invite_accepted', 'removed_from_community', 'member_left_community', 'member_joined_community', 'community_assigned', 'onetime_invite_request_created', 'onetime_invite_request_approved', 'onetime_invite_request_rejected', 'community_invite_request_created', 'community_invite_request_rejected')`);
        await queryRunner.query(`ALTER TABLE "notification" ALTER COLUMN "category" TYPE "public"."notification_category_enum" USING "category"::"text"::"public"."notification_category_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notification_category_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."notification_category_enum_old" AS ENUM('action_event', 'forum_reply', 'friend_request', 'friend_request_accepted', 'action_update', 'likes', 'community_invite_created', 'community_invite_rejected', 'community_invite_accepted', 'removed_from_community', 'member_left_community', 'member_joined_community', 'community_assigned', 'onetime_invite_request_created', 'onetime_invite_request_approved', 'onetime_invite_request_rejected')`);
        await queryRunner.query(`ALTER TABLE "notification" ALTER COLUMN "category" TYPE "public"."notification_category_enum_old" USING "category"::"text"::"public"."notification_category_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."notification_category_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."notification_category_enum_old" RENAME TO "notification_category_enum"`);
    }

}
