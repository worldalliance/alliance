import jsonStableStringify from "json-stable-stringify";
import React, { useMemo, useState } from "react";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import Button, { ButtonVariant } from "../ui/Button";

export const stableStringify = (value: unknown): string =>
  jsonStableStringify(value, { space: 2 }) ?? "";

const MONO_FONT_STACK =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

const diffViewerStyles = {
  contentText: { fontFamily: MONO_FONT_STACK },
  lineNumber: { fontFamily: MONO_FONT_STACK },
  gutter: { fontFamily: MONO_FONT_STACK },
  wordDiff: { fontFamily: MONO_FONT_STACK },
  codeFoldContent: { fontFamily: MONO_FONT_STACK },
};

export type FieldEntry = {
  id: string;
  pageIndex: number;
  node: Record<string, unknown>;
};

export const collectFields = (schema: unknown): Map<string, FieldEntry> => {
  const map = new Map<string, FieldEntry>();
  if (!schema || typeof schema !== "object") return map;
  const pages = (schema as { pages?: unknown }).pages;
  if (!Array.isArray(pages)) return map;
  pages.forEach((page, pageIndex) => {
    if (!page || typeof page !== "object") return;
    const fields = (page as { fields?: unknown }).fields;
    if (!Array.isArray(fields)) return;
    for (const field of fields) {
      if (!field || typeof field !== "object") continue;
      const id = (field as { id?: unknown }).id;
      if (typeof id !== "string") continue;
      map.set(id, {
        id,
        pageIndex,
        node: field as Record<string, unknown>,
      });
    }
  });
  return map;
};

export type StructuralChange = {
  added: FieldEntry[];
  removed: FieldEntry[];
  changed: { id: string; old: FieldEntry; latest: FieldEntry }[];
};

export const computeStructuralChange = (
  oldSchema: unknown,
  latestSchema: unknown,
): StructuralChange => {
  const oldFields = collectFields(oldSchema);
  const latestFields = collectFields(latestSchema);
  const added: FieldEntry[] = [];
  const removed: FieldEntry[] = [];
  const changed: { id: string; old: FieldEntry; latest: FieldEntry }[] = [];
  for (const [id, latest] of latestFields) {
    const old = oldFields.get(id);
    if (!old) {
      added.push(latest);
    } else if (stableStringify(old.node) !== stableStringify(latest.node)) {
      changed.push({ id, old, latest });
    }
  }
  for (const [id, old] of oldFields) {
    if (!latestFields.has(id)) removed.push(old);
  }
  return { added, removed, changed };
};

const MAX_LABEL = 60;

/** A question by its label; a block, which has none, by its title or text. */
const getFieldLabel = (field: FieldEntry): string => {
  const kind = field.node["kind"];
  const text = ["label", "title", "text"]
    .map((key) => field.node[key])
    .find((value) => typeof value === "string" && value.trim());
  const labelStr =
    typeof text !== "string"
      ? "(no label)"
      : text.length > MAX_LABEL
        ? `${text.slice(0, MAX_LABEL)}…`
        : text;
  const kindStr = typeof kind === "string" ? kind : "?";
  return `${field.id} · ${kindStr} · ${labelStr}`;
};

/** Page-field diff with optional JSON diff. */
export const SchemaDiffView: React.FC<{ before: unknown; after: unknown }> = ({
  before,
  after,
}) => {
  const [showFullJson, setShowFullJson] = useState(false);
  const change = useMemo(
    () => computeStructuralChange(before, after),
    [before, after],
  );
  const oldText = useMemo(
    () => (showFullJson ? stableStringify(before) : ""),
    [before, showFullJson],
  );
  const newText = useMemo(
    () => (showFullJson ? stableStringify(after) : ""),
    [after, showFullJson],
  );

  const noChanges =
    change.added.length === 0 &&
    change.removed.length === 0 &&
    change.changed.length === 0;
  const groups = [
    { title: "Added", tone: "text-success", fields: change.added },
    { title: "Removed", tone: "text-danger", fields: change.removed },
    {
      title: "Changed",
      tone: "text-warning",
      fields: change.changed.map((c) => ({ ...c.latest, id: c.id })),
    },
  ].filter((group) => group.fields.length > 0);

  return (
    <div className="flex flex-col items-start gap-2 text-body">
      {noChanges ? (
        <p className="text-fg-muted">
          No field-level differences. Other schema metadata may differ: show the
          full JSON diff to check.
        </p>
      ) : (
        groups.map(({ title, tone, fields }) => (
          <div key={title}>
            <p className={`font-medium ${tone}`}>
              {title} ({fields.length})
            </p>
            <ul className="ml-4 list-disc">
              {fields.map((f) => (
                <li key={f.id}>{getFieldLabel(f)}</li>
              ))}
            </ul>
          </div>
        ))
      )}
      <Button
        variant={ButtonVariant.Ghost}
        size="small"
        aria-expanded={showFullJson}
        onClick={() => setShowFullJson((v) => !v)}
      >
        {showFullJson ? "Hide full JSON diff" : "Show full JSON diff"}
      </Button>
      {showFullJson && (
        <div className="max-h-96 w-full overflow-auto rounded-md border border-line text-caption">
          <ReactDiffViewer
            oldValue={oldText}
            newValue={newText}
            splitView={false}
            compareMethod={DiffMethod.WORDS_WITH_SPACE}
            showDiffOnly={true}
            extraLinesSurroundingDiff={2}
            hideLineNumbers={false}
            styles={diffViewerStyles}
          />
        </div>
      )}
    </div>
  );
};
