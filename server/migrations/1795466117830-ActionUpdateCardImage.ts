import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionUpdateCardImage1795466117830 implements MigrationInterface {
    name = 'ActionUpdateCardImage1795466117830'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_update" ADD "cardImage" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_update" DROP COLUMN "cardImage"`);
    }

}
