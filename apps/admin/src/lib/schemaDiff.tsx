import jsonStableStringify from "json-stable-stringify";
import React, { useMemo, useState } from "react";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";

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

const getFieldLabel = (field: FieldEntry): string => {
  const label = field.node["label"];
  const kind = field.node["kind"];
  const labelStr =
    typeof label === "string" && label.trim() ? label : "(no label)";
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

  return (
    <div className="space-y-2 text-sm">
      {noChanges ? (
        <p className="text-zinc-500 italic">
          No field-level differences. Other schema metadata may differ — toggle
          full JSON below.
        </p>
      ) : (
        <div className="space-y-2">
          {change.added.length > 0 && (
            <div>
              <p className="font-semibold text-green-700">
                Added ({change.added.length})
              </p>
              <ul className="ml-4 list-disc">
                {change.added.map((f) => (
                  <li key={f.id} className="text-green-700">
                    {getFieldLabel(f)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {change.removed.length > 0 && (
            <div>
              <p className="font-semibold text-red-700">
                Removed ({change.removed.length})
              </p>
              <ul className="ml-4 list-disc">
                {change.removed.map((f) => (
                  <li key={f.id} className="text-red-700">
                    {getFieldLabel(f)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {change.changed.length > 0 && (
            <div>
              <p className="font-semibold text-amber-700">
                Changed ({change.changed.length})
              </p>
              <ul className="ml-4 list-disc">
                {change.changed.map((c) => (
                  <li key={c.id} className="text-amber-700">
                    {getFieldLabel(c.latest)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        className="text-xs text-blue-600 hover:underline"
        onClick={() => setShowFullJson((v) => !v)}
      >
        {showFullJson ? "Hide full JSON diff" : "Show full JSON diff"}
      </button>
      {showFullJson && (
        <div className="max-h-96 overflow-auto rounded-md border border-zinc-200 text-xs">
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
