import { MigrationInterface, QueryRunner } from "typeorm";

export class RequireReminderGroupCohortType1791760634927 implements MigrationInterface {
    name = 'RequireReminderGroupCohortType1791760634927'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reminder_group" ALTER COLUMN "cohortType" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reminder_group" ALTER COLUMN "cohortType" DROP NOT NULL`);
    }

}
