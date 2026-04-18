import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUsersDismissedToActionStats1776470207644 implements MigrationInterface {
    name = 'AddUsersDismissedToActionStats1776470207644'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_stats_record" ADD "usersDismissed" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_stats_record" DROP COLUMN "usersDismissed"`);
    }

}
