import { MigrationInterface, QueryRunner } from "typeorm";

export class UserDeviceBadgeCount1791729119960 implements MigrationInterface {
    name = 'UserDeviceBadgeCount1791729119960'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_device" ADD "badgeCount" integer`);
        await queryRunner.query(`ALTER TABLE "user_device" ADD "badgeCountComputedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "user_device" ADD "taskBadgePushes" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_device" DROP COLUMN "taskBadgePushes"`);
        await queryRunner.query(`ALTER TABLE "user_device" DROP COLUMN "badgeCountComputedAt"`);
        await queryRunner.query(`ALTER TABLE "user_device" DROP COLUMN "badgeCount"`);
    }

}
