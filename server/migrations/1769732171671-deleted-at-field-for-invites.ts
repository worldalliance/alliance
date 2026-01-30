import { MigrationInterface, QueryRunner } from "typeorm";

export class DeletedAtFieldForInvites1769732171671 implements MigrationInterface {
    name = 'DeletedAtFieldForInvites1769732171671'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "community_invite" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "onetime_invite" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "onetime_invite" DROP COLUMN "deletedAt"`);
        await queryRunner.query(`ALTER TABLE "community_invite" DROP COLUMN "deletedAt"`);
    }

}
