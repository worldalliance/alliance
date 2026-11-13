import { MigrationInterface, QueryRunner } from "typeorm";

export class RecordInboundTexts1794376843403 implements MigrationInterface {
    name = 'RecordInboundTexts1794376843403'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."mms_direction_enum" AS ENUM('inbound', 'outbound')`);
        await queryRunner.query(`ALTER TABLE "mms" ADD "direction" "public"."mms_direction_enum" NOT NULL DEFAULT 'outbound'`);
        await queryRunner.query(`ALTER TABLE "mms" ADD "memberPhoneNumber" character varying GENERATED ALWAYS AS (CASE WHEN "direction" = 'inbound' THEN "from" ELSE "to" END) STORED NOT NULL`);
        await queryRunner.query(`INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (current_database(), $1, $2, $3, $4, $5)`, ["public","mms","GENERATED_COLUMN","memberPhoneNumber","CASE WHEN \"direction\" = 'inbound' THEN \"from\" ELSE \"to\" END"]);
        await queryRunner.query(`COMMENT ON COLUMN "mms"."memberPhoneNumber" IS 'The member''s side of the message'`);
        await queryRunner.query(`CREATE TYPE "public"."mms_keyword_enum" AS ENUM('stop', 'start')`);
        await queryRunner.query(`ALTER TABLE "mms" ADD "keyword" "public"."mms_keyword_enum"`);
        await queryRunner.query(`COMMENT ON COLUMN "mms"."keyword" IS 'The STOP or START keyword the inbound webhook acted on'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_fd5b940f51f26d854a6f0866a8" ON "mms" ("twilioSid") WHERE "direction" = 'inbound'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_fd5b940f51f26d854a6f0866a8"`);
        await queryRunner.query(`ALTER TABLE "mms" DROP COLUMN "keyword"`);
        await queryRunner.query(`DROP TYPE "public"."mms_keyword_enum"`);
        await queryRunner.query(`COMMENT ON COLUMN "mms"."memberPhoneNumber" IS 'The member''s side of the message'`);
        await queryRunner.query(`DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "database" = current_database() AND "schema" = $3 AND "table" = $4`, ["GENERATED_COLUMN","memberPhoneNumber","public","mms"]);
        await queryRunner.query(`ALTER TABLE "mms" DROP COLUMN "memberPhoneNumber"`);
        await queryRunner.query(`ALTER TABLE "mms" DROP COLUMN "direction"`);
        await queryRunner.query(`DROP TYPE "public"."mms_direction_enum"`);
    }

}
