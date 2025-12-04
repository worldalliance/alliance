import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOnetimeInviteRequest1764811931629 implements MigrationInterface {
    name = 'AddOnetimeInviteRequest1764811931629'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "onetime_invite" ADD "inviteeDescription" character varying`);
        await queryRunner.query(`ALTER TABLE "onetime_invite" ADD "approved" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "onetime_invite" DROP COLUMN "approved"`);
        await queryRunner.query(`ALTER TABLE "onetime_invite" DROP COLUMN "inviteeDescription"`);
    }

}
