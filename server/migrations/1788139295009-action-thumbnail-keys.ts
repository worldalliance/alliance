import { MigrationInterface, QueryRunner } from "typeorm";

import { UPLOAD_KEY } from "./lib/rendered-image-url";

// The admin form takes a thumbnail as free text, so the key shape alone would
// rewrite an external url like `https://images.unsplash.com/1707862.webp`. Each
// branch is one prefix getImageSource renders a key behind.
const RENDERED_PREFIX =
  "^(?:https?://[^/]+\\.cloudfront\\.net/|https?://[^/]+/api/images/|http://localhost(?::[0-9]+)?/images/)";

const RENDERED_KEY_URL = `${RENDERED_PREFIX}${UPLOAD_KEY}$`;

export class ActionThumbnailKeys1788139295009 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ count }]: { count: number }[] = await queryRunner.query(
      `SELECT count(*)::int AS count FROM "action" WHERE "squareThumbnailImage" ~ $1`,
      [RENDERED_KEY_URL],
    );
    await queryRunner.query(
      `UPDATE "action"
       SET "squareThumbnailImage" = regexp_replace("squareThumbnailImage", $1, '')
       WHERE "squareThumbnailImage" ~ $2`,
      [RENDERED_PREFIX, RENDERED_KEY_URL],
    );
    console.log(`[action-thumbnail-keys] rewrote ${count} thumbnails`);
  }

  // Which host each key was rendered as is gone, and a key renders correctly in
  // every environment, so there is nothing worth restoring.
  public async down(): Promise<void> {}
}
