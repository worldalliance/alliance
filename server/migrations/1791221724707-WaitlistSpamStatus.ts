import { MigrationInterface, QueryRunner } from "typeorm";

export class WaitlistSpamStatus1791221724707 implements MigrationInterface {
    name = 'WaitlistSpamStatus1791221724707'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."waitlist_entry_spamstatus_enum" AS ENUM('clean', 'suspected', 'spam', 'not_spam')`);
        await queryRunner.query(`ALTER TABLE "waitlist_entry" ADD "spamStatus" "public"."waitlist_entry_spamstatus_enum" NOT NULL DEFAULT 'clean'`);
        await queryRunner.query(`ALTER TYPE "public"."waitlist_entry_action_kind_enum" RENAME TO "waitlist_entry_action_kind_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."waitlist_entry_action_kind_enum" AS ENUM('manual_mobilize', 'undo_mobilize', 'email_mobilize', 'mark_spam', 'mark_not_spam')`);
        await queryRunner.query(`ALTER TABLE "waitlist_entry_action" ALTER COLUMN "kind" TYPE "public"."waitlist_entry_action_kind_enum" USING "kind"::"text"::"public"."waitlist_entry_action_kind_enum"`);
        await queryRunner.query(`DROP TYPE "public"."waitlist_entry_action_kind_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."waitlist_email_recipient_skipreason_enum" RENAME TO "waitlist_email_recipient_skipreason_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."waitlist_email_recipient_skipreason_enum" AS ENUM('unsubscribed', 'invite_claimed', 'spam')`);
        await queryRunner.query(`ALTER TABLE "waitlist_email_recipient" ALTER COLUMN "skipReason" TYPE "public"."waitlist_email_recipient_skipreason_enum" USING "skipReason"::"text"::"public"."waitlist_email_recipient_skipreason_enum"`);
        await queryRunner.query(`DROP TYPE "public"."waitlist_email_recipient_skipreason_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."waitlist_email_recipient_skipreason_enum_old" AS ENUM('unsubscribed', 'invite_claimed')`);
        await queryRunner.query(`ALTER TABLE "waitlist_email_recipient" ALTER COLUMN "skipReason" TYPE "public"."waitlist_email_recipient_skipreason_enum_old" USING "skipReason"::"text"::"public"."waitlist_email_recipient_skipreason_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."waitlist_email_recipient_skipreason_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."waitlist_email_recipient_skipreason_enum_old" RENAME TO "waitlist_email_recipient_skipreason_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."waitlist_entry_action_kind_enum_old" AS ENUM('manual_mobilize', 'undo_mobilize', 'email_mobilize')`);
        await queryRunner.query(`ALTER TABLE "waitlist_entry_action" ALTER COLUMN "kind" TYPE "public"."waitlist_entry_action_kind_enum_old" USING "kind"::"text"::"public"."waitlist_entry_action_kind_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."waitlist_entry_action_kind_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."waitlist_entry_action_kind_enum_old" RENAME TO "waitlist_entry_action_kind_enum"`);
        await queryRunner.query(`ALTER TABLE "waitlist_entry" DROP COLUMN "spamStatus"`);
        await queryRunner.query(`DROP TYPE "public"."waitlist_entry_spamstatus_enum"`);
    }

}
