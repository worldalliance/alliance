import { MigrationInterface, QueryRunner } from "typeorm";

export class SessionGeneration1791560000000 implements MigrationInterface {
    name = 'SessionGeneration1791560000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "sessionGeneration" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "sessionGeneration"`);
    }

}
