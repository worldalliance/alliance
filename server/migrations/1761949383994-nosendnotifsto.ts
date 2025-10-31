import { MigrationInterface, QueryRunner } from "typeorm";

export class Nosendnotifsto1761949383994 implements MigrationInterface {
    name = 'Nosendnotifsto1761949383994'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_event" DROP COLUMN "sendNotifsTo"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_event" ADD "sendNotifsTo" text NOT NULL`);
    }

}
