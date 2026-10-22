import { MigrationInterface, QueryRunner } from "typeorm";

export class TestUser1792021897190 implements MigrationInterface {
    name = 'TestUser1792021897190'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "isTestUser" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isTestUser"`);
    }

}
