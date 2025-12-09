import { MigrationInterface, QueryRunner } from "typeorm";

export class InviteRequestStatus1765304639906 implements MigrationInterface {
    name = 'InviteRequestStatus1765304639906'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."onetime_invite_request_status_enum" AS ENUM('pending', 'approved', 'rejected')`);
        await queryRunner.query(`ALTER TABLE "onetime_invite_request" ADD "status" "public"."onetime_invite_request_status_enum" NOT NULL DEFAULT 'pending'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "onetime_invite_request" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."onetime_invite_request_status_enum"`);
    }

}
