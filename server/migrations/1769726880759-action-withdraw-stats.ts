import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionWithdrawStats1769726880759 implements MigrationInterface {
    name = 'ActionWithdrawStats1769726880759'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_stats_record" ADD "usersWithdrawn" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_stats_record" DROP COLUMN "usersWithdrawn"`);
    }

}
