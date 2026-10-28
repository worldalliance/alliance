import { MigrationInterface, QueryRunner } from "typeorm";

export class OtpCodes1793217323660 implements MigrationInterface {
    name = 'OtpCodes1793217323660'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "otp_rate_event" ("id" BIGSERIAL NOT NULL, "bucket" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_ef36c05031a498e9b04fa7e39fa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3eed8293d5db43d3cf7570a086" ON "otp_rate_event" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_ac12fa055a9caad060f32e6324" ON "otp_rate_event" ("bucket", "createdAt") `);
        await queryRunner.query(`CREATE TYPE "public"."OtpPurpose" AS ENUM('participant_sign_in')`);
        await queryRunner.query(`CREATE TYPE "public"."OtpChannel" AS ENUM('email', 'sms')`);
        await queryRunner.query(`CREATE TABLE "otp_challenge" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "purpose" "public"."OtpPurpose" NOT NULL, "channel" "public"."OtpChannel" NOT NULL, "destination" citext NOT NULL, "browserTokenHash" character varying NOT NULL, "codeDigest" character varying NOT NULL, "wrongAttempts" integer NOT NULL DEFAULT '0', "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_200fe6e81812616e7f97690cb21" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0c4ed3ac4cf924055013f8f036" ON "otp_challenge" ("browserTokenHash") `);
        await queryRunner.query(`CREATE INDEX "IDX_d12087b343e0c51536d4231a52" ON "otp_challenge" ("expiresAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_53c4019ce842b4852cafa04864" ON "otp_challenge" ("purpose", "destination") `);
        await queryRunner.query(`ALTER TYPE "public"."EmailType" RENAME TO "EmailType_old"`);
        await queryRunner.query(`CREATE TYPE "public"."EmailType" AS ENUM('verification', 'password_reset', 'welcome', 'other', 'commitment', 'memberaction', 'commitmentreminder', 'memberactionreminder', 'forum_digest', 'forum_reply', 'missed_deadline', 'missed_second_deadline', 'custom_action_reminder', 'contract_suspended', 'contract_reinstated', 'contract_reminder', 'waitlist_confirmation', 'waitlist_link', 'waitlist_staff', 'otp_code')`);
        await queryRunner.query(`ALTER TABLE "mail" ALTER COLUMN "emailType" TYPE "public"."EmailType" USING "emailType"::"text"::"public"."EmailType"`);
        await queryRunner.query(`DROP TYPE "public"."EmailType_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."EmailType_old" AS ENUM('verification', 'password_reset', 'welcome', 'other', 'commitment', 'memberaction', 'commitmentreminder', 'memberactionreminder', 'forum_digest', 'forum_reply', 'missed_deadline', 'missed_second_deadline', 'custom_action_reminder', 'contract_suspended', 'contract_reinstated', 'contract_reminder', 'waitlist_confirmation', 'waitlist_link', 'waitlist_staff')`);
        await queryRunner.query(`ALTER TABLE "mail" ALTER COLUMN "emailType" TYPE "public"."EmailType_old" USING "emailType"::"text"::"public"."EmailType_old"`);
        await queryRunner.query(`DROP TYPE "public"."EmailType"`);
        await queryRunner.query(`ALTER TYPE "public"."EmailType_old" RENAME TO "EmailType"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_53c4019ce842b4852cafa04864"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d12087b343e0c51536d4231a52"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0c4ed3ac4cf924055013f8f036"`);
        await queryRunner.query(`DROP TABLE "otp_challenge"`);
        await queryRunner.query(`DROP TYPE "public"."OtpChannel"`);
        await queryRunner.query(`DROP TYPE "public"."OtpPurpose"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ac12fa055a9caad060f32e6324"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3eed8293d5db43d3cf7570a086"`);
        await queryRunner.query(`DROP TABLE "otp_rate_event"`);
    }

}
