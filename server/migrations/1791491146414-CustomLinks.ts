import { MigrationInterface, QueryRunner } from "typeorm";

export class CustomLinks1791491146414 implements MigrationInterface {
    name = 'CustomLinks1791491146414'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "custom_link" ("id" SERIAL NOT NULL, "label" character varying NOT NULL, "slug" character varying NOT NULL, "destination" text NOT NULL, "visits" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d313e348818cda7f4ad508e4a05" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_bd1f6114ee879104d9da5d3124" ON "custom_link" ("slug") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_bd1f6114ee879104d9da5d3124"`);
        await queryRunner.query(`DROP TABLE "custom_link"`);
    }

}
