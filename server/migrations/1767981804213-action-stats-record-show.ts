import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionStatsRecordShow1767981804213 implements MigrationInterface {
    name = 'ActionStatsRecordShow1767981804213'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_stats_record" ADD "showInChart" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_stats_record" DROP COLUMN "showInChart"`);
    }

}
