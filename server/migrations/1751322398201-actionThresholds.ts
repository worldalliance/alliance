import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionThresholds1751322398201 implements MigrationInterface {
    name = 'ActionThresholds1751322398201'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action" ADD "commitmentThreshold" integer`);
        await queryRunner.query(`ALTER TABLE "action" ADD "donationThreshold" integer`);
        await queryRunner.query(`ALTER TABLE "action" ADD "donationAmount" integer DEFAULT '500'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "donationAmount"`);
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "donationThreshold"`);
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "commitmentThreshold"`);
    }

}
