import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFormResponseRevision1784300732121 implements MigrationInterface {
    name = 'AddFormResponseRevision1784300732121'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "form_response_revision" ("id" SERIAL NOT NULL, "formResponseId" integer NOT NULL, "answers" jsonb NOT NULL, "formSnapshotId" integer NOT NULL, "supersededAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6b3cda10d13fa3ea3049ef13043" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_41622790780f9d814451d481ba" ON "form_response_revision" ("formResponseId") `);
        await queryRunner.query(`CREATE INDEX "IDX_form_response_revision_formSnapshotId" ON "form_response_revision" ("formSnapshotId") `);
        await queryRunner.query(`ALTER TABLE "form_response_revision" ADD CONSTRAINT "FK_41622790780f9d814451d481bac" FOREIGN KEY ("formResponseId") REFERENCES "form_response"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "form_response_revision" ADD CONSTRAINT "FK_bc4fe15473b4b00bd0f92c1517b" FOREIGN KEY ("formSnapshotId") REFERENCES "form_snapshot"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "form_response_revision" DROP CONSTRAINT "FK_bc4fe15473b4b00bd0f92c1517b"`);
        await queryRunner.query(`ALTER TABLE "form_response_revision" DROP CONSTRAINT "FK_41622790780f9d814451d481bac"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_41622790780f9d814451d481ba"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_form_response_revision_formSnapshotId"`);
        await queryRunner.query(`DROP TABLE "form_response_revision"`);
    }

}
