import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * `ActionFormVariantService` keeps a member who submitted the task form on it
 * only when it first assigns them, and assignments are sticky, so one drawn
 * into a variant earlier stays on a form they cannot submit.
 */
export class KeepSubmittersOnTaskForm1791762748605 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE action_form_assignment AS assignment
      SET "variantId" = NULL
      FROM action, form_response
      WHERE action.id = assignment."actionId"
        AND form_response."formId" = action."taskFormId"
        AND form_response."userId" = assignment."userId"
        AND assignment."variantId" IS NOT NULL
    `);
  }

  public async down(): Promise<void> {}
}
