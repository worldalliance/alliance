import { MigrationInterface, QueryRunner } from "typeorm";

export class PushOpenedAt1773428103394 implements MigrationInterface {
    name = 'PushOpenedAt1773428103394'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "push" ADD "openedAt" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "push" DROP COLUMN "openedAt"`);
    }

}
