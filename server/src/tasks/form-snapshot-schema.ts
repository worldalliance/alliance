import {
  formSchema,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import { memberSchema } from "@alliance/common/forms/row-list";
import type { AssignedRow } from "@alliance/common/forms/row-list-schema";
import { Logger } from "@nestjs/common";
import { FormSnapshot } from "./entities/formsnapshot.entity";

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

/** A snapshot's schema as a member is sent it; see `memberSchema`. */
export function memberSnapshotSchema(
  snapshot: FormSnapshot,
  assignedRow: AssignedRow | null,
): FormSchema {
  return memberSchema(formSchemaOf(snapshot), assignedRow);
}

export function cloneFormSnapshotWithSchema(
  snapshot: FormSnapshot,
  schema: Record<string, unknown>,
): FormSnapshot {
  return Object.assign(new FormSnapshot(), snapshot, { schema });
}

export function snapshotForRow(
  snapshot: FormSnapshot,
  row: AssignedRow | null,
): FormSnapshot {
  return cloneFormSnapshotWithSchema(
    snapshot,
    memberSnapshotSchema(snapshot, row),
  );
}
