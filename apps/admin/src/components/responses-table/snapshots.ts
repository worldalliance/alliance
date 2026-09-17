import {
  fieldHasOptions,
  type AnyField,
} from "@alliance/common/forms/form-schema";
import { columnLabel, type SnapshotFieldSet } from "./columns";

export type SnapshotChanges = {
  added: string[];
  removed: string[];
  reworded: Array<{ from: string; to: string }>;
  optionsChanged: string[];
};

export type SnapshotEntry = {
  snapshotId: number;
  isCurrent: boolean;
  responseCount: number;
  firstResponseAt: string | null;
  lastResponseAt: string | null;
  /** Against the next-older snapshot in this list; null for the oldest. */
  changes: SnapshotChanges | null;
};

const optionSignature = (field: AnyField): string =>
  fieldHasOptions(field)
    ? field.options.map((option) => `${option.value}=${option.label}`).join("|")
    : "";

function diffSnapshotFields(params: {
  before: readonly AnyField[];
  after: readonly AnyField[];
}): SnapshotChanges {
  const before = new Map(params.before.map((field) => [field.id, field]));
  const after = new Map(params.after.map((field) => [field.id, field]));

  const changes: SnapshotChanges = {
    added: [],
    removed: [],
    reworded: [],
    optionsChanged: [],
  };

  for (const [id, field] of after) {
    const previous = before.get(id);
    if (!previous) {
      changes.added.push(columnLabel(field).label);
      continue;
    }
    const from = columnLabel(previous).label;
    const to = columnLabel(field).label;
    if (from !== to) changes.reworded.push({ from, to });
    if (optionSignature(previous) !== optionSignature(field)) {
      changes.optionsChanged.push(to);
    }
  }
  for (const [id, field] of before) {
    if (!after.has(id)) changes.removed.push(columnLabel(field).label);
  }
  return changes;
}

/**
 * A snapshot reduced to what an admin compares between versions: the question
 * fields, in order, without the builder bookkeeping that differs on every save.
 */
export function normalizeSnapshotFields(
  fields: readonly AnyField[],
): Array<Record<string, unknown>> {
  return fields.map((field) => ({
    id: field.id,
    kind: field.kind,
    label: field.label ?? null,
    required: field.required ?? false,
    ...(fieldHasOptions(field)
      ? { options: field.options.map((option) => option.label) }
      : {}),
  }));
}

export const hasChanges = (changes: SnapshotChanges): boolean =>
  changes.added.length > 0 ||
  changes.removed.length > 0 ||
  changes.reworded.length > 0 ||
  changes.optionsChanged.length > 0;

/**
 * Every snapshot the loaded responses were submitted against, plus the current
 * one, newest first.
 */
export function buildSnapshotEntries(params: {
  fields: SnapshotFieldSet;
  responses: readonly { formSnapshotId: number; createdAt: string }[];
}): SnapshotEntry[] {
  const { fields, responses } = params;
  const counts = new Map<
    number,
    { count: number; first: string; last: string }
  >();
  for (const response of responses) {
    const existing = counts.get(response.formSnapshotId);
    if (!existing) {
      counts.set(response.formSnapshotId, {
        count: 1,
        first: response.createdAt,
        last: response.createdAt,
      });
      continue;
    }
    existing.count += 1;
    if (response.createdAt < existing.first)
      existing.first = response.createdAt;
    if (response.createdAt > existing.last) existing.last = response.createdAt;
  }

  const snapshotIds = new Set(counts.keys());
  if (fields.currentSnapshotId !== null) {
    snapshotIds.add(fields.currentSnapshotId);
  }

  return [...snapshotIds]
    .sort((a, b) => a - b)
    .map((snapshotId, index, ascending) => {
      const previousId = ascending[index - 1];
      const previous =
        previousId === undefined
          ? null
          : (fields.bySnapshotId.get(previousId) ?? null);
      const current = fields.bySnapshotId.get(snapshotId) ?? [];
      const stats = counts.get(snapshotId);
      return {
        snapshotId,
        isCurrent: snapshotId === fields.currentSnapshotId,
        responseCount: stats?.count ?? 0,
        firstResponseAt: stats?.first ?? null,
        lastResponseAt: stats?.last ?? null,
        changes: previous
          ? diffSnapshotFields({ before: previous, after: current })
          : null,
      };
    })
    .reverse();
}
