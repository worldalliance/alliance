import { MigrationInterface, QueryRunner } from "typeorm";

import { RENDERED_KEY_URL, URL_PREFIX } from "./lib/rendered-image-url";

// A community conversation's photo is a copy of the group photo, so it took the
// same urls.
const TABLES = ["community", "conversation"];

export class CommunityPhotoKeys1788120096807 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      const [{ count }]: { count: number }[] = await queryRunner.query(
        `SELECT count(*)::int AS count FROM "${table}" WHERE "photo" ~ $1`,
        [RENDERED_KEY_URL],
      );
      await queryRunner.query(
        `UPDATE "${table}"
         SET "photo" = regexp_replace("photo", $1, '')
         WHERE "photo" ~ $2`,
        [URL_PREFIX, RENDERED_KEY_URL],
      );
      console.log(`[community-photo-keys] rewrote ${count} ${table} photos`);
    }
  }

  // Which host each key was rendered as is gone, and a key renders correctly in
  // every environment, so there is nothing worth restoring.
  public async down(): Promise<void> {}
}
