import { MigrationInterface, QueryRunner } from "typeorm";

export class MissedSuiteInAppNotice1790896642523 implements MigrationInterface {
    name = 'MissedSuiteInAppNotice1790896642523'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_event_notif" ADD "notificationId" integer`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" ADD CONSTRAINT "UQ_8c6e5a740a427b1eaa123a92cdd" UNIQUE ("notificationId")`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" ADD CONSTRAINT "FK_8c6e5a740a427b1eaa123a92cdd" FOREIGN KEY ("notificationId") REFERENCES "notification"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_event_notif" DROP CONSTRAINT "FK_8c6e5a740a427b1eaa123a92cdd"`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" DROP CONSTRAINT "UQ_8c6e5a740a427b1eaa123a92cdd"`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" DROP COLUMN "notificationId"`);
    }

}
