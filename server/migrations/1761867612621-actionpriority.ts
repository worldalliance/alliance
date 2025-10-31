import { MigrationInterface, QueryRunner } from "typeorm";

export class Actionpriority1761867612621 implements MigrationInterface {
    name = 'Actionpriority1761867612621'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action" ADD "priority" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "priority"`);
    }

}
