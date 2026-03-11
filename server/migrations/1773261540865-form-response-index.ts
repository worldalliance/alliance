import { MigrationInterface, QueryRunner } from "typeorm";

export class FormResponseIndex1773261540865 implements MigrationInterface {
    name = 'FormResponseIndex1773261540865'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "form_response" DROP CONSTRAINT "UQ_596e5cea71948ee219d37c6ef51"`);
        await queryRunner.query(`CREATE INDEX "IDX_596e5cea71948ee219d37c6ef5" ON "form_response" ("userId", "formId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_596e5cea71948ee219d37c6ef5"`);
        await queryRunner.query(`ALTER TABLE "form_response" ADD CONSTRAINT "UQ_596e5cea71948ee219d37c6ef51" UNIQUE ("formId", "userId")`);
    }

}
