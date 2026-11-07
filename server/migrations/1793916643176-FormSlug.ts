import { MigrationInterface, QueryRunner } from "typeorm";

export class FormSlug1793916643176 implements MigrationInterface {
    name = 'FormSlug1793916643176'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "form" ADD "slug" character varying(80)`);
        await queryRunner.query(`
            WITH owners AS (
                SELECT a."taskFormId" AS "formId", a.id AS "actionId", 'v' AS seq, 0 AS rank
                  FROM action a WHERE a."deletedAt" IS NULL AND a."taskFormId" IS NOT NULL
                UNION ALL
                SELECT v."formId", a.id, 'v', 1
                  FROM action_form_variant v JOIN action a ON a.id = v."actionId"
                  WHERE v."deletedAt" IS NULL AND a."deletedAt" IS NULL
                UNION ALL
                SELECT f."formId", a.id, 'f', 2
                  FROM follow_up_form f JOIN action a ON a.id = f."actionId"
                  WHERE f."deletedAt" IS NULL AND a."deletedAt" IS NULL
            ),
            owner AS (
                SELECT DISTINCT ON ("formId") * FROM owners ORDER BY "formId", rank
            ),
            numbered AS (
                SELECT o."formId",
                       o.seq || row_number() OVER (PARTITION BY o."actionId", o.seq ORDER BY o."formId") AS slug
                  FROM owner o JOIN form f ON f.id = o."formId"
                  WHERE f."deletedAt" IS NULL
            )
            UPDATE form SET slug = numbered.slug FROM numbered WHERE form.id = numbered."formId"
        `);
        const rest: { id: number }[] = await queryRunner.query(`SELECT id FROM form WHERE slug IS NULL`);
        await queryRunner.query(
            `UPDATE form SET slug = v.slug
               FROM (SELECT unnest($1::int[]) AS id, unnest($2::text[]) AS slug) v
              WHERE form.id = v.id`,
            [rest.map(({ id }) => id), rest.map(({ id }) => id.toString(36))],
        );
        await queryRunner.query(`ALTER TABLE "form" ALTER COLUMN "slug" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "form" DROP COLUMN "slug"`);
    }

}
