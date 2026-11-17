import { MigrationInterface, QueryRunner } from "typeorm";

export class KoraReviewerOptOutCategories1794940595474 implements MigrationInterface {
    name = 'KoraReviewerOptOutCategories1794940595474'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "kora_reviewer" ADD "optOutCategories" text array NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`UPDATE "kora_reviewer" r SET "optOutCategories" = ARRAY(
            SELECT DISTINCT jsonb_array_elements_text(a."export"->'optOutCategories') AS c
            FROM "kora_assignment" a
            WHERE a."reviewerId" = r."id" AND jsonb_typeof(a."export"->'optOutCategories') = 'array'
            ORDER BY c
        )`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "kora_reviewer" DROP COLUMN "optOutCategories"`);
    }

}
