import { MigrationInterface, QueryRunner } from "typeorm";

export class DeleteInviteRequest1765413517474 implements MigrationInterface {
    name = 'DeleteInviteRequest1765413517474'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification" DROP CONSTRAINT "FK_0a2ad0d22a54b89937a3a4d3de8"`);
        await queryRunner.query(`ALTER TABLE "notification" DROP COLUMN "onetimeInviteRequestId"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification" ADD "onetimeInviteRequestId" integer`);
        await queryRunner.query(`ALTER TABLE "notification" ADD CONSTRAINT "FK_0a2ad0d22a54b89937a3a4d3de8" FOREIGN KEY ("onetimeInviteRequestId") REFERENCES "onetime_invite_request"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
