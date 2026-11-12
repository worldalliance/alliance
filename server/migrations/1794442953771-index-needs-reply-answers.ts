import { MigrationInterface, QueryRunner } from "typeorm";

export class IndexNeedsReplyAnswers1794442953771 implements MigrationInterface {
    name = 'IndexNeedsReplyAnswers1794442953771'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_b8c6f81aed3e503aa3c8604422" ON "mms" ("memberPhoneNumber", "createdAt", "id") WHERE "direction" = 'inbound' OR "sentById" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_b8c6f81aed3e503aa3c8604422"`);
    }

}
