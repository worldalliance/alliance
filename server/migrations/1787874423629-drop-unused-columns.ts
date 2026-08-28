import { MigrationInterface, QueryRunner } from "typeorm";

export class DropUnusedColumns1787874423629 implements MigrationInterface {
    name = 'DropUnusedColumns1787874423629'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_activity" DROP COLUMN "dollar_amount"`);
        await queryRunner.query(`ALTER TABLE "action_activity" DROP COLUMN "metadata"`);
        await queryRunner.query(`ALTER TABLE "participant" DROP COLUMN "userHidden"`);
        await queryRunner.query(`ALTER TABLE "video" DROP COLUMN "duration"`);
        await queryRunner.query(`ALTER TABLE "video" DROP COLUMN "processingInfo"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "video" ADD "processingInfo" jsonb`);
        await queryRunner.query(`ALTER TABLE "video" ADD "duration" double precision`);
        await queryRunner.query(`ALTER TABLE "participant" ADD "userHidden" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "action_activity" ADD "metadata" text`);
        await queryRunner.query(`ALTER TABLE "action_activity" ADD "dollar_amount" integer`);
    }

}
