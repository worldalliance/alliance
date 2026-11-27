import type { Column, Row } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronRight, Pencil } from "lucide-react";
import React from "react";
import { Link } from "react-router";
import Badge from "../../ui/Badge";
import { cn } from "../../ui/cn";
import { nameLinkClass } from "../../ui/styles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { zIndex } from "../../ui/zIndex";
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
        <mark
          key={index}
          className="rounded-sm bg-accent-soft font-semibold text-inherit"
        >
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
  if (!content?.text) return <span className="text-fg-muted">—</span>;
  const text = expanded ? content.text : (content.summary ?? content.text);
  return (
    <span
      className={cn(
        expanded ? "wrap-break-word whitespace-pre-line" : "block truncate",
      )}
    >
      <Highlighted text={text} query={query} />
    </span>
  );
};

// One width band for every column, so a column per question stays readable
// and the table scrolls sideways instead of squeezing.
const COLUMN_WIDTH = "max-w-72 min-w-36";

// The first column stays in view while the rest scroll under it, so it needs
// its own opaque background in each of the row's states.
const STICKY_CELL =
  "sticky left-0 bg-surface group-hover/row:bg-surface-2 group-aria-selected/row:bg-accent-soft";

export type GridColumn = { leaf: Column<ResponseRow>; column: TableColumn };

const SORT_LABEL = { asc: "ascending", desc: "descending" } as const;

const HeaderCell: React.FC<GridColumn & { first: boolean }> = ({
  leaf,
  column,
  first,
}) => {
  const sorted = leaf.getIsSorted();
  const question = column.kind === ColumnKind.Question ? column.question : null;
  return (
    <TableHead
      scope="col"
      aria-sort={sorted ? SORT_LABEL[sorted] : undefined}
      className={cn(COLUMN_WIDTH, first && cn(zIndex.nav, "left-0"))}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <button
          type="button"
          onClick={leaf.getToggleSortingHandler()}
          className="flex min-w-0 items-center gap-1.5 rounded-sm focus-ring hover:text-fg"
          title={question ? headerTitle(question) : undefined}
        >
          {question && <IdentitySwatch seed={question.fieldId} />}
          <span
            className={cn("min-w-0 truncate", question?.retired && "italic")}
          >
            {column.label}
          </span>
          {question && question.wordings.length > 1 && (
            <Pencil
              aria-label="Wording changed between versions"
              className="size-3 shrink-0"
            />
          )}
          {sorted === "asc" && (
            <ArrowUp aria-hidden="true" className="size-3.5 shrink-0" />
          )}
          {sorted === "desc" && (
            <ArrowDown aria-hidden="true" className="size-3.5 shrink-0" />
          )}
        </button>
        {question?.retired && <Badge>Retired</Badge>}
      </span>
    </TableHead>
  );
};

type ResponsesGridProps = {
  visibleColumns: GridColumn[];
  rows: Row<ResponseRow>[];
  expandAll: boolean;
  expandedRowIds: ReadonlySet<number>;
  onToggleRow: (responseId: number) => void;
  openResponseId: number;
  /** The URL search that opens a response's sheet. */
  responseSearch: (responseId: number) => string;
  query: string;
};

const ResponsesGrid: React.FC<ResponsesGridProps> = ({
  visibleColumns,
  rows,
  expandAll,
  expandedRowIds,
  onToggleRow,
  openResponseId,
  responseSearch,
  query,
}) => {
  // Without the Respondent column, the first column's text opens the row.
  const opener = visibleColumns.some(
    ({ column }) => column.id === MetaColumnId.Respondent,
  )
    ? MetaColumnId.Respondent
    : visibleColumns[0]?.column.id;
  return (
    <Table bleed>
      <TableHeader>
        <TableRow>
          {visibleColumns.map((gridColumn, index) => (
            <HeaderCell
              key={gridColumn.column.id}
              {...gridColumn}
              first={index === 0}
            />
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ original: row }) => {
          const expanded = expandAll || expandedRowIds.has(row.response.id);
          const respondent = row.cells[MetaColumnId.Respondent]?.text ?? "";
          const openerText = (opener && row.cells[opener]?.text) || "Open";
          return (
            <TableRow
              key={row.response.id}
              aria-selected={row.response.id === openResponseId}
            >
              {visibleColumns.map(({ column }, index) => {
                const content = row.cells[column.id];
                const expandable = isExpandable(content);
                const first = index === 0;
                const opensRow = column.id === opener;
                const body = opensRow ? (
                  <Link
                    to={{ search: responseSearch(row.response.id) }}
                    className={cn(
                      nameLinkClass,
                      "block min-w-0",
                      expanded ? "wrap-break-word" : "truncate",
                    )}
                  >
                    <Highlighted text={openerText} query={query} />
                  </Link>
                ) : (
                  <CellView
                    content={content}
                    expanded={expanded}
                    query={query}
                  />
                );
                return (
                  <TableCell
                    key={column.id}
                    onClick={
                      expandable && !opensRow
                        ? () => onToggleRow(row.response.id)
                        : undefined
                    }
                    className={cn(
                      COLUMN_WIDTH,
                      expanded && "py-3 align-top",
                      expandable && !opensRow && "cursor-zoom-in",
                      first && cn(zIndex.raised, STICKY_CELL),
                    )}
                  >
                    {first ? (
                      <span className="flex min-w-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onToggleRow(row.response.id)}
                          aria-expanded={expanded}
                          aria-label={
                            expanded
                              ? `Collapse row: ${respondent}`
                              : `Expand row: ${respondent}`
                          }
                          title={expanded ? "Collapse row" : "Expand row"}
                          className="-ml-1.5 grid size-6 shrink-0 place-items-center rounded-sm text-fg-muted focus-ring hover:bg-line hover:text-fg"
                        >
                          <ChevronRight
                            aria-hidden="true"
                            className={cn(
                              "size-4 transition-transform duration-fast",
                              expanded && "rotate-90",
                            )}
                          />
                        </button>
                        <span className="min-w-0 flex-1">{body}</span>
                      </span>
                    ) : (
                      body
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default ResponsesGrid;
