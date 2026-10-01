import { MigrationInterface, QueryRunner } from "typeorm";

export class WaitlistPublicMail1790728646442 implements MigrationInterface {
    name = 'WaitlistPublicMail1790728646442'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "waitlist_mail_allowance" ("email" citext NOT NULL, "claimedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_d47f4c365cf69f91b9763fb47ca" PRIMARY KEY ("email"))`);
        await queryRunner.query(`CREATE INDEX "IDX_383fff24a8877e858c2a0a7a5c" ON "waitlist_mail_allowance" ("claimedAt") `);
        await queryRunner.query(`ALTER TYPE "public"."EmailType" RENAME TO "EmailType_old"`);
        await queryRunner.query(`CREATE TYPE "public"."EmailType" AS ENUM('verification', 'password_reset', 'welcome', 'other', 'commitment', 'memberaction', 'commitmentreminder', 'memberactionreminder', 'forum_digest', 'forum_reply', 'missed_deadline', 'missed_second_deadline', 'custom_action_reminder', 'contract_suspended', 'contract_reminder', 'waitlist_confirmation', 'waitlist_link')`);
        await queryRunner.query(`ALTER TABLE "mail" ALTER COLUMN "emailType" TYPE "public"."EmailType" USING "emailType"::"text"::"public"."EmailType"`);
        await queryRunner.query(`DROP TYPE "public"."EmailType_old"`);
        await queryRunner.query(`ALTER TYPE "public"."event_log_event_enum" RENAME TO "event_log_event_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."event_log_event_enum" AS ENUM('account_created', 'contract_signed', 'contract_suspended', 'sms_unsubscribe', 'sms_resubscribe', 'sms_inbound', 'sms_failure', 'forum_action_autocomplete', 'action_comment', 'forum_reply_notif_failure', 'action_opt_out', 'account_deletion_requested', 'account_deleted', 'join_request', 'admin_role_changed', 'waitlist_mail_cap_reached')`);
        await queryRunner.query(`ALTER TABLE "event_log" ALTER COLUMN "event" TYPE "public"."event_log_event_enum" USING "event"::"text"::"public"."event_log_event_enum"`);
        await queryRunner.query(`DROP TYPE "public"."event_log_event_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."event_log_event_enum_old" AS ENUM('account_created', 'contract_signed', 'contract_suspended', 'sms_unsubscribe', 'sms_resubscribe', 'sms_inbound', 'sms_failure', 'forum_action_autocomplete', 'action_comment', 'forum_reply_notif_failure', 'action_opt_out', 'account_deletion_requested', 'account_deleted', 'join_request', 'admin_role_changed')`);
        await queryRunner.query(`ALTER TABLE "event_log" ALTER COLUMN "event" TYPE "public"."event_log_event_enum_old" USING "event"::"text"::"public"."event_log_event_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."event_log_event_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."event_log_event_enum_old" RENAME TO "event_log_event_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."EmailType_old" AS ENUM('verification', 'password_reset', 'welcome', 'other', 'commitment', 'memberaction', 'commitmentreminder', 'memberactionreminder', 'forum_digest', 'forum_reply', 'missed_deadline', 'missed_second_deadline', 'custom_action_reminder', 'contract_suspended', 'contract_reminder')`);
        await queryRunner.query(`ALTER TABLE "mail" ALTER COLUMN "emailType" TYPE "public"."EmailType_old" USING "emailType"::"text"::"public"."EmailType_old"`);
        await queryRunner.query(`DROP TYPE "public"."EmailType"`);
        await queryRunner.query(`ALTER TYPE "public"."EmailType_old" RENAME TO "EmailType"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_383fff24a8877e858c2a0a7a5c"`);
        await queryRunner.query(`DROP TABLE "waitlist_mail_allowance"`);
    }

}
