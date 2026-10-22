import { MigrationInterface, QueryRunner } from "typeorm";

export class FriendPairUnique1789775462166 implements MigrationInterface {
    name = 'FriendPairUnique1789775462166'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "friend" DROP CONSTRAINT "UQ_907157e850aae30cf8189e9cc54"`);
        await queryRunner.query(`ALTER TABLE "friend" ADD "lowUserId" integer GENERATED ALWAYS AS (LEAST("requesterId", "addresseeId")) STORED NOT NULL`);
        await queryRunner.query(`INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (current_database(), $1, $2, $3, $4, $5)`, ["public","friend","GENERATED_COLUMN","lowUserId","LEAST(\"requesterId\", \"addresseeId\")"]);
        await queryRunner.query(`ALTER TABLE "friend" ADD "highUserId" integer GENERATED ALWAYS AS (GREATEST("requesterId", "addresseeId")) STORED NOT NULL`);
        await queryRunner.query(`INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (current_database(), $1, $2, $3, $4, $5)`, ["public","friend","GENERATED_COLUMN","highUserId","GREATEST(\"requesterId\", \"addresseeId\")"]);
        await queryRunner.query(`ALTER TABLE "friend" ADD CONSTRAINT "UQ_f9beaaa6321980892c394bdb137" UNIQUE ("lowUserId", "highUserId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "friend" DROP CONSTRAINT "UQ_f9beaaa6321980892c394bdb137"`);
        await queryRunner.query(`DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "database" = current_database() AND "schema" = $3 AND "table" = $4`, ["GENERATED_COLUMN","highUserId","public","friend"]);
        await queryRunner.query(`ALTER TABLE "friend" DROP COLUMN "highUserId"`);
        await queryRunner.query(`DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "database" = current_database() AND "schema" = $3 AND "table" = $4`, ["GENERATED_COLUMN","lowUserId","public","friend"]);
        await queryRunner.query(`ALTER TABLE "friend" DROP COLUMN "lowUserId"`);
        await queryRunner.query(`ALTER TABLE "friend" ADD CONSTRAINT "UQ_907157e850aae30cf8189e9cc54" UNIQUE ("requesterId", "addresseeId")`);
    }

}
