import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSuiteSplits1794275361274 implements MigrationInterface {
    name = 'AddSuiteSplits1794275361274'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "action_suite_split_arm" ("id" SERIAL NOT NULL, "splitId" integer NOT NULL, "actionId" integer NOT NULL, "position" integer NOT NULL, "rule" jsonb, "optional" boolean NOT NULL DEFAULT false, "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_f2e73fafefebc04a1912fdfce91" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_action_suite_split_arm_splitId" ON "action_suite_split_arm" ("splitId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_action_suite_split_arm_actionId_live" ON "action_suite_split_arm" ("actionId") WHERE "deletedAt" IS NULL`);
        await queryRunner.query(`CREATE TYPE "public"."action_suite_split_visibilitymode_enum" AS ENUM('per_arm', 'combined')`);
        await queryRunner.query(`CREATE TABLE "action_suite_split" ("id" SERIAL NOT NULL, "suiteId" integer NOT NULL, "title" character varying NOT NULL, "visibilityMode" "public"."action_suite_split_visibilitymode_enum" NOT NULL DEFAULT 'combined', "filterExpression" jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_dbc8327c944d2ad4d2b362f04d9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_action_suite_split_suiteId" ON "action_suite_split" ("suiteId") `);
        await queryRunner.query(`ALTER TABLE "action_suite_split_arm" ADD CONSTRAINT "FK_bb68071559866704249b6987091" FOREIGN KEY ("splitId") REFERENCES "action_suite_split"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "action_suite_split_arm" ADD CONSTRAINT "FK_423ae4355c44e99f5da49dc55c2" FOREIGN KEY ("actionId") REFERENCES "action"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "action_suite_split" ADD CONSTRAINT "FK_5c426f887931f72a8a50fad12bf" FOREIGN KEY ("suiteId") REFERENCES "action_suite"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_suite_split" DROP CONSTRAINT "FK_5c426f887931f72a8a50fad12bf"`);
        await queryRunner.query(`ALTER TABLE "action_suite_split_arm" DROP CONSTRAINT "FK_423ae4355c44e99f5da49dc55c2"`);
        await queryRunner.query(`ALTER TABLE "action_suite_split_arm" DROP CONSTRAINT "FK_bb68071559866704249b6987091"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_action_suite_split_suiteId"`);
        await queryRunner.query(`DROP TABLE "action_suite_split"`);
        await queryRunner.query(`DROP TYPE "public"."action_suite_split_visibilitymode_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_action_suite_split_arm_actionId_live"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_action_suite_split_arm_splitId"`);
        await queryRunner.query(`DROP TABLE "action_suite_split_arm"`);
    }

}
