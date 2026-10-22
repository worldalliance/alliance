import type { DisplayKind } from "@alliance/common/forms/display-blocks";
import { isDisplayOnlyBlockKind } from "@alliance/common/forms/display-only-schema";
import {
  ADDABLE_FIELD_KINDS,
  DISPLAY_KIND_NAMES,
  DISPLAY_KINDS,
  FIELD_KIND_NAMES,
} from "@alliance/common/forms/element-descriptors";
import type {
  FieldKind,
  Page,
  PageItem,
} from "@alliance/common/forms/form-schema";
import { cn } from "@alliance/shared/styles/util";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { describeElement } from "./canvasSelection";

/** `groupKey` marks an insert point inside a visibility group. */
export type InsertLoc = { groupKey: string | null; index: number };

export const sameInsertLoc = (a: InsertLoc | null, b: InsertLoc) =>
  a != null && a.groupKey === b.groupKey && a.index === b.index;

export type AvailableElement =
  | { id: FieldKind; name: string; type: "field" }
  | { id: DisplayKind; name: string; type: "block"; kind: DisplayKind }
  | { id: "copy-existing"; name: "Copy Existing Element"; type: "copy" };

export const AVAILABLE_ELEMENTS: AvailableElement[] = [
  ...ADDABLE_FIELD_KINDS.map((kind) => ({
    id: kind,
    name: FIELD_KIND_NAMES[kind],
    type: "field" as const,
  })),
  ...DISPLAY_KINDS.map((kind) => ({
    id: kind,
    name: DISPLAY_KIND_NAMES[kind],
    type: "block" as const,
    kind,
  })),
  { id: "copy-existing", name: "Copy Existing Element", type: "copy" },
];

export const DISPLAY_ONLY_ELEMENTS = AVAILABLE_ELEMENTS.filter(
  (element) => element.type === "block" && isDisplayOnlyBlockKind(element.kind),
);

const ELEMENT_TYPE_BADGES: Record<
  AvailableElement["type"],
  { label: string; className: string }
> = {
  field: { label: "Field", className: "bg-blue-100 text-blue-800" },
  block: { label: "Block", className: "bg-green-100 text-green-800" },
  copy: { label: "Copy", className: "bg-purple-100 text-purple-800" },
};

export enum InsertMode {
  Search = "search",
  Copy = "copy",
}

type InsertPointProps = {
  loc: InsertLoc;
  /** The picker open here, if any. */
  mode: InsertMode | null;
  onOpen: () => void;
  onClose: () => void;
  elements: AvailableElement[];
  onPick: (element: AvailableElement) => void;
  pages: Page[];
  onCopy: (source: PageItem) => void;
  /** Always shown, labeled, rather than revealed on hover or focus. */
  prominent?: boolean;
};

