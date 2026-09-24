import { MigrationInterface, QueryRunner } from "typeorm";

export class Project1790194300014 implements MigrationInterface {
    name = 'Project1790194300014'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "project" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_dedfea394088ed136ddadeee89c" UNIQUE ("name"), CONSTRAINT "PK_4d68b1358bb5b766d3e78f32f57" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "action" ADD "projectId" integer`);
        await queryRunner.query(`ALTER TABLE "action" ADD CONSTRAINT "FK_7aa669b5d45a9916651005fb8cc" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action" DROP CONSTRAINT "FK_7aa669b5d45a9916651005fb8cc"`);
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "projectId"`);
        await queryRunner.query(`DROP TABLE "project"`);
    }

}
