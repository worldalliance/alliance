import { MigrationInterface, QueryRunner } from "typeorm";

export class FormResponseEdits1782416970863 implements MigrationInterface {
    name = 'FormResponseEdits1782416970863'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "form_response_version" ("id" SERIAL NOT NULL, "formResponseId" integer NOT NULL, "version" integer NOT NULL, "answers" jsonb NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_404c5f23dfec64225bbf6d92288" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "form_response" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "form_response" ADD "editCount" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "form" ADD "isEditable" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "form_response_version" ADD CONSTRAINT "FK_b9159340907cc623cc7b5504205" FOREIGN KEY ("formResponseId") REFERENCES "form_response"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "form_response_version" DROP CONSTRAINT "FK_b9159340907cc623cc7b5504205"`);
        await queryRunner.query(`ALTER TABLE "form" DROP COLUMN "isEditable"`);
        await queryRunner.query(`ALTER TABLE "form_response" DROP COLUMN "editCount"`);
        await queryRunner.query(`ALTER TABLE "form_response" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`DROP TABLE "form_response_version"`);
    }

}
