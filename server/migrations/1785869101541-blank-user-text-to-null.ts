import { MigrationInterface, QueryRunner } from 'typeorm';

/** Nullable free-text columns on `user` that must spell absence as NULL. */
const COLUMNS = ['profilePicture', 'profileDescription', 'customCityString'];

export class BlankUserTextToNull1785869101541 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const column of COLUMNS) {
      await queryRunner.query(
        `UPDATE "user" SET "${column}" = NULL WHERE TRIM("${column}") = ''`,
      );
    }
  }

  public async down(): Promise<void> {
    // Blank already meant the same thing as NULL to every reader, so there
    // is nothing to restore and no way to tell the collapsed rows apart.
  }
}
