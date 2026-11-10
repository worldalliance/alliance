import { MigrationInterface, QueryRunner } from "typeorm";

export class KoraActionsAndWebHandoff1794350314925 implements MigrationInterface {
    name = 'KoraActionsAndWebHandoff1794350314925'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "web_handoff" ("codeHash" character varying NOT NULL, "userId" integer NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_b11dc85ac68a7a2eaaee0608729" PRIMARY KEY ("codeHash"))`);
        await queryRunner.query(`CREATE INDEX "IDX_63ab4dc547560d4c385c23aa11" ON "web_handoff" ("expiresAt") `);
        await queryRunner.query(`CREATE TYPE "public"."ActionTaskKind" AS ENUM('form', 'kora_review')`);
        await queryRunner.query(`ALTER TABLE "action" ADD "taskKind" "public"."ActionTaskKind" NOT NULL DEFAULT 'form'`);
        await queryRunner.query(`ALTER TABLE "web_handoff" ADD CONSTRAINT "FK_33698cb87737dfdeea339052dcf" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "web_handoff" DROP CONSTRAINT "FK_33698cb87737dfdeea339052dcf"`);
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "taskKind"`);
        await queryRunner.query(`DROP TYPE "public"."ActionTaskKind"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_63ab4dc547560d4c385c23aa11"`);
        await queryRunner.query(`DROP TABLE "web_handoff"`);
    }

}
