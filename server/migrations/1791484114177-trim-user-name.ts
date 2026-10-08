import { MigrationInterface, QueryRunner } from "typeorm";

// The characters JS `String.prototype.trim` strips; Postgres `trim()` strips only spaces.
const WHITESPACE =
  "[\\s\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]";

export class TrimUserName1791484114177 implements MigrationInterface {
  name = "TrimUserName1791484114177";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "user" SET "name" = regexp_replace("name", '^${WHITESPACE}+|${WHITESPACE}+$', '', 'g') WHERE "name" ~ '^${WHITESPACE}|${WHITESPACE}$'`,
    );
  }

  public async down(): Promise<void> {}
}
