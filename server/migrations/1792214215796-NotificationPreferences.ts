import { MigrationInterface, QueryRunner } from "typeorm";

export class NotificationPreferences1792214215796 implements MigrationInterface {
    name = 'NotificationPreferences1792214215796'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."notification_preference_kind_enum" AS ENUM('action_announced', 'action_reminders', 'missed_deadline', 'action_updates', 'group_members_with_uncompleted_tasks', 'contract_suspended', 'comments_and_replies', 'messages', 'friend_requests', 'friend_request_accepted', 'likes', 'group_member_joined', 'member_joined_community', 'community_assigned', 'removed_from_community', 'removed_from_community_for_leader', 'member_left_community', 'member_suspended_removed_from_community', 'new_member_referred', 'recruiting_goals', 'community_invite_created', 'community_invite_accepted', 'community_invite_rejected', 'community_invite_request_created', 'community_invite_request_approved', 'community_invite_request_rejected', 'onetime_invite_request_created', 'onetime_invite_request_approved', 'onetime_invite_request_rejected')`);
        await queryRunner.query(`CREATE TYPE "public"."notification_preference_channel_enum" AS ENUM('in_app', 'text', 'email', 'push')`);
        await queryRunner.query(`CREATE TYPE "public"."notification_preference_source_enum" AS ENUM('member', 'migrated')`);
        await queryRunner.query(`CREATE TABLE "notification_preference" ("userId" integer NOT NULL, "kind" "public"."notification_preference_kind_enum" NOT NULL, "channel" "public"."notification_preference_channel_enum" NOT NULL, "enabled" boolean NOT NULL, "source" "public"."notification_preference_source_enum" NOT NULL, CONSTRAINT "PK_c56a8128d8230a0108cc1fd861a" PRIMARY KEY ("userId", "kind", "channel"))`);
        await queryRunner.query(`ALTER TABLE "user" ADD "inAppByDefault" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "user" ADD "pushByDefault" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "user" ADD "textByDefault" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "user" ADD "emailByDefault" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "notification_preference" ADD CONSTRAINT "FK_c8721bd56ae600308745ad49744" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`
            UPDATE "user" SET
                "pushByDefault" = "pushNotifsForActions",
                "textByDefault" = "textNotifsForActions",
                "emailByDefault" = "emailNotifsForActions"
        `);
        // Each cell's delivery under the old settings, against the default it now follows.
        await queryRunner.query(`
            INSERT INTO "notification_preference" ("userId", "kind", "channel", "enabled", "source")
            SELECT u.id, cell.kind::"public"."notification_preference_kind_enum",
                cell.channel::"public"."notification_preference_channel_enum", cell.enabled, 'migrated'
            FROM "user" u CROSS JOIN LATERAL (VALUES
                ('group_members_with_uncompleted_tasks', 'push', u."pushNotifsForActions" AND u."remindAboutUncompletedGroupMembers", u."pushNotifsForActions"),
                ('group_members_with_uncompleted_tasks', 'text', u."textNotifsForActions" AND u."remindAboutUncompletedGroupMembers", u."textNotifsForActions"),
                ('group_members_with_uncompleted_tasks', 'email', u."emailNotifsForActions" AND u."remindAboutUncompletedGroupMembers", u."emailNotifsForActions"),
                ('action_updates', 'push', u."pushesForActionUpdates", u."pushNotifsForActions"),
                ('comments_and_replies', 'push', u."pushesForComments", u."pushNotifsForActions"),
                ('comments_and_replies', 'text', u."textNotifsForActions" AND u."receiveReplyNotifications", u."textNotifsForActions"),
                ('comments_and_replies', 'email', u."emailNotifsForActions" AND u."receiveReplyNotifications", u."emailNotifsForActions"),
                ('messages', 'push', u."pushesForMessages", u."pushNotifsForActions"),
                ('friend_requests', 'push', u."pushesForFriendRequests", u."pushNotifsForActions"),
                ('friend_request_accepted', 'push', u."pushesForFriendRequests", u."pushNotifsForActions"),
                ('likes', 'push', u."pushesForLikes", u."pushNotifsForActions"),
                ('group_member_joined', 'push', u."pushesForNewGroupMembers", u."pushNotifsForActions"),
                ('group_member_joined', 'text', u."textsForNewGroupMembers", u."textNotifsForActions"),
                ('member_joined_community', 'push', true, u."pushNotifsForActions"),
                ('community_assigned', 'push', true, u."pushNotifsForActions"),
                ('removed_from_community', 'push', true, u."pushNotifsForActions"),
                ('removed_from_community_for_leader', 'push', true, u."pushNotifsForActions"),
                ('member_left_community', 'push', true, u."pushNotifsForActions"),
                ('member_suspended_removed_from_community', 'push', true, u."pushNotifsForActions"),
                ('new_member_referred', 'push', true, u."pushNotifsForActions"),
                ('recruiting_goals', 'push', true, u."pushNotifsForActions"),
                ('community_invite_created', 'push', true, u."pushNotifsForActions"),
                ('community_invite_accepted', 'push', true, u."pushNotifsForActions"),
                ('community_invite_rejected', 'push', true, u."pushNotifsForActions"),
                ('community_invite_request_created', 'push', true, u."pushNotifsForActions"),
                ('community_invite_request_approved', 'push', true, u."pushNotifsForActions"),
                ('community_invite_request_rejected', 'push', true, u."pushNotifsForActions"),
                ('onetime_invite_request_created', 'push', true, u."pushNotifsForActions"),
                ('onetime_invite_request_approved', 'push', true, u."pushNotifsForActions"),
                ('onetime_invite_request_rejected', 'push', true, u."pushNotifsForActions")
            ) AS cell(kind, channel, enabled, "default")
            WHERE cell.enabled <> cell."default"
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification_preference" DROP CONSTRAINT "FK_c8721bd56ae600308745ad49744"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "emailByDefault"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "textByDefault"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "pushByDefault"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "inAppByDefault"`);
        await queryRunner.query(`DROP TABLE "notification_preference"`);
        await queryRunner.query(`DROP TYPE "public"."notification_preference_source_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notification_preference_channel_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notification_preference_kind_enum"`);
    }

}
