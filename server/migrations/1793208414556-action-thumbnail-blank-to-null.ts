import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionThumbnailBlankToNull1793208414556
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "action" SET "squareThumbnailImage" = NULL
       WHERE btrim("squareThumbnailImage") = ''`,
    );
  }

  // A blank thumbnail and a missing one render the same, so there is nothing to restore.
  public async down(): Promise<void> {}
}
