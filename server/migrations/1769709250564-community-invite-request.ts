import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommunityInviteRequest1769709250564 implements MigrationInterface {
  name = 'CommunityInviteRequest1769709250564';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."community_invite_status_enum" RENAME TO "community_invite_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."community_invite_status_enum" AS ENUM('request_pending', 'request_rejected', 'invitee_pending', 'invitee_accepted', 'invitee_rejected', 'cancelled')`,
    );
    await queryRunner.query(
      `ALTER TABLE "community_invite" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(`
          ALTER TABLE "community_invite" ALTER COLUMN "status" TYPE "public"."community_invite_status_enum"
          USING (
            CASE "status"::text
              WHEN 'pending' THEN 'invitee_pending'::"public"."community_invite_status_enum"
              WHEN 'accepted' THEN 'invitee_accepted'::"public"."community_invite_status_enum"
              WHEN 'rejected' THEN 'invitee_rejected'::"public"."community_invite_status_enum"
              WHEN 'cancelled' THEN 'cancelled'::"public"."community_invite_status_enum"
            END
          )
        `);
    await queryRunner.query(
      `DROP TYPE "public"."community_invite_status_enum_old"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."community_invite_status_enum_old" AS ENUM('accepted', 'cancelled', 'pending', 'rejected')`,
    );
    await queryRunner.query(`
          ALTER TABLE "community_invite" ALTER COLUMN "status" TYPE "public"."community_invite_status_enum_old"
          USING (
            CASE "status"::text
              WHEN 'request_pending' THEN 'pending'::"public"."community_invite_status_enum_old"
              WHEN 'request_rejected' THEN 'rejected'::"public"."community_invite_status_enum_old"
              WHEN 'invitee_pending' THEN 'pending'::"public"."community_invite_status_enum_old"
              WHEN 'invitee_accepted' THEN 'accepted'::"public"."community_invite_status_enum_old"
              WHEN 'invitee_rejected' THEN 'rejected'::"public"."community_invite_status_enum_old"
              WHEN 'cancelled' THEN 'cancelled'::"public"."community_invite_status_enum_old"
            END
          )
        `);
    await queryRunner.query(
      `ALTER TABLE "community_invite" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."community_invite_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."community_invite_status_enum_old" RENAME TO "community_invite_status_enum"`,
    );
  }
}
