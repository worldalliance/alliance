import { Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { DataSource } from "typeorm";

// TODO: in a deploy after the one that adds `deletedAt`, stop installing the
// triggers, drop them and then `stamp_legacy_deleted`, then the `deleted`
// columns and the entities' `legacyDeleted` fields. Until then the previous
// release, which reads `deleted`, is what a rollback restores.
const TABLES = ["post", "comment"] as const;

/**
 * The previous release deletes a post or comment by setting only `deleted`,
 * during a deploy's migration window and after a rollback onto this schema.
 * The trigger stamps `deletedAt` on those rows from boot on, and the backfill
 * catches the ones the window left before it. Restoring one by hand means
 * clearing `deleted` too: either stamps `deletedAt` again on a row that still
 * has it.
 */
@Injectable()
export class LegacyDeletedFlagService implements OnApplicationBootstrap {
  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.dataSource.query(
      `CREATE OR REPLACE FUNCTION "stamp_legacy_deleted"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW."deletedAt" := now(); RETURN NEW; END $$`,
    );
    for (const table of TABLES) {
      await this.dataSource.query(
        `CREATE OR REPLACE TRIGGER "${table}_stamp_legacy_deleted" BEFORE INSERT OR UPDATE ON "${table}" FOR EACH ROW WHEN (NEW."deleted" AND NEW."deletedAt" IS NULL) EXECUTE FUNCTION "stamp_legacy_deleted"()`,
      );
      await this.dataSource.query(
        `UPDATE "${table}" SET "deletedAt" = now() WHERE "deleted" AND "deletedAt" IS NULL`,
      );
    }
  }
}
