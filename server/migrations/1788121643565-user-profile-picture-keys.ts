import { MigrationInterface, QueryRunner } from "typeorm";

import { RENDERED_KEY_URL, URL_PREFIX } from "./lib/rendered-image-url";

// A picture that was blank rather than a key rendered as the bare prefix, so
// there is no key left to recover and the column should be empty.
const RENDERED_EMPTY_URL = `${URL_PREFIX}$`;

export class UserProfilePictureKeys1788121643565 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ count }]: { count: number }[] = await queryRunner.query(
      `SELECT count(*)::int AS count FROM "user" WHERE "profilePicture" ~ $1`,
      [RENDERED_KEY_URL],
    );
    await queryRunner.query(
      `UPDATE "user"
       SET "profilePicture" = regexp_replace("profilePicture", $1, '')
       WHERE "profilePicture" ~ $2`,
      [URL_PREFIX, RENDERED_KEY_URL],
    );

    const [{ count: emptied }]: { count: number }[] = await queryRunner.query(
      `SELECT count(*)::int AS count FROM "user" WHERE "profilePicture" ~ $1`,
      [RENDERED_EMPTY_URL],
    );
    await queryRunner.query(
      `UPDATE "user" SET "profilePicture" = NULL WHERE "profilePicture" ~ $1`,
      [RENDERED_EMPTY_URL],
    );

    console.log(
      `[user-profile-picture-keys] rewrote ${count} pictures, cleared ${emptied}`,
    );
  }

  // Which host each key was rendered as is gone, and a key renders correctly in
  // every environment, so there is nothing worth restoring.
  public async down(): Promise<void> {}
}
