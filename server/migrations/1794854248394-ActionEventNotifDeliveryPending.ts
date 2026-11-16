import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionEventNotifDeliveryPending1794854248394 implements MigrationInterface {
    name = 'ActionEventNotifDeliveryPending1794854248394'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_event_notif" ADD "deliveryPending" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_event_notif" DROP COLUMN "deliveryPending"`);
    }

}
