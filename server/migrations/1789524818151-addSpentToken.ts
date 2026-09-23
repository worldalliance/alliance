import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSpentToken1789524818151 implements MigrationInterface {
    name = 'AddSpentToken1789524818151'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "spent_token" ("hash" character varying NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_77fa35e71b4c9b9d2de16f23698" PRIMARY KEY ("hash"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d0a022a42ac9398dbec7fa9dfc" ON "spent_token" ("expiresAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_d0a022a42ac9398dbec7fa9dfc"`);
        await queryRunner.query(`DROP TABLE "spent_token"`);
    }

}
