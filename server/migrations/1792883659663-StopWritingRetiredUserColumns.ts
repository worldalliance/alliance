import { MigrationInterface, QueryRunner } from "typeorm";

export class StopWritingRetiredUserColumns1792883659663 implements MigrationInterface {
    name = 'StopWritingRetiredUserColumns1792883659663'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "forumDigestPreference" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "forumDigestPreference" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "socialNotifsPreference" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "socialNotifsPreference" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "emailNotifsForActions" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "emailNotifsForActions" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "textNotifsForActions" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "textNotifsForActions" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "pushNotifsForActions" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "pushNotifsForActions" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "turnedOffAllNotifs" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "turnedOffAllNotifs" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "pushesForLikes" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "pushesForLikes" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "pushesForComments" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "pushesForComments" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "pushesForFriendRequests" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "pushesForFriendRequests" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "pushesForMessages" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "pushesForMessages" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "pushesForActionUpdates" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "pushesForActionUpdates" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "pushesForNewGroupMembers" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "pushesForNewGroupMembers" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "textsForNewGroupMembers" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "textsForNewGroupMembers" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "remindAboutUncompletedGroupMembers" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "remindAboutUncompletedGroupMembers" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "receiveReplyNotifications" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "receiveReplyNotifications" DROP DEFAULT`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "user" SET
                "receiveReplyNotifications" = COALESCE("receiveReplyNotifications", true),
                "remindAboutUncompletedGroupMembers" = COALESCE("remindAboutUncompletedGroupMembers", true),
                "textsForNewGroupMembers" = COALESCE("textsForNewGroupMembers", false),
                "pushesForNewGroupMembers" = COALESCE("pushesForNewGroupMembers", true),
                "pushesForActionUpdates" = COALESCE("pushesForActionUpdates", true),
                "pushesForMessages" = COALESCE("pushesForMessages", true),
                "pushesForFriendRequests" = COALESCE("pushesForFriendRequests", true),
                "pushesForComments" = COALESCE("pushesForComments", true),
                "pushesForLikes" = COALESCE("pushesForLikes", true),
                "turnedOffAllNotifs" = COALESCE("turnedOffAllNotifs", false),
                "pushNotifsForActions" = COALESCE("pushNotifsForActions", true),
                "textNotifsForActions" = COALESCE("textNotifsForActions", true),
                "emailNotifsForActions" = COALESCE("emailNotifsForActions", true),
                "socialNotifsPreference" = COALESCE("socialNotifsPreference", 'all'),
                "forumDigestPreference" = COALESCE("forumDigestPreference", 'off')
        `);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "receiveReplyNotifications" SET DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "receiveReplyNotifications" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "remindAboutUncompletedGroupMembers" SET DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "remindAboutUncompletedGroupMembers" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "textsForNewGroupMembers" SET DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "textsForNewGroupMembers" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "pushesForNewGroupMembers" SET DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "pushesForNewGroupMembers" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "pushesForActionUpdates" SET DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "pushesForActionUpdates" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "pushesForMessages" SET DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "pushesForMessages" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "pushesForFriendRequests" SET DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "pushesForFriendRequests" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "pushesForComments" SET DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "pushesForComments" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "pushesForLikes" SET DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "pushesForLikes" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "turnedOffAllNotifs" SET DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "turnedOffAllNotifs" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "pushNotifsForActions" SET DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "pushNotifsForActions" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "textNotifsForActions" SET DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "textNotifsForActions" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "emailNotifsForActions" SET DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "emailNotifsForActions" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "socialNotifsPreference" SET DEFAULT 'all'`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "socialNotifsPreference" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "forumDigestPreference" SET DEFAULT 'off'`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "forumDigestPreference" SET NOT NULL`);
    }

}
