import { MigrationInterface, QueryRunner } from "typeorm";

export class KoraProject1794332475836 implements MigrationInterface {
    name = 'KoraProject1794332475836'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."KoraProjectStatus" AS ENUM('pending', 'active', 'closed')`);
        await queryRunner.query(`CREATE TABLE "kora_project" ("id" smallint NOT NULL, "status" "public"."KoraProjectStatus" NOT NULL DEFAULT 'pending', CONSTRAINT "CHK_f4977a95c7567e1a448404fecd" CHECK ("id" = 1), CONSTRAINT "PK_1fb68358d17cb3ca41e6fc58a2e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`INSERT INTO "kora_project" ("id") VALUES (1)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "kora_project"`);
        await queryRunner.query(`DROP TYPE "public"."KoraProjectStatus"`);
    }

}
