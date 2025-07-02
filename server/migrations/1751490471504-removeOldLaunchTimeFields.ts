import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveOldLaunchTimeFields1751490471504 implements MigrationInterface {
    name = 'RemoveOldLaunchTimeFields1751490471504'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "commitmentLaunchTime"`);
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "completionLaunchTime"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action" ADD "completionLaunchTime" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "action" ADD "commitmentLaunchTime" TIMESTAMP`);
    }

}
