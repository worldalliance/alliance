import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Every post, comment and action update is created with content, so the
 * nullable FK only ever described a state the code can't reach. Making it
 * `NOT NULL` is what lets the entities type the relation as always present.
 *
 * The backfill is insurance for legacy rows predating the current write paths:
 * `SET NOT NULL` would abort the deploy on the first one. Empty content matches
 * how `ActionActivityDto` already renders a missing relation.
 */
const BACKFILL: { table: string; column: string }[] = [
  { table: 'post', column: 'editableContentId' },
  { table: 'comment', column: 'editableContentId' },
  { table: 'action_update', column: 'contentId' },
];

export class RequireEditableContent1785802756097 implements MigrationInterface {
  name = 'RequireEditableContent1785802756097';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { table, column } of BACKFILL) {
      await queryRunner.query(`
        DO $$
        DECLARE
          row_id INT;
          content_id INT;
        BEGIN
          FOR row_id IN SELECT "id" FROM "${table}" WHERE "${column}" IS NULL LOOP
            INSERT INTO "editable_content" ("body", "attachments")
            VALUES ('', '[]'::jsonb)
            RETURNING "id" INTO content_id;

            UPDATE "${table}" SET "${column}" = content_id WHERE "id" = row_id;
          END LOOP;
        END $$;
      `);

      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" SET NOT NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The backfilled rows aren't distinguishable from the rest, so they stay.
    for (const { table, column } of BACKFILL) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" DROP NOT NULL`,
      );
    }
  }
}
