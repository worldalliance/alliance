import { MigrationInterface, QueryRunner } from "typeorm";

export class ContractEventViaTaskForm1789664046338 implements MigrationInterface {
    name = 'ContractEventViaTaskForm1789664046338'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "contract_event" ADD "viaTaskForm" boolean NOT NULL DEFAULT false`);
        // Signings from before `signedName` existed have no name either. Since
        // OAuth accounts appeared, only task-form signings leave it null.
        await queryRunner.query(`UPDATE "contract_event" SET "viaTaskForm" = true WHERE "type" = 'signed' AND "signedName" IS NULL AND "date" >= '2026-09-10'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "contract_event" DROP COLUMN "viaTaskForm"`);
    }

}
