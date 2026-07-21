import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionReviewers1784664550776 implements MigrationInterface {
    name = 'ActionReviewers1784664550776'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action" ADD "reviewers" jsonb NOT NULL DEFAULT '[]'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "reviewers"`);
    }

}
