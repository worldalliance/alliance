import {
  formSchema,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import { Logger } from "@nestjs/common";
import type { FormSnapshot } from "./entities/formsnapshot.entity";

const logger = new Logger("FormSnapshotSchema");
const checkedSnapshotIds = new Set<number>();

export function formSchemaOf(snapshot: FormSnapshot): FormSchema {
  // Returns the stored row even when the parse fails: rows can fail refinements
  // added after they were written, and parse defaults would change the schema a
  // legacy client echoes back to findHistoricalBySchemaOrThrow. Snapshot rows
  // never change, so one parse per id is enough.
  if (!checkedSnapshotIds.has(snapshot.id)) {
    checkedSnapshotIds.add(snapshot.id);
    const parsed = formSchema.safeParse(snapshot.schema);
    if (!parsed.success) {
      logger.error(
        `form snapshot ${snapshot.id} fails formSchema; serving it unparsed: ${JSON.stringify(parsed.error.issues)}`,
      );
    }
  }
  return snapshot.schema as FormSchema;
}
