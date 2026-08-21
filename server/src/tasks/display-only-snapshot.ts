import {
  emptyDisplayOnlySchema,
  readDisplayOnlySchema,
  type DisplayOnlySchema,
} from "@alliance/common/forms/display-only-schema";
import { Logger } from "@nestjs/common";
import type { FormSnapshot } from "./entities/formsnapshot.entity";

const logger = new Logger("DisplayOnlySnapshot");

/**
 * Narrows a snapshot's `schema` column, which is polymorphic across owners, to
 * the display-only shape.
 *
 * A missing relation throws — that's a forgotten `relations` option, not a data
 * problem. A snapshot that fails to parse is served as empty instead: every
 * write validates, so failing here means corruption or a rollback past the
 * version that wrote it, and one bad row shouldn't take down the whole
 * response. Clients parse again for the opposite case, an app older than the
 * server.
 */
export function displayOnlySchemaOf(params: {
  owner: string;
  ownerId: number;
  snapshot: FormSnapshot | undefined;
}): DisplayOnlySchema {
  const { owner, ownerId, snapshot } = params;

  if (!snapshot) {
    throw new Error(
      `${owner} ${ownerId}: schemaSnapshot was not loaded — the query needs relations: { schemaSnapshot: true }`,
    );
  }

  const parsed = readDisplayOnlySchema(snapshot.schema);
  if (!parsed) {
    logger.error(
      `${owner} ${ownerId}: snapshot ${snapshot.id} is not a valid display-only schema; serving it empty`,
    );
    return emptyDisplayOnlySchema();
  }

  return parsed;
}
