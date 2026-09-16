import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFormResponseDraft1788393741903 implements MigrationInterface {
    name = 'AddFormResponseDraft1788393741903'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "form_response_draft" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "formId" integer NOT NULL, "actionId" integer NOT NULL, "formSnapshotId" integer NOT NULL, "answers" jsonb NOT NULL, "publicAnswers" jsonb NOT NULL DEFAULT '{}', "currentPageIndex" integer NOT NULL DEFAULT '0', "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "UQ_4ddf761a4156ad0cc1ead328c4d" UNIQUE ("userId", "formId"), CONSTRAINT "PK_302a53b63c3409101aed4479869" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "form_response_draft" ADD CONSTRAINT "FK_37e5606ebf2387f24d482ea54a5" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "form_response_draft" ADD CONSTRAINT "FK_79dc17cec96e8bb0602ebc8bddb" FOREIGN KEY ("formId") REFERENCES "form"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "form_response_draft" DROP CONSTRAINT "FK_79dc17cec96e8bb0602ebc8bddb"`);
        await queryRunner.query(`ALTER TABLE "form_response_draft" DROP CONSTRAINT "FK_37e5606ebf2387f24d482ea54a5"`);
        await queryRunner.query(`DROP TABLE "form_response_draft"`);
    }

}
