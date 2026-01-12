import { MigrationInterface, QueryRunner } from "typeorm";

export class Notifsclaimedat1767898126532 implements MigrationInterface {
    name = 'Notifsclaimedat1767898126532'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification" ADD "pushClaimedAt" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification" DROP COLUMN "pushClaimedAt"`);
    }

}
