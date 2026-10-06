import { MigrationInterface, QueryRunner } from "typeorm";

export class WaitlistPhoneContact1791320811813 implements MigrationInterface {
    name = 'WaitlistPhoneContact1791320811813'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "waitlist_entry" ADD "phoneNumber" character varying`);
        await queryRunner.query(`ALTER TABLE "waitlist_entry" ALTER COLUMN "email" DROP NOT NULL`);
        await queryRunner.query(`ALTER TYPE "public"."waitlist_email_recipient_skipreason_enum" RENAME TO "waitlist_email_recipient_skipreason_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."waitlist_email_recipient_skipreason_enum" AS ENUM('no_email', 'unsubscribed', 'invite_claimed', 'spam')`);
        await queryRunner.query(`ALTER TABLE "waitlist_email_recipient" ALTER COLUMN "skipReason" TYPE "public"."waitlist_email_recipient_skipreason_enum" USING "skipReason"::"text"::"public"."waitlist_email_recipient_skipreason_enum"`);
        await queryRunner.query(`DROP TYPE "public"."waitlist_email_recipient_skipreason_enum_old"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_21827a9f2d2e0b88b4b7b9d1da" ON "waitlist_entry" ("phoneNumber") `);
        await queryRunner.query(`ALTER TABLE "waitlist_entry" ADD CONSTRAINT "CHK_waitlist_entry_phone_e164" CHECK ("phoneNumber" ~ '^[+][1-9][0-9]{1,14}$')`);
        await queryRunner.query(`ALTER TABLE "waitlist_entry" ADD CONSTRAINT "CHK_waitlist_entry_one_contact" CHECK (("email" IS NULL) <> ("phoneNumber" IS NULL))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "waitlist_entry" DROP CONSTRAINT "CHK_waitlist_entry_one_contact"`);
        await queryRunner.query(`ALTER TABLE "waitlist_entry" DROP CONSTRAINT "CHK_waitlist_entry_phone_e164"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_21827a9f2d2e0b88b4b7b9d1da"`);
        await queryRunner.query(`CREATE TYPE "public"."waitlist_email_recipient_skipreason_enum_old" AS ENUM('unsubscribed', 'invite_claimed', 'spam')`);
        await queryRunner.query(`ALTER TABLE "waitlist_email_recipient" ALTER COLUMN "skipReason" TYPE "public"."waitlist_email_recipient_skipreason_enum_old" USING "skipReason"::"text"::"public"."waitlist_email_recipient_skipreason_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."waitlist_email_recipient_skipreason_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."waitlist_email_recipient_skipreason_enum_old" RENAME TO "waitlist_email_recipient_skipreason_enum"`);
        await queryRunner.query(`ALTER TABLE "waitlist_entry" ALTER COLUMN "email" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "waitlist_entry" DROP COLUMN "phoneNumber"`);
    }

}
