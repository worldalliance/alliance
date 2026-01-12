import { MigrationInterface, QueryRunner } from "typeorm";

export class ReminderPushMessages1767895932290 implements MigrationInterface {
    name = 'ReminderPushMessages1767895932290'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reminder_group" ADD "pushMessage" text NOT NULL DEFAULT ''`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reminder_group" DROP COLUMN "pushMessage"`);
    }

}
