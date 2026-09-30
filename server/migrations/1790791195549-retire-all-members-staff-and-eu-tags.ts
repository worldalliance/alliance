import { MigrationInterface, QueryRunner } from "typeorm";
import { rewriteTagLeavesToComputed } from "./lib/computed-tag-leaves";

export class RetireAllMembersStaffAndEuTags1790791195549 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await rewriteTagLeavesToComputed(queryRunner);
        const references: Array<{ name: string; referrer: string }> = await queryRunner.query(
            `SELECT DISTINCT "tag"."name", "referrer" FROM "tag" JOIN (
                SELECT "tag"."id" AS "tagId", 'a cohort expression' AS "referrer" FROM "tag"
                WHERE EXISTS (SELECT 1 FROM "action" WHERE "cohortExpression"::text LIKE '%' || "tag"."id" || '%')
                OR EXISTS (SELECT 1 FROM "follow_up_form" WHERE "cohortExpression"::text LIKE '%' || "tag"."id" || '%')
                UNION ALL SELECT "userTagId", 'a reminder group' FROM "reminder_group"
                UNION ALL SELECT "tagId", 'an action update' FROM "action_update"
                UNION ALL SELECT "tagId", 'a general update' FROM "general_update_tags_tag"
            ) AS "reference" ON "reference"."tagId" = "tag"."id"
            WHERE "tag"."name" IN ('All Members', 'Staff', 'EU')`,
        );
        if (references.length > 0) {
            throw new Error(
                `Still referenced: ${references.map(({ name, referrer }) => `${name} by ${referrer}`).join(", ")}`,
            );
        }
        await queryRunner.query(`DELETE FROM "tag" WHERE "name" IN ('All Members', 'Staff', 'EU')`);
    }

    // Stage 10's down rewrites the computed leaves onto these tags by name, so
    // they come back holding the members those leaves select. EU's members are lost.
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `INSERT INTO "tag" ("name", "description") VALUES
                ('All Members', 'every alliance member'),
                ('Staff', 'alliance strategic office staff'),
                ('EU', 'tag for EU members')`,
        );
        await queryRunner.query(
            `INSERT INTO "tag_users_user" ("tagId", "userId")
            SELECT "tag"."id", "user"."id" FROM "tag" CROSS JOIN "user"
            WHERE "tag"."name" = 'All Members' OR ("tag"."name" = 'Staff' AND "user"."staff")`,
        );
    }

}
