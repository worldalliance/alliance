import { cn } from "@alliance/shared/styles/util";
import type { Column, Row } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Pencil,
} from "lucide-react";
import React from "react";
import { IdentitySwatch } from "../IdentitySwatch";
import type { CellContent } from "./cells";
import type { QuestionColumn } from "./columns";
import { highlightSegments } from "./search";
import {
  ColumnKind,
  MetaColumnId,
  type ResponseRow,
  type TableColumn,
} from "./types";

/** Long enough that the cell is certainly clipped, so clicking it should expand the row. */
const CLIPPED_TEXT_LENGTH = 48;

const isExpandable = (content: CellContent | undefined): boolean =>
  content !== undefined &&
  (content.summary !== undefined ||
    content.text.includes("\n") ||
    content.text.length > CLIPPED_TEXT_LENGTH);

const headerTitle = (question: QuestionColumn): string => {
  const lines = [question.fieldId];
  if (question.retired && question.lastSeenSnapshotId !== null) {
    lines.push(`Retired, last in v${question.lastSeenSnapshotId}`);
  }
  if (question.wordings.length > 1) {
    lines.push(
      "Wording by version:",
      ...question.wordings.map(
        ({ snapshotId, label }) => `v${snapshotId}: ${label}`,
      ),
    );
  }
  return lines.join("\n");
};

const Highlighted: React.FC<{ text: string; query: string }> = ({
  text,
  query,
}) => (
  <>
    {highlightSegments({ text, query }).map((segment, index) =>
      segment.match ? (
        <mark key={index} className="rounded-sm bg-yellow-200 text-inherit">
          {segment.text}
        </mark>
      ) : (
        <React.Fragment key={index}>{segment.text}</React.Fragment>
      ),
    )}
  </>
);

const CellView: React.FC<{
  content: CellContent | undefined;
  expanded: boolean;
  query: string;
}> = ({ content, expanded, query }) => {
  if (content?.node) return <>{content.node}</>;
  if (!content?.text) return <span className="text-zinc-300">—</span>;
  const text = expanded ? content.text : (content.summary ?? content.text);
  return (
    <span
      className={cn(
        expanded ? "whitespace-pre-line break-words" : "block truncate",
      )}
    >
      <Highlighted text={text} query={query} />
    </span>
  );
};

type GridColumn = { leaf: Column<ResponseRow>; column: TableColumn };

type ResponsesGridProps = {
  visibleColumns: GridColumn[];
  rows: Row<ResponseRow>[];
  expandAll: boolean;
  expandedRowIds: ReadonlySet<number>;
  onToggleRow: (responseId: number) => void;
  openResponseId: number;
  onOpenResponse: (responseId: number) => void;
  query: string;
};

const ResponsesGrid: React.FC<ResponsesGridProps> = ({
  visibleColumns,
  rows,
  expandAll,
  expandedRowIds,
  onToggleRow,
  openResponseId,
  onOpenResponse,
  query,
}) => (
  <div className="overflow-auto rounded-lg border border-zinc-200 bg-white">
    <table className="min-w-full border-separate border-spacing-0 text-sm">
      <thead>
        <tr>
          <th className="sticky top-0 left-0 z-30 w-9 border-b border-zinc-200 bg-zinc-50 p-0" />
          {visibleColumns.map(({ leaf, column }, index) => {
            const sorted = leaf.getIsSorted();
            return (
              <th
                key={column.id}
                scope="col"
                className={cn(
                  "sticky top-0 z-20 max-w-[18rem] min-w-[9rem] border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-left align-bottom font-semibold text-zinc-700",
                  index === 0 && "left-9 z-30",
                )}
              >
                <button
                  type="button"
                  onClick={leaf.getToggleSortingHandler()}
                  className="flex w-full min-w-0 items-center gap-1.5"
                  title={
                    column.kind === ColumnKind.Question
                      ? headerTitle(column.question)
                      : undefined
                  }
                >
                  {column.kind === ColumnKind.Question && (
                    <IdentitySwatch seed={column.question.fieldId} />
                  )}
                  <span
                    className={cn(
                      "min-w-0 truncate",
                      column.kind === ColumnKind.Question &&
                        column.question.retired &&
                        "text-zinc-400 italic",
                    )}
                  >
                    {column.label}
                  </span>
                  {column.kind === ColumnKind.Question &&
                    column.question.wordings.length > 1 && (
                      <Pencil
                        aria-label="Wording changed between versions"
                        className="size-3 shrink-0 text-amber-500"
                      />
                    )}
                  {sorted === "asc" && (
                    <ArrowUp aria-hidden="true" className="size-3.5 shrink-0" />
                  )}
                  {sorted === "desc" && (
                    <ArrowDown
                      aria-hidden="true"
                      className="size-3.5 shrink-0"
                    />
                  )}
                </button>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {rows.map(({ original: row }) => {
          const expanded = expandAll || expandedRowIds.has(row.response.id);
          const isOpen = row.response.id === openResponseId;
          return (
            <tr
              key={row.response.id}
              onClick={() => onOpenResponse(row.response.id)}
              className={cn(
                "cursor-pointer",
                isOpen ? "bg-blue-50" : "hover:bg-zinc-50",
              )}
            >
              <td
                className={cn(
                  "sticky left-0 z-10 w-9 border-b border-zinc-100 p-0 align-top",
                  isOpen ? "bg-blue-50" : "bg-white",
                )}
              >
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleRow(row.response.id);
                  }}
                  aria-label={expanded ? "Collapse row" : "Expand row"}
                  title={expanded ? "Collapse row" : "Expand row"}
                  className="flex size-9 items-center justify-center text-zinc-400 hover:text-zinc-900"
                >
                  {expanded ? (
                    <ChevronDown aria-hidden="true" className="size-4" />
                  ) : (
                    <ChevronRight aria-hidden="true" className="size-4" />
                  )}
                </button>
              </td>
              {visibleColumns.map(({ column }, index) => {
                const content = row.cells[column.id];
                const expandable = isExpandable(content);
                return (
                  <td
                    key={column.id}
                    onClick={
                      expandable
                        ? (event) => {
                            event.stopPropagation();
                            onToggleRow(row.response.id);
                          }
                        : undefined
                    }
                    className={cn(
                      "max-w-[18rem] min-w-[9rem] border-b border-zinc-100 px-3 py-2 align-top text-zinc-800",
                      expandable && "cursor-zoom-in",
                      column.id === MetaColumnId.Respondent &&
                        "font-medium text-zinc-900",
                      index === 0 && "sticky left-9 z-10",
                      index === 0 && (isOpen ? "bg-blue-50" : "bg-white"),
                    )}
                  >
                    <CellView
                      content={content}
                      expanded={expanded}
                      query={query}
                    />
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
    {rows.length === 0 && (
      <p className="px-3 py-6 text-center text-sm text-zinc-500">
        No response matches this search.
      </p>
    )}
  </div>
);

export default ResponsesGrid;
