import { MigrationInterface, QueryRunner } from "typeorm";

export class MessageTracking1791319730442 implements MigrationInterface {
    name = 'MessageTracking1791319730442'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."message_tracking_channel_enum" AS ENUM('email', 'sms')`);
        await queryRunner.query(`CREATE TYPE "public"."message_tracking_source_enum" AS ENUM('action_reminder', 'missed_suite_notice', 'action_announcement', 'forum_reply', 'forum_digest', 'waitlist_campaign', 'action_update', 'contract_reminder')`);
        await queryRunner.query(`CREATE TABLE "message_tracking" ("id" SERIAL NOT NULL, "trackingId" character varying NOT NULL, "channel" "public"."message_tracking_channel_enum" NOT NULL, "source" "public"."message_tracking_source_enum" NOT NULL, "userId" integer, "waitlistEntryId" integer, "actionEventNotifId" integer, "context" jsonb NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_message_tracking_one_owner" CHECK (num_nonnulls("userId", "waitlistEntryId") = 1), CONSTRAINT "PK_aa4943c922e3e4a3cb5ed7839d5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_fe050622567997577107daf67d" ON "message_tracking" ("trackingId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8b3b8a83eda3f9d948e3a553ee" ON "message_tracking" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_edd938817e47e0bfef5e2967ae" ON "message_tracking" ("waitlistEntryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6aba526634a5bf218aff9329c6" ON "message_tracking" ("actionEventNotifId") `);
        await queryRunner.query(`CREATE INDEX "IDX_183c827529bae7fbbc27814dcb" ON "mail" ("cid") `);
        await queryRunner.query(`CREATE INDEX "IDX_62125b5f7593ceda9e2f809a18" ON "mms" ("cid") `);
        await queryRunner.query(`ALTER TABLE "message_tracking" ADD CONSTRAINT "FK_8b3b8a83eda3f9d948e3a553eea" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "message_tracking" ADD CONSTRAINT "FK_edd938817e47e0bfef5e2967ae7" FOREIGN KEY ("waitlistEntryId") REFERENCES "waitlist_entry"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "message_tracking" ADD CONSTRAINT "FK_6aba526634a5bf218aff9329c67" FOREIGN KEY ("actionEventNotifId") REFERENCES "action_event_notif"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "message_tracking" DROP CONSTRAINT "FK_6aba526634a5bf218aff9329c67"`);
        await queryRunner.query(`ALTER TABLE "message_tracking" DROP CONSTRAINT "FK_edd938817e47e0bfef5e2967ae7"`);
        await queryRunner.query(`ALTER TABLE "message_tracking" DROP CONSTRAINT "FK_8b3b8a83eda3f9d948e3a553eea"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_62125b5f7593ceda9e2f809a18"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_183c827529bae7fbbc27814dcb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6aba526634a5bf218aff9329c6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_edd938817e47e0bfef5e2967ae"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8b3b8a83eda3f9d948e3a553ee"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fe050622567997577107daf67d"`);
        await queryRunner.query(`DROP TABLE "message_tracking"`);
        await queryRunner.query(`DROP TYPE "public"."message_tracking_source_enum"`);
        await queryRunner.query(`DROP TYPE "public"."message_tracking_channel_enum"`);
    }

}
