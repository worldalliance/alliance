import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionEventNotifReminderGroupIndex1784081423315 implements MigrationInterface {
    name = 'ActionEventNotifReminderGroupIndex1784081423315'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_a4aa7f8a48a1580f89e5b9f443" ON "action_event_notif" ("reminderGroupId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_a4aa7f8a48a1580f89e5b9f443"`);
    }

}
