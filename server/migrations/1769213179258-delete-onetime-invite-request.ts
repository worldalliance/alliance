import { MigrationInterface, QueryRunner } from "typeorm";

export class DeleteOnetimeInviteRequest1769213179258 implements MigrationInterface {
  name = "DeleteOnetimeInviteRequest1769213179258";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."onetime_invite_status_enum" RENAME TO "onetime_invite_status_enum_old"`
    );

    await queryRunner.query(
      `CREATE TYPE "public"."onetime_invite_status_enum" AS ENUM('link_unused', 'link_used')`
    );

    await queryRunner.query(`
      DELETE FROM "onetime_invite"
      WHERE "status"::text NOT IN ('link_unused', 'link_used')
    `);

    await queryRunner.query(
      `ALTER TABLE "onetime_invite"
       ALTER COLUMN "status"
       TYPE "public"."onetime_invite_status_enum"
       USING "status"::"text"::"public"."onetime_invite_status_enum"`
    );

    await queryRunner.query(`DROP TYPE "public"."onetime_invite_status_enum_old"`);
  }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."onetime_invite_status_enum_old" AS ENUM('request_pending', 'request_rejected', 'link_unused', 'link_used')`);
        await queryRunner.query(`ALTER TABLE "onetime_invite" ALTER COLUMN "status" TYPE "public"."onetime_invite_status_enum_old" USING "status"::"text"::"public"."onetime_invite_status_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."onetime_invite_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."onetime_invite_status_enum_old" RENAME TO "onetime_invite_status_enum"`);
    }

}
