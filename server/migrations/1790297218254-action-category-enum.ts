import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionCategoryEnum1790297218254 implements MigrationInterface {
    name = 'ActionCategoryEnum1790297218254'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."project_category_enum" AS ENUM('meta', 'environment', 'poverty', 'democracy', 'technology')`);
        await queryRunner.query(`ALTER TABLE "project" ADD "category" "public"."project_category_enum" array NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`CREATE TYPE "public"."action_category_enum" AS ENUM('meta', 'environment', 'poverty', 'democracy', 'technology')`);
        await queryRunner.query(`ALTER TABLE "action" ADD "categoryNew" "public"."action_category_enum" array NOT NULL DEFAULT '{}'`);
        // An unrecognized legacy token fails the enum cast and aborts the migration.
        await queryRunner.query(`
            UPDATE "action" SET "categoryNew" = mapped.category
            FROM (
                SELECT a.id, array_agg(DISTINCT value::"public"."action_category_enum" ORDER BY value::"public"."action_category_enum") AS category
                FROM "action" a
                CROSS JOIN LATERAL regexp_split_to_table(lower(trim(a.category)), '\\s*,\\s*') AS token
                CROSS JOIN LATERAL unnest(CASE token
                    WHEN '' THEN ARRAY[]::text[]
                    WHEN 'na' THEN ARRAY[]::text[]
                    WHEN 'tech' THEN ARRAY['technology']
                    WHEN 'all' THEN ARRAY['environment', 'poverty', 'democracy', 'technology']
                    ELSE ARRAY[token]
                END) AS value
                GROUP BY a.id
            ) mapped
            WHERE "action".id = mapped.id
        `);
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "category"`);
        await queryRunner.query(`ALTER TABLE "action" RENAME COLUMN "categoryNew" TO "category"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action" ALTER COLUMN "category" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "action" ALTER COLUMN "category" TYPE character varying USING array_to_string("category", ', ')`);
        await queryRunner.query(`DROP TYPE "public"."action_category_enum"`);
        await queryRunner.query(`ALTER TABLE "project" DROP COLUMN "category"`);
        await queryRunner.query(`DROP TYPE "public"."project_category_enum"`);
    }

}
