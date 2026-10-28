import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionImageBlankToNull1793207737733 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "action" SET "image" = NULL WHERE btrim("image") = ''`,
    );
  }

  // A blank image and a missing one read the same, so there is nothing to restore.
  public async down(): Promise<void> {}
}
