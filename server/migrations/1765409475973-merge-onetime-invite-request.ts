import { MigrationInterface, QueryRunner } from "typeorm";

export class MergeOnetimeInviteRequest1765409475973 implements MigrationInterface {
    name = 'MergeOnetimeInviteRequest1765409475973'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "onetime_invite" ADD "inviteeDescription" character varying`);
        await queryRunner.query(`ALTER TABLE "notification" ADD "onetimeInviteId" integer`);
        await queryRunner.query(`ALTER TYPE "public"."onetime_invite_status_enum" RENAME TO "onetime_invite_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."onetime_invite_status_enum" AS ENUM('request_pending', 'request_rejected', 'link_unused', 'link_used')`);
        await queryRunner.query(`ALTER TABLE "onetime_invite" ALTER COLUMN "status" TYPE "public"."onetime_invite_status_enum" USING "status"::"text"::"public"."onetime_invite_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."onetime_invite_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "notification" ADD CONSTRAINT "FK_923f398e7539af13e8ad06fa79f" FOREIGN KEY ("onetimeInviteId") REFERENCES "onetime_invite"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification" DROP CONSTRAINT "FK_923f398e7539af13e8ad06fa79f"`);
        await queryRunner.query(`CREATE TYPE "public"."onetime_invite_status_enum_old" AS ENUM('link_unused', 'link_used')`);
        await queryRunner.query(`ALTER TABLE "onetime_invite" ALTER COLUMN "status" TYPE "public"."onetime_invite_status_enum_old" USING "status"::"text"::"public"."onetime_invite_status_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."onetime_invite_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."onetime_invite_status_enum_old" RENAME TO "onetime_invite_status_enum"`);
        await queryRunner.query(`ALTER TABLE "notification" DROP COLUMN "onetimeInviteId"`);
        await queryRunner.query(`ALTER TABLE "onetime_invite" DROP COLUMN "inviteeDescription"`);
    }

}