export function InsertPoint({
  loc,
  mode,
  onOpen,
  onClose,
  elements,
  onPick,
  pages,
  onCopy,
  prominent = false,
}: InsertPointProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (mode === null) return;
    const handleMouseDown = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        rootRef.current?.contains(event.target)
      ) {
        return;
      }
      onClose();
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [mode, onClose]);

  const closeAndReturn = () => {
    onClose();
    triggerRef.current?.focus();
  };

  return (
    <div
      ref={rootRef}
      className={cn(
        "group/insert relative flex items-center justify-center",
        prominent ? "py-2" : "h-6",
      )}
    >
      {prominent ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={onOpen}
          aria-expanded={mode !== null}
          className="flex items-center gap-1 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:border-blue-400 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add element
        </button>
      ) : (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-blue-300 opacity-0 transition-opacity group-hover/insert:opacity-100 group-focus-within/insert:opacity-100" />
          <button
            ref={triggerRef}
            type="button"
            onClick={onOpen}
            aria-label="Add element here"
            title="Add element here"
            aria-expanded={mode !== null}
            className={cn(
              "relative z-10 flex h-6 w-6 items-center justify-center rounded-full border border-blue-500 bg-white text-blue-600 shadow transition-opacity hover:bg-blue-50 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 group-hover/insert:opacity-100",
              mode === null && "opacity-0",
            )}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </>
      )}
      {mode !== null && (
        <div className="absolute left-1/2 top-full z-30 mt-1 w-80 -translate-x-1/2">
          {mode === InsertMode.Copy ? (
            <CopyElementPicker
              pages={pages}
              onCopy={onCopy}
              onCancel={closeAndReturn}
            />
          ) : (
            <ElementSearch
              elements={
                loc.groupKey === null
                  ? elements
                  : elements.filter((element) => element.type !== "copy")
              }
              onPick={onPick}
              onCancel={closeAndReturn}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ElementSearch({
  elements,
  onPick,
  onCancel,
}: {
  elements: AvailableElement[];
  onPick: (element: AvailableElement) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const results = elements.filter((element) =>
    element.name.toLowerCase().includes(normalized),
  );

  return (
    <div className="rounded-md border border-gray-200 bg-white shadow-lg">
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          } else if (event.key === "Enter" && results[0]) {
            event.preventDefault();
            onPick(results[0]);
          }
        }}
        aria-label="Search elements"
        placeholder="Search questions and content…"
        className="w-full rounded-t-md border-b border-gray-200 px-3 py-2 text-sm focus:outline-none"
        autoFocus
      />
      <div className="max-h-64 overflow-y-auto">
        {results.length === 0 ? (
          <p className="px-3 py-2 text-sm text-gray-500">
            No matching elements
          </p>
        ) : (
          results.map((element) => (
            <button
              key={`${element.type}-${element.id}`}
              type="button"
              onClick={() => onPick(element)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
            >
              <span className="font-medium text-gray-900">{element.name}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs",
                  ELEMENT_TYPE_BADGES[element.type].className,
                )}
              >
                {ELEMENT_TYPE_BADGES[element.type].label}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// Kept as UI state rather than a schema element, so an in-progress pick
// never gets saved.
function CopyElementPicker({
  pages,
  onCopy,
  onCancel,
}: {
  pages: Page[];
  onCopy: (source: PageItem) => void;
  onCancel: () => void;
}) {
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const hasCopyableElements = pages.some((page) => page.fields.length > 0);

  const commitSelection = () => {
    const value = selectRef.current?.value;
    if (!value) return;
    const [pageIndex, elementIndex] = value.split(":").map(Number);
    const source = pages[pageIndex]?.fields[elementIndex];
    if (source) {
      onCopy(source);
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-md border border-purple-300 bg-purple-50 px-3 py-2 shadow-lg">
      <select
        ref={selectRef}
        autoFocus
        defaultValue=""
        aria-label="Element to copy"
        onChange={() => setHasSelection(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          } else if (e.key === "Enter") {
            e.preventDefault();
            commitSelection();
          }
        }}
        className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
      >
        <option value="" disabled>
          {hasCopyableElements
            ? "Choose an element to copy…"
            : "No elements to copy yet"}
        </option>
        {pages.map(
          (page, pageIndex) =>
            page.fields.length > 0 && (
              <optgroup
                key={page.id}
                label={page.title || `Page ${pageIndex + 1}`}
              >
                {page.fields.map((element, elementIndex) => (
                  <option
                    key={element.id || `${pageIndex}:${elementIndex}`}
                    value={`${pageIndex}:${elementIndex}`}
                  >
                    {describeElement(element)}
                  </option>
                ))}
              </optgroup>
            ),
        )}
      </select>
      <button
        type="button"
        onClick={commitSelection}
        disabled={!hasSelection}
        className="rounded-md bg-purple-600 px-3 py-1.5 text-sm text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-300"
      >
        Insert
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="text-gray-400 hover:text-gray-600"
        title="Cancel"
        aria-label="Cancel copy"
      >
        ×
      </button>
    </div>
  );
}
