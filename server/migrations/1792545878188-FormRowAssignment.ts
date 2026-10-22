import { MigrationInterface, QueryRunner } from "typeorm";

export class FormRowAssignment1792545878188 implements MigrationInterface {
    name = 'FormRowAssignment1792545878188'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "form_row_assignment" ("id" SERIAL NOT NULL, "formId" integer NOT NULL, "userId" integer NOT NULL, "rowKey" text NOT NULL, "assignedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_09e7bcfd742b8f710f1e67d76fb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_form_row_assignment_formId_rowKey" ON "form_row_assignment" ("formId", "rowKey") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_form_row_assignment_formId_userId" ON "form_row_assignment" ("formId", "userId") `);
        await queryRunner.query(`ALTER TABLE "form_response" ADD "assignedRow" jsonb`);
        await queryRunner.query(`ALTER TABLE "form_row_assignment" ADD CONSTRAINT "FK_0d74b4d8d19dfa6aa945389a165" FOREIGN KEY ("formId") REFERENCES "form"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "form_row_assignment" ADD CONSTRAINT "FK_c7ebe1a05b74b416c7f1e573804" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "form_row_assignment" DROP CONSTRAINT "FK_c7ebe1a05b74b416c7f1e573804"`);
        await queryRunner.query(`ALTER TABLE "form_row_assignment" DROP CONSTRAINT "FK_0d74b4d8d19dfa6aa945389a165"`);
        await queryRunner.query(`ALTER TABLE "form_response" DROP COLUMN "assignedRow"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_form_row_assignment_formId_userId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_form_row_assignment_formId_rowKey"`);
        await queryRunner.query(`DROP TABLE "form_row_assignment"`);
    }

}
