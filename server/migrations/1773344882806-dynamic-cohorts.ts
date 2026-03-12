import { MigrationInterface, QueryRunner } from 'typeorm';

export class DynamicCohorts1773344882806 implements MigrationInterface {
  name = 'DynamicCohorts1773344882806';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new cohortExpression JSONB column
    await queryRunner.query(
      `ALTER TABLE "action" ADD "cohortExpression" jsonb`,
    );

    // Migrate manual cohort actions → Manual leaf
    await queryRunner.query(`
          UPDATE "action"
          SET "cohortExpression" = jsonb_build_object(
            'type', 'Manual',
            'userIds', COALESCE("manualCohortUserIds", '{}')
          )
          WHERE "useManualCohort" = true
        `);

    // Migrate tag-based actions:
    // Single tag → Tag leaf, multiple tags → OR(Tag, Tag, ...)
    await queryRunner.query(`
          UPDATE "action" a SET "cohortExpression" = (
            SELECT CASE
              WHEN count(*) = 1 THEN jsonb_build_object('type', 'Tag', 'tagId', min(apt."tagId"::text))
              WHEN count(*) > 1 THEN jsonb_build_object('op', 'OR', 'children',
                jsonb_agg(jsonb_build_object('type', 'Tag', 'tagId', apt."tagId"::text)))
              ELSE NULL END
            FROM "action_participating_tags_tag" apt WHERE apt."actionId" = a.id
          ) WHERE "useManualCohort" = false
            AND EXISTS (SELECT 1 FROM "action_participating_tags_tag" WHERE "actionId" = a.id)
        `);

    // Drop old columns
    await queryRunner.query(
      `ALTER TABLE "action" DROP COLUMN "useManualCohort"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action" DROP COLUMN "manualCohortUserIds"`,
    );

    // Drop old join table
    await queryRunner.query(`DROP TABLE "action_participating_tags_tag"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate join table
    await queryRunner.query(`
          CREATE TABLE "action_participating_tags_tag" (
            "actionId" integer NOT NULL,
            "tagId" uuid NOT NULL,
            CONSTRAINT "PK_action_participating_tags_tag" PRIMARY KEY ("actionId", "tagId")
          )
        `);
    await queryRunner.query(`
          ALTER TABLE "action_participating_tags_tag"
            ADD CONSTRAINT "FK_action_participating_tags_tag_actionId"
            FOREIGN KEY ("actionId") REFERENCES "action"("id")
            ON DELETE CASCADE ON UPDATE CASCADE
        `);
    await queryRunner.query(`
          ALTER TABLE "action_participating_tags_tag"
            ADD CONSTRAINT "FK_action_participating_tags_tag_tagId"
            FOREIGN KEY ("tagId") REFERENCES "tag"("id")
            ON DELETE CASCADE ON UPDATE CASCADE
        `);

    // Recreate old columns
    await queryRunner.query(
      `ALTER TABLE "action" ADD "useManualCohort" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "action" ADD "manualCohortUserIds" integer[]`,
    );

    // Reverse migrate Manual expressions → useManualCohort + manualCohortUserIds
    await queryRunner.query(`
          UPDATE "action"
          SET "useManualCohort" = true,
              "manualCohortUserIds" = (
                SELECT ARRAY(SELECT jsonb_array_elements_text("cohortExpression"->'userIds')::int)
              )
          WHERE "cohortExpression"->>'type' = 'Manual'
        `);

    // Reverse migrate Tag expressions → join table rows
    // Handle single Tag leaf
    await queryRunner.query(`
          INSERT INTO "action_participating_tags_tag" ("actionId", "tagId")
          SELECT id, ("cohortExpression"->>'tagId')::uuid
          FROM "action"
          WHERE "cohortExpression"->>'type' = 'Tag'
        `);

    // Handle OR(Tag, Tag, ...) expressions
    await queryRunner.query(`
          INSERT INTO "action_participating_tags_tag" ("actionId", "tagId")
          SELECT a.id, (child->>'tagId')::uuid
          FROM "action" a,
            jsonb_array_elements(a."cohortExpression"->'children') AS child
          WHERE a."cohortExpression"->>'op' = 'OR'
            AND child->>'type' = 'Tag'
        `);

    // Drop the cohortExpression column
    await queryRunner.query(
      `ALTER TABLE "action" DROP COLUMN "cohortExpression"`,
    );
  }
}
