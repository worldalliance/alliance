import { MigrationInterface, QueryRunner } from "typeorm";

export class MissedSuiteNotices1790896565192 implements MigrationInterface {
    name = 'MissedSuiteNotices1790896565192'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_event_notif" ADD "missNumber" integer`);
        await queryRunner.query(`CREATE TYPE "public"."MissedSuiteNoticeCopy" AS ENUM('first_miss_control', 'second_miss_report_v1')`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" ADD "missedSuiteCopy" "public"."MissedSuiteNoticeCopy"`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" ADD "actionSuiteId" integer`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" ADD CONSTRAINT "FK_45c762480701b34dadf999d342f" FOREIGN KEY ("actionSuiteId") REFERENCES "action_suite"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_event_notif" DROP CONSTRAINT "FK_45c762480701b34dadf999d342f"`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" DROP COLUMN "actionSuiteId"`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" DROP COLUMN "missedSuiteCopy"`);
        await queryRunner.query(`DROP TYPE "public"."MissedSuiteNoticeCopy"`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" DROP COLUMN "missNumber"`);
    }

}
