import { MigrationInterface, QueryRunner } from "typeorm";

export class SwitchedDomainAt1787866920833 implements MigrationInterface {
    name = 'SwitchedDomainAt1787866920833'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "switchedDomainAt" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "switchedDomainAt"`);
    }

}
