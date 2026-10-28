import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionCustomStatLabelBlankToNull1793208244853
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "action" SET "customStatLabel" = NULL
       WHERE btrim("customStatLabel") = ''`,
    );
  }

  // A blank label and a missing one read the same, so there is nothing to restore.
  public async down(): Promise<void> {}
}
