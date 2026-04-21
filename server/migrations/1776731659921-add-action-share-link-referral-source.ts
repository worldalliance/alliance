import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActionShareLinkReferralSource1776731659921 implements MigrationInterface {
  name = 'AddActionShareLinkReferralSource1776731659921';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
  }
}
