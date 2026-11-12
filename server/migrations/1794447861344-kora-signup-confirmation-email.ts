import { MigrationInterface, QueryRunner } from "typeorm";

export class KoraSignupConfirmationEmail1794447861344 implements MigrationInterface {
    name = 'KoraSignupConfirmationEmail1794447861344'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."EmailType" RENAME TO "EmailType_old"`);
        await queryRunner.query(`CREATE TYPE "public"."EmailType" AS ENUM('verification', 'password_reset', 'welcome', 'other', 'commitment', 'memberaction', 'commitmentreminder', 'memberactionreminder', 'forum_digest', 'forum_reply', 'missed_deadline', 'missed_second_deadline', 'custom_action_reminder', 'contract_suspended', 'contract_reinstated', 'contract_reminder', 'waitlist_confirmation', 'waitlist_link', 'waitlist_staff', 'otp_code', 'kora_signup_confirmation')`);
        await queryRunner.query(`ALTER TABLE "mail" ALTER COLUMN "emailType" TYPE "public"."EmailType" USING "emailType"::"text"::"public"."EmailType"`);
        await queryRunner.query(`DROP TYPE "public"."EmailType_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."EmailType_old" AS ENUM('verification', 'password_reset', 'welcome', 'other', 'commitment', 'memberaction', 'commitmentreminder', 'memberactionreminder', 'forum_digest', 'forum_reply', 'missed_deadline', 'missed_second_deadline', 'custom_action_reminder', 'contract_suspended', 'contract_reinstated', 'contract_reminder', 'waitlist_confirmation', 'waitlist_link', 'waitlist_staff', 'otp_code')`);
        await queryRunner.query(`ALTER TABLE "mail" ALTER COLUMN "emailType" TYPE "public"."EmailType_old" USING "emailType"::"text"::"public"."EmailType_old"`);
        await queryRunner.query(`DROP TYPE "public"."EmailType"`);
        await queryRunner.query(`ALTER TYPE "public"."EmailType_old" RENAME TO "EmailType"`);
    }

}
