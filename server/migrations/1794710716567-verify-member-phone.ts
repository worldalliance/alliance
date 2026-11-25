import { MigrationInterface, QueryRunner } from "typeorm";

export class VerifyMemberPhone1794710716567 implements MigrationInterface {
    name = 'VerifyMemberPhone1794710716567'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "phoneNumberVerifiedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`COMMENT ON COLUMN "user"."phoneNumberVerifiedAt" IS 'When the member entered a code sent to phoneNumber'`);
        await queryRunner.query(`ALTER TYPE "public"."OtpPurpose" ADD VALUE IF NOT EXISTS 'phone_verification'`);
        await queryRunner.query(`ALTER TYPE "public"."event_log_event_enum" ADD VALUE IF NOT EXISTS 'phone_number_moved'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."event_log_event_enum_old" AS ENUM('account_created', 'account_deleted', 'account_deletion_requested', 'action_comment', 'action_opt_out', 'admin_role_changed', 'contract_signed', 'contract_suspended', 'forum_action_autocomplete', 'forum_reply_notif_failure', 'join_request', 'sms_failure', 'sms_inbound', 'sms_resubscribe', 'sms_unsubscribe', 'waitlist_mail_cap_reached')`);
        await queryRunner.query(`ALTER TABLE "event_log" ALTER COLUMN "event" TYPE "public"."event_log_event_enum_old" USING "event"::"text"::"public"."event_log_event_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."event_log_event_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."event_log_event_enum_old" RENAME TO "event_log_event_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."OtpPurpose_old" AS ENUM('kora_sign_in')`);
        await queryRunner.query(`ALTER TABLE "otp_challenge" ALTER COLUMN "purpose" TYPE "public"."OtpPurpose_old" USING "purpose"::"text"::"public"."OtpPurpose_old"`);
        await queryRunner.query(`DROP TYPE "public"."OtpPurpose"`);
        await queryRunner.query(`ALTER TYPE "public"."OtpPurpose_old" RENAME TO "OtpPurpose"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "phoneNumberVerifiedAt"`);
    }

}
