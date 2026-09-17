import {
  elementInternalDescriptor,
  FIELD_KIND_NAMES,
} from "@alliance/common/forms/element-descriptors";
import type { AnyField } from "@alliance/common/forms/form-schema";
import { storedQuestionFields } from "@alliance/common/forms/stored-schema";
import { R } from "@alliance/common/result";

export enum SnapshotMode {
  Focused = "focused",
  Expanded = "expanded",
}

const questionColumnId = (fieldId: string): string => `q:${fieldId}`;

export type SnapshotSource = {
  formSnapshotId: number;
  schemaSnapshot: { [key: string]: unknown };
  answers: { [key: string]: unknown };
};

export type SchemaParseFailure = {
  snapshotId: number | null;
  message: string;
};

export type SnapshotFieldSet = {
  currentSnapshotId: number | null;
  currentFields: AnyField[];
  /** Question fields per snapshot id, current snapshot included. */
  bySnapshotId: Map<number, AnyField[]>;
  failures: SchemaParseFailure[];
};

export type Wording = { snapshotId: number; label: string };

export type QuestionColumn = {
  id: string;
  fieldId: string;
  field: AnyField;
  label: string;
  /** The field carries no label, so `label` is a stand-in built from its kind. */
  untitled: boolean;
  /** Absent from the current snapshot. */
  retired: boolean;
  lastSeenSnapshotId: number | null;
  /** Every distinct wording, oldest first. One entry means the label never changed. */
  wordings: Wording[];
};

const isEmptyAnswer = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
};

export function columnLabel(field: AnyField): {
  label: string;
  untitled: boolean;
} {
  return field.label?.trim()
    ? { label: elementInternalDescriptor(field), untitled: false }
    : { label: `Untitled ${FIELD_KIND_NAMES[field.kind]}`, untitled: true };
}

const dedupeById = (fields: AnyField[]): AnyField[] => {
  const seen = new Set<string>();
  return fields.filter((field) => {
    if (seen.has(field.id)) return false;
    seen.add(field.id);
    return true;
  });
};

export function collectSnapshotFields(params: {
  currentSchema: unknown;
  currentSnapshotId: number | null;
  responses: readonly SnapshotSource[];
}): SnapshotFieldSet {
  const { currentSchema, currentSnapshotId, responses } = params;
  const bySnapshotId = new Map<number, AnyField[]>();
  const failures: SchemaParseFailure[] = [];

  const current = storedQuestionFields(currentSchema);
  const currentFields = R.match(current, {
    success: dedupeById,
    failure: (error) => {
      failures.push({
        snapshotId: currentSnapshotId,
        message: error.issues[0]?.message ?? "schema did not parse",
      });
      return [];
    },
  });
  if (currentSnapshotId !== null) {
    bySnapshotId.set(currentSnapshotId, currentFields);
  }

  for (const response of responses) {
    const snapshotId = response.formSnapshotId;
    if (bySnapshotId.has(snapshotId)) continue;
    R.match(storedQuestionFields(response.schemaSnapshot), {
      success: (fields) => {
        bySnapshotId.set(snapshotId, dedupeById(fields));
      },
      failure: (error) => {
        failures.push({
          snapshotId,
          message: error.issues[0]?.message ?? "schema did not parse",
        });
      },
    });
  }

  return { currentSnapshotId, currentFields, bySnapshotId, failures };
}

/**
 * Field ids that hold an answer somewhere in the loaded responses but are gone
 * from the current snapshot, and so are invisible in focused mode. Ids no
 * loaded snapshot declares are left out: expanding gives them no column either.
 */
function orphanedFieldIds(params: {
  responses: readonly SnapshotSource[];
  fields: SnapshotFieldSet;
}): string[] {
  const { responses, fields } = params;
  const currentIds = new Set(fields.currentFields.map((field) => field.id));
  const declaredIds = new Set<string>();
  for (const [snapshotId, snapshotFields] of fields.bySnapshotId) {
    if (snapshotId === fields.currentSnapshotId) continue;
    for (const field of snapshotFields) declaredIds.add(field.id);
  }

  const orphans = new Set<string>();
  for (const response of responses) {
    for (const [fieldId, value] of Object.entries(response.answers ?? {})) {
      if (currentIds.has(fieldId)) continue;
      if (!declaredIds.has(fieldId)) continue;
      if (isEmptyAnswer(value)) continue;
      orphans.add(fieldId);
    }
  }
  return [...orphans].sort();
}

export function autoSnapshotMode(params: {
  responses: readonly SnapshotSource[];
  fields: SnapshotFieldSet;
}): SnapshotMode {
  return orphanedFieldIds(params).length > 0
    ? SnapshotMode.Expanded
    : SnapshotMode.Focused;
}

const wordingsFor = (params: {
  fieldId: string;
  bySnapshotId: Map<number, AnyField[]>;
}): Wording[] => {
  const { fieldId, bySnapshotId } = params;
  const wordings: Wording[] = [];
  const snapshotIds = [...bySnapshotId.keys()].sort((a, b) => a - b);
  for (const snapshotId of snapshotIds) {
    const field = bySnapshotId.get(snapshotId)?.find((f) => f.id === fieldId);
    if (!field) continue;
    const { label } = columnLabel(field);
    if (wordings[wordings.length - 1]?.label === label) continue;
    wordings.push({ snapshotId, label });
  }
  return wordings;
};

const toColumn = (params: {
  field: AnyField;
  retired: boolean;
  lastSeenSnapshotId: number | null;
  bySnapshotId: Map<number, AnyField[]>;
}): QuestionColumn => {
  const { field, retired, lastSeenSnapshotId, bySnapshotId } = params;
  const { label, untitled } = columnLabel(field);
  return {
    id: questionColumnId(field.id),
    fieldId: field.id,
    field,
    label,
    untitled,
    retired,
    lastSeenSnapshotId,
    wordings: wordingsFor({ fieldId: field.id, bySnapshotId }),
  };
};

/**
 * Current-snapshot fields in schema order. Expanded mode then appends the
 * fields only older snapshots declare, most recently retired first.
 */
export function buildQuestionColumns(params: {
  fields: SnapshotFieldSet;
  mode: SnapshotMode;
}): QuestionColumn[] {
  const { fields, mode } = params;
  const { bySnapshotId, currentFields, currentSnapshotId } = fields;
  const currentIds = new Set(currentFields.map((field) => field.id));

  const columns = currentFields.map((field) =>
    toColumn({
      field,
      retired: false,
      lastSeenSnapshotId: currentSnapshotId,
      bySnapshotId,
    }),
  );
  if (mode === SnapshotMode.Focused) return columns;

  const retired = new Map<string, { field: AnyField; snapshotId: number }>();
  const snapshotIds = [...bySnapshotId.keys()].sort((a, b) => a - b);
  for (const snapshotId of snapshotIds) {
    if (snapshotId === currentSnapshotId) continue;
    for (const field of bySnapshotId.get(snapshotId) ?? []) {
      if (currentIds.has(field.id)) continue;
      retired.set(field.id, { field, snapshotId });
    }
  }

  const retiredColumns = [...retired.values()]
    .sort((a, b) => b.snapshotId - a.snapshotId)
    .map(({ field, snapshotId }) =>
      toColumn({
        field,
        retired: true,
        lastSeenSnapshotId: snapshotId,
        bySnapshotId,
      }),
    );

  return [...columns, ...retiredColumns];
}
