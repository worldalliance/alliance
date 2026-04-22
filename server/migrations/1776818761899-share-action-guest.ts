import { MigrationInterface, QueryRunner } from 'typeorm';

export class ShareActionGuest1776818761899 implements MigrationInterface {
  name = 'ShareActionGuest1776818761899';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "guest" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "linkedUserId" integer, CONSTRAINT "PK_57689d19445de01737dbc458857" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9f7d8dbe4ada5eeb8cfc264dc8" ON "guest" ("linkedUserId") `,
    );
    await queryRunner.query(`ALTER TABLE "form_response" ADD "guestId" uuid`);
    await queryRunner.query(
      `ALTER TYPE "public"."user_referralsource_enum" RENAME TO "user_referralsource_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_referralsource_enum" AS ENUM('referral_link', 'onetime_invite', 'action_share_link')`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "referralSource" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "referralSource" TYPE "public"."user_referralsource_enum" USING "referralSource"::"text"::"public"."user_referralsource_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "referralSource" SET DEFAULT 'referral_link'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."user_referralsource_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "form_response" ADD CONSTRAINT "CHK_05a629385967d647bfb9fb9587" CHECK (NOT ("userId" IS NOT NULL AND "guestId" IS NOT NULL))`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest" ADD CONSTRAINT "FK_9f7d8dbe4ada5eeb8cfc264dc8f" FOREIGN KEY ("linkedUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "form_response" ADD CONSTRAINT "FK_e81faa0f99527696f9637679939" FOREIGN KEY ("guestId") REFERENCES "guest"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "form_response" DROP CONSTRAINT "FK_e81faa0f99527696f9637679939"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest" DROP CONSTRAINT "FK_9f7d8dbe4ada5eeb8cfc264dc8f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "form_response" DROP CONSTRAINT "CHK_05a629385967d647bfb9fb9587"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_referralsource_enum_old" AS ENUM('referral_link', 'onetime_invite')`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "referralSource" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "referralSource" TYPE "public"."user_referralsource_enum_old" USING "referralSource"::"text"::"public"."user_referralsource_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "referralSource" SET DEFAULT 'referral_link'`,
    );
    await queryRunner.query(`DROP TYPE "public"."user_referralsource_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."user_referralsource_enum_old" RENAME TO "user_referralsource_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "form_response" DROP COLUMN "guestId"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9f7d8dbe4ada5eeb8cfc264dc8"`,
    );
    await queryRunner.query(`DROP TABLE "guest"`);
  }
}
