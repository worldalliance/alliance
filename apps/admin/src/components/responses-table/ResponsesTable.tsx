import type { AnyField } from "@alliance/common/forms/form-schema";
import { withCount } from "@alliance/common/plural";
import type {
  ActionWithdrawalDto,
  FormResponseDto,
  ProfileDto,
} from "@alliance/shared/client";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Layers,
  Link2,
  Pencil,
  Search,
  UnfoldVertical,
  X,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router";
import type {
  FormWithSchema,
  ResponseVariantOption,
} from "../FormResponsesView";
import { IdentityChip, IdentitySwatch } from "../IdentitySwatch";
import SideDrawer from "../SideDrawer";
import type { CellContent } from "./cells";
import {
  autoSnapshotMode,
  buildQuestionColumns,
  collectSnapshotFields,
  SnapshotMode,
  type QuestionColumn,
} from "./columns";
import ColumnVisibilityMenu from "./ColumnVisibilityMenu";
import {
  readStoredView,
  writeStoredView,
  type StoredView,
} from "./persistence";
import ResponseDrawer from "./ResponseDrawer";
import { buildRows, buildTableColumns, DEFAULT_HIDDEN_COLUMNS } from "./rows";
import { highlightSegments, matchesQuery, normalizeQuery } from "./search";
import SnapshotNavigator, { snapshotSeed } from "./SnapshotNavigator";
import { buildSnapshotEntries } from "./snapshots";
import { compareRows } from "./sorting";
import { ColumnKind, MetaColumnId, type ResponseRow } from "./types";

const SEARCH_DEBOUNCE_MS = 200;

/** Long enough that the cell is certainly clipped, so clicking it should open the row. */
const CLIPPED_TEXT_LENGTH = 48;

const DEFAULT_VIEW: StoredView = {
  hiddenColumns: DEFAULT_HIDDEN_COLUMNS,
  expandRows: false,
  snapshotMode: null,
};

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

export type ResponsesTableProps = {
  form: FormWithSchema | null;
  responses: FormResponseDto[];
  variantOptions?: ResponseVariantOption[];
  withdrawnUserMap: Map<number, ActionWithdrawalDto>;
  sidsToUserMap: Record<string, ProfileDto>;
  loading: boolean;
  error: string | null;
  /** The host view's search-param namespacing, so embedding pages cannot collide. */
  paramKey: (name: string) => string;
};

