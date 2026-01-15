import { MigrationInterface, QueryRunner } from "typeorm";

export class OptionalFlag1768247113359 implements MigrationInterface {
    name = 'OptionalFlag1768247113359'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action" ADD "optional" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "optional"`);
    }

}
