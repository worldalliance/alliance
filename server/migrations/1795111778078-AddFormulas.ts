import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFormulas1795111778078 implements MigrationInterface {
    name = 'AddFormulas1795111778078'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "formula_version" ("id" SERIAL NOT NULL, "formulaId" uuid NOT NULL, "name" character varying NOT NULL, "tree" jsonb NOT NULL, "notes" text, "savedById" integer, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a9c805b90cdbea5050753e47283" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5573065d5670b117ac91c08986" ON "formula_version" ("formulaId") `);
        await queryRunner.query(`CREATE TABLE "formula" ("id" uuid NOT NULL, "name" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_10323e361d0bb0fd23d5825cf2d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_970a5c8bf1de2826aedfbe2a8f" ON "formula" ("name") WHERE "deletedAt" IS NULL`);
        await queryRunner.query(`ALTER TABLE "formula_version" ADD CONSTRAINT "FK_5573065d5670b117ac91c08986b" FOREIGN KEY ("formulaId") REFERENCES "formula"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "formula_version" ADD CONSTRAINT "FK_e4d5963e6386a3e186dfb293d30" FOREIGN KEY ("savedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "formula_version" DROP CONSTRAINT "FK_e4d5963e6386a3e186dfb293d30"`);
        await queryRunner.query(`ALTER TABLE "formula_version" DROP CONSTRAINT "FK_5573065d5670b117ac91c08986b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_970a5c8bf1de2826aedfbe2a8f"`);
        await queryRunner.query(`DROP TABLE "formula"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5573065d5670b117ac91c08986"`);
        await queryRunner.query(`DROP TABLE "formula_version"`);
    }

}
