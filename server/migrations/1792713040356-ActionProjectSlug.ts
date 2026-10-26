import { MigrationInterface, QueryRunner } from "typeorm";
import { backfillSlugs, type SlugRow } from "./lib/slug-backfill";

export class ActionProjectSlug1792713040356 implements MigrationInterface {
    name = 'ActionProjectSlug1792713040356'

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const table of ["project", "action"]) {
            await queryRunner.query(`ALTER TABLE "${table}" ADD "slug" character varying(80)`);
            const rows: SlugRow[] = await queryRunner.query(
                `SELECT "id", "name", "deletedAt" IS NOT NULL AS "deleted" FROM "${table}"`,
            );
            const slugs = backfillSlugs({ table, rows });
            await queryRunner.query(
                `UPDATE "${table}" t SET "slug" = s."slug"
                 FROM unnest($1::int[], $2::text[]) AS s("id", "slug")
                 WHERE t."id" = s."id"`,
                [[...slugs.keys()], [...slugs.values()]],
            );
            await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "slug" SET NOT NULL`);
        }
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_project_slug_live" ON "project" ("slug") WHERE "deletedAt" IS NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_action_slug_live" ON "action" ("slug") WHERE "deletedAt" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_action_slug_live"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_project_slug_live"`);
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "slug"`);
        await queryRunner.query(`ALTER TABLE "project" DROP COLUMN "slug"`);
    }

}
