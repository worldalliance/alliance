import { MigrationInterface, QueryRunner } from "typeorm";

export class AutosuspendKey1765304868453 implements MigrationInterface {
    name = 'AutosuspendKey1765304868453'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "contract_event" ADD "autoSuspendKey" character varying`);
        await queryRunner.query(`ALTER TABLE "contract_event" ADD CONSTRAINT "UQ_fb9201b7927f167863569b10283" UNIQUE ("userId", "autoSuspendKey")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "contract_event" DROP CONSTRAINT "UQ_fb9201b7927f167863569b10283"`);
        await queryRunner.query(`ALTER TABLE "contract_event" DROP COLUMN "autoSuspendKey"`);
    }

}
