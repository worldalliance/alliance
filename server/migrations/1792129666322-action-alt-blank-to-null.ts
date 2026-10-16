import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionAltBlankToNull1792129666322 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "action" SET "squareThumbnailImageAlt" = NULL
       WHERE btrim("squareThumbnailImageAlt") = ''`,
    );
  }

  // A blank alt and a missing one read the same, so there is nothing to restore.
  public async down(): Promise<void> {}
}
