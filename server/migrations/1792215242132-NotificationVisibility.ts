import { MigrationInterface, QueryRunner } from "typeorm";

export class NotificationVisibility1792215242132 implements MigrationInterface {
    name = 'NotificationVisibility1792215242132'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification" ADD "visible" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "unread_content" ADD "visible" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "unread_content" DROP COLUMN "visible"`);
        await queryRunner.query(`ALTER TABLE "notification" DROP COLUMN "visible"`);
    }

}
