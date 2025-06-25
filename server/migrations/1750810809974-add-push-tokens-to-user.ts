import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPushTokensToUser1750810809974 implements MigrationInterface {
    name = 'AddPushTokensToUser1750810809974'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification" ADD "sent" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "user" ADD "pushTokens" text array NOT NULL DEFAULT '{}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "pushTokens"`);
        await queryRunner.query(`ALTER TABLE "notification" DROP COLUMN "sent"`);
    }

}
