import { MigrationInterface, QueryRunner } from "typeorm";

export class AnonAccount1751652582979 implements MigrationInterface {
    name = 'AnonAccount1751652582979'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "anonymous" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "anonymous"`);
    }

}
