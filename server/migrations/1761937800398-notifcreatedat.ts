import { MigrationInterface, QueryRunner } from "typeorm";

export class Notifcreatedat1761937800398 implements MigrationInterface {
    name = 'Notifcreatedat1761937800398'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_event_notif" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_event_notif" DROP COLUMN "createdAt"`);
    }

}
