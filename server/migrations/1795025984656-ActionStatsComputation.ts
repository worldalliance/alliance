import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionStatsComputation1795025984656 implements MigrationInterface {
    name = 'ActionStatsComputation1795025984656'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_stats_record" ADD "computation" BIGSERIAL NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_stats_record" DROP COLUMN "computation"`);
    }

}
