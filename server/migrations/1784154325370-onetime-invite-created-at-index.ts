import { MigrationInterface, QueryRunner } from "typeorm";

export class OnetimeInviteCreatedAtIndex1784154325370 implements MigrationInterface {
    name = 'OnetimeInviteCreatedAtIndex1784154325370'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_c2718bf42595d8f7d9677b0931" ON "onetime_invite" ("createdAt", "id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_c2718bf42595d8f7d9677b0931"`);
    }

}
