import { MigrationInterface, QueryRunner } from "typeorm";

export class Lease1795110402728 implements MigrationInterface {
    name = 'Lease1795110402728'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "lease" ("key" text NOT NULL, "owner" text, "fencingToken" bigint NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_25f42d9995912c7f44087be1c1a" PRIMARY KEY ("key"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "lease"`);
    }

}
