import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionUpdateSplitCollectiveResult1792091911331 implements MigrationInterface {
    name = 'ActionUpdateSplitCollectiveResult1792091911331'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_update" ADD "splitCollectiveResult" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "action_update" ADD "nonCompleterResult" text`);
        await queryRunner.query(`ALTER TABLE "action_update" ADD "uninvolvedResult" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_update" DROP COLUMN "uninvolvedResult"`);
        await queryRunner.query(`ALTER TABLE "action_update" DROP COLUMN "nonCompleterResult"`);
        await queryRunner.query(`ALTER TABLE "action_update" DROP COLUMN "splitCollectiveResult"`);
    }

}
