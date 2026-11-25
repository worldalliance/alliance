import { MigrationInterface, QueryRunner } from "typeorm";

export class ExposureChannelStarted1794894457041 implements MigrationInterface {
    name = 'ExposureChannelStarted1794894457041'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_update_exposure" ADD "emailStartedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "action_update_exposure" ADD "textStartedAt" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_update_exposure" DROP COLUMN "textStartedAt"`);
        await queryRunner.query(`ALTER TABLE "action_update_exposure" DROP COLUMN "emailStartedAt"`);
    }

}