const ResponsesTable: React.FC<ResponsesTableProps> = ({
  form,
  responses,
  variantOptions,
  withdrawnUserMap,
  sidsToUserMap,
  loading,
  error,
  paramKey,
}) => {
  const [params, setParams] = useSearchParams();
  const formId = form?.id ?? null;

  // `setParams` hands its updater the params of the render that created it and
  // takes a new identity on every URL change, so a debounced write would apply
  // to a stale URL and undo whatever landed in between. Writes read the live
  // params and setter instead.
  const live = useRef({ params, setParams });
  live.current = { params, setParams };

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(live.current.params);
      for (const [name, value] of Object.entries(updates)) {
        if (value === null) next.delete(paramKey(name));
        else next.set(paramKey(name), value);
      }
      live.current.setParams(next, { replace: true });
    },
    [paramKey],
  );

  const [view, setView] = useState<StoredView>(DEFAULT_VIEW);
  const hiddenParam = params.get(paramKey("hidden"));

  useEffect(() => {
    if (formId === null) return;
    const stored = readStoredView(formId) ?? DEFAULT_VIEW;
    if (hiddenParam === null) {
      setView(stored);
      return;
    }
    const fromUrl = {
      ...stored,
      hiddenColumns: hiddenParam.split(",").filter(Boolean),
    };
    setView(fromUrl);
    writeStoredView({ formId, view: fromUrl });
  }, [formId, hiddenParam]);

  const updateView = useCallback(
    (patch: Partial<StoredView>) => {
      setView((current) => {
        const next = { ...current, ...patch };
        if (formId !== null) writeStoredView({ formId, view: next });
        return next;
      });
    },
    [formId],
  );

  const queryParam = params.get(paramKey("q")) ?? "";
  const [searchInput, setSearchInput] = useState(queryParam);
  useEffect(() => {
    const timer = setTimeout(
      () => updateParams({ q: searchInput || null }),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [searchInput, updateParams]);

  const fieldSet = useMemo(
    () =>
      collectSnapshotFields({
        currentSchema: form?.schema ?? null,
        currentSnapshotId: form?.formSnapshotId ?? null,
        responses,
      }),
    [form, responses],
  );

  const detectedMode = useMemo(
    () => autoSnapshotMode({ responses, fields: fieldSet }),
    [responses, fieldSet],
  );
  const mode = view.snapshotMode ?? detectedMode;

  const questions = useMemo(
    () => buildQuestionColumns({ fields: fieldSet, mode }),
    [fieldSet, mode],
  );

  const variantByFormId = useMemo(() => {
    const map = new Map<number, ResponseVariantOption>();
    variantOptions?.forEach((option) => map.set(option.formId, option));
    return map;
  }, [variantOptions]);

  const columns = useMemo(
    () =>
      buildTableColumns({
        questions,
        hasVariants: (variantOptions?.length ?? 0) > 0,
      }),
    [questions, variantOptions],
  );

  const columnsById = useMemo(
    () => new Map(columns.map((column) => [column.id, column])),
    [columns],
  );

  const fieldsBySnapshot = useMemo(() => {
    const map = new Map<number, Map<string, AnyField>>();
    for (const [snapshotId, fields] of fieldSet.bySnapshotId) {
      map.set(snapshotId, new Map(fields.map((field) => [field.id, field])));
    }
    return map;
  }, [fieldSet]);

  const rows = useMemo(
    () =>
      buildRows({
        responses,
        columns,
        fieldsBySnapshot,
        sidsToUserMap,
        withdrawnUserMap,
        variantByFormId,
      }),
    [
      responses,
      columns,
      fieldsBySnapshot,
      sidsToUserMap,
      withdrawnUserMap,
      variantByFormId,
    ],
  );

  const versionParam = params.get(paramKey("version"));
  const selectedSnapshotId =
    versionParam && /^\d+$/.test(versionParam) ? Number(versionParam) : null;

  const hiddenColumns = useMemo(
    () => new Set(view.hiddenColumns),
    [view.hiddenColumns],
  );

  const visibleColumnIds = useMemo(
    () =>
      columns
        .filter((column) => !hiddenColumns.has(column.id))
        .map((column) => column.id),
    [columns, hiddenColumns],
  );

  const filteredRows = useMemo(() => {
    const scoped =
      selectedSnapshotId === null
        ? rows
        : rows.filter(
            (row) => row.response.formSnapshotId === selectedSnapshotId,
          );
    const query = normalizeQuery(queryParam);
    if (!query) return scoped;
    return scoped.filter((row) =>
      matchesQuery({
        texts: visibleColumnIds.map((id) => row.cells[id]?.text ?? ""),
        query,
      }),
    );
  }, [rows, selectedSnapshotId, queryParam, visibleColumnIds]);

  const sortParam = params.get(paramKey("sort")) ?? "";
  const sorting = useMemo<SortingState>(() => {
    const [id, direction] = sortParam.split(":");
    return id && (direction === "asc" || direction === "desc")
      ? [{ id, desc: direction === "desc" }]
      : [];
  }, [sortParam]);

  const onSortingChange = useCallback<OnChangeFn<SortingState>>(
    (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      const [first] = next;
      updateParams({
        sort: first ? `${first.id}:${first.desc ? "desc" : "asc"}` : null,
      });
    },
    [sorting, updateParams],
  );

  const columnVisibility = useMemo<VisibilityState>(
    () =>
      Object.fromEntries(
        columns.map((column) => [column.id, !hiddenColumns.has(column.id)]),
      ),
    [columns, hiddenColumns],
  );

  const onColumnVisibilityChange = useCallback<OnChangeFn<VisibilityState>>(
    (updater) => {
      const next =
        typeof updater === "function" ? updater(columnVisibility) : updater;
      updateView({
        hiddenColumns: Object.entries(next)
          .filter(([, visible]) => !visible)
          .map(([id]) => id),
      });
    },
    [columnVisibility, updateView],
  );

  const columnDefs = useMemo<ColumnDef<ResponseRow>[]>(
    () =>
      columns.map((column) => ({
        id: column.id,
        accessorFn: (row: ResponseRow) => row.cells[column.id]?.text ?? "",
        sortingFn: (a, b) =>
          compareRows({ column, a: a.original, b: b.original }),
      })),
    [columns],
  );

  const table = useReactTable({
    data: filteredRows,
    columns: columnDefs,
    state: { sorting, columnVisibility },
    onSortingChange,
    onColumnVisibilityChange,
    enableMultiSort: false,
    getRowId: (row) => String(row.response.id),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const sortedRows = table.getRowModel().rows;

  const [expandedRowIds, setExpandedRowIds] = useState<ReadonlySet<number>>(
    new Set(),
  );
  const toggleRow = useCallback((responseId: number) => {
    setExpandedRowIds((current) => {
      const next = new Set(current);
      if (next.has(responseId)) next.delete(responseId);
      else next.add(responseId);
      return next;
    });
  }, []);

  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const snapshotEntries = useMemo(
    () => buildSnapshotEntries({ fields: fieldSet, responses }),
    [fieldSet, responses],
  );

  const responseFormIds = useMemo(() => {
    const ids = new Set(responses.map((response) => response.formId));
    if (formId !== null) ids.add(formId);
    return [...ids];
  }, [responses, formId]);

  const openResponseId = Number(params.get(paramKey("response")) ?? "");
  const openIndex = sortedRows.findIndex(
    (row) => row.original.response.id === openResponseId,
  );
  const openResponse =
    openIndex >= 0 ? sortedRows[openIndex].original.response : null;

  const copyViewLink = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set(paramKey("hidden"), view.hiddenColumns.join(","));
    void navigator.clipboard.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [paramKey, view.hiddenColumns]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Loading responses...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  const visibleColumns = table.getVisibleLeafColumns().flatMap((leaf) => {
    const column = columnsById.get(leaf.id);
    return column ? [{ leaf, column }] : [];
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-zinc-400"
          />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search responses…"
            aria-label="Search responses"
            className="w-64 rounded-md border border-gray-300 bg-white py-1.5 pr-3 pl-8 text-sm text-gray-900 focus:border-black focus:outline-none"
          />
        </div>

        <Button
          color={view.expandRows ? ButtonColor.Black : ButtonColor.White}
          size="small"
          onClick={() => updateView({ expandRows: !view.expandRows })}
          aria-pressed={view.expandRows}
        >
          <UnfoldVertical aria-hidden="true" className="mr-1.5 size-4" />
          Expand rows
        </Button>

        <ColumnVisibilityMenu
          columns={columns}
          hiddenColumns={hiddenColumns}
          onChange={(hidden) => updateView({ hiddenColumns: hidden })}
        />

        <Button
          color={ButtonColor.White}
          size="small"
          onClick={() => setNavigatorOpen(true)}
        >
          <Layers aria-hidden="true" className="mr-1.5 size-4" />
          Versions
          <span className="ml-1.5 text-zinc-500">{snapshotEntries.length}</span>
        </Button>

        <Button
          color={
            mode === SnapshotMode.Expanded
              ? ButtonColor.Black
              : ButtonColor.White
          }
          size="small"
          onClick={() =>
            updateView({
              snapshotMode:
                mode === SnapshotMode.Expanded
                  ? SnapshotMode.Focused
                  : SnapshotMode.Expanded,
            })
          }
          title={
            mode === SnapshotMode.Expanded
              ? "Showing questions from every version in these responses"
              : "Showing the current version's questions only"
          }
        >
          {mode === SnapshotMode.Expanded ? "All versions" : "Current version"}
        </Button>

        <Button color={ButtonColor.White} size="small" onClick={copyViewLink}>
          <Link2 aria-hidden="true" className="mr-1.5 size-4" />
          {copied ? "Copied" : "Copy view link"}
        </Button>

        <span className="ml-auto text-sm text-zinc-500">
          {withCount(sortedRows.length, "response")}
          {sortedRows.length !== rows.length && ` of ${rows.length}`}
        </span>
      </div>

      {selectedSnapshotId !== null && (
        <div className="flex flex-wrap items-center gap-2">
          <IdentityChip
            seed={snapshotSeed(selectedSnapshotId)}
            label={`Version v${selectedSnapshotId}`}
          />
          <button
            type="button"
            onClick={() => updateParams({ version: null })}
            aria-label="Clear version filter"
            title="Clear version filter"
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      )}

      {fieldSet.failures.length > 0 && (
        <Card style={CardStyle.White}>
          <p className="text-sm font-semibold text-red-700">
            {withCount(fieldSet.failures.length, "schema version")} could not be
            read, so their questions have no columns.
          </p>
          <ul className="mt-1 space-y-0.5 text-sm text-red-700">
            {fieldSet.failures.map((failure) => (
              <li key={failure.snapshotId ?? "current"}>
                v{failure.snapshotId ?? "?"}: {failure.message}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card style={CardStyle.White}>
          <p className="text-gray-600">No responses yet for this form.</p>
        </Card>
      ) : (
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
                          <ArrowUp
                            aria-hidden="true"
                            className="size-3.5 shrink-0"
                          />
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
              {sortedRows.map(({ original: row }) => {
                const expanded =
                  view.expandRows || expandedRowIds.has(row.response.id);
                const isOpen = row.response.id === openResponseId;
                return (
                  <tr
                    key={row.response.id}
                    onClick={() =>
                      updateParams({ response: String(row.response.id) })
                    }
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
                          toggleRow(row.response.id);
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
                                  toggleRow(row.response.id);
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
                            query={queryParam}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sortedRows.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-zinc-500">
              No response matches this search.
            </p>
          )}
        </div>
      )}

      <SideDrawer
        open={navigatorOpen}
        onClose={() => setNavigatorOpen(false)}
        title="Versions"
        panelClassName="max-w-[42rem]"
      >
        <SnapshotNavigator
          open={navigatorOpen}
          entries={snapshotEntries}
          fields={fieldSet}
          formIds={responseFormIds}
          selectedSnapshotId={selectedSnapshotId}
          onSelectVersion={(snapshotId) =>
            updateParams({
              version: snapshotId === null ? null : String(snapshotId),
            })
          }
          snapshotsHref={formId === null ? null : `/forms/${formId}/snapshots`}
        />
      </SideDrawer>

      <ResponseDrawer
        response={openResponse}
        form={form}
        sidsToUserMap={sidsToUserMap}
        withdrawnUserMap={withdrawnUserMap}
        position={{ index: openIndex, total: sortedRows.length }}
        onClose={() => updateParams({ response: null })}
        onStep={(offset) => {
          const target = sortedRows[openIndex + offset];
          if (target) {
            updateParams({ response: String(target.original.response.id) });
          }
        }}
      />
    </div>
  );
};

export default ResponsesTable;
