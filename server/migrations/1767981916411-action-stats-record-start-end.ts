import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionStatsRecordStartEnd1767981916411 implements MigrationInterface {
    name = 'ActionStatsRecordStartEnd1767981916411'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_stats_record" ADD "memberActionStartDate" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "action_stats_record" ADD "memberActionEndDate" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_stats_record" DROP COLUMN "memberActionEndDate"`);
        await queryRunner.query(`ALTER TABLE "action_stats_record" DROP COLUMN "memberActionStartDate"`);
    }

}
