import { MigrationInterface, QueryRunner } from "typeorm";

export class SuspendedDate1758387184247 implements MigrationInterface {
    name = 'SuspendedDate1758387184247'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "contractDateSuspended" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "contractDateSuspended"`);
    }

}
