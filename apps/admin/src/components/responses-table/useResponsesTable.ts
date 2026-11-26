import type { AnyField } from "@alliance/common/forms/form-schema";
import type {
  ActionWithdrawalDto,
  FormResponseDto,
  ProfileDto,
} from "@alliance/shared/client";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { assignedRowFields } from "../../lib/assignedRowFields";
import { useToast } from "../../ui/ToastProvider";
import type {
  FormWithSchema,
  ResponseVariantOption,
} from "../FormResponsesView";
import {
  autoSnapshotMode,
  buildQuestionColumns,
  collectSnapshotFields,
} from "./columns";
import {
  readStoredView,
  writeStoredView,
  type StoredView,
} from "./persistence";
import { buildRows, buildTableColumns, DEFAULT_HIDDEN_COLUMNS } from "./rows";
import { matchesQuery, normalizeQuery, searchedColumnIds } from "./search";
import { buildSnapshotEntries } from "./snapshots";
import { compareRows } from "./sorting";
import type { ResponseRow } from "./types";

const SEARCH_DEBOUNCE_MS = 200;

const DEFAULT_VIEW: StoredView = {
  hiddenColumns: DEFAULT_HIDDEN_COLUMNS,
  expandRows: false,
  snapshotMode: null,
};

export type ResponsesTableParams = {
  form: FormWithSchema | null;
  /** Already narrowed to the variant picked, when there is one. */
  responses: FormResponseDto[];
  variantOptions?: ResponseVariantOption[];
  withdrawnUserMap: Map<number, ActionWithdrawalDto>;
  sidsToUserMap: Record<string, ProfileDto>;
  /** The host view's search-param namespacing, so embedding pages cannot collide. */
  paramKey: (name: string) => string;
};

/**
 * The table's state: its columns, its rows as searched, filtered and sorted,
 * and what the URL and local storage keep of the view. The frame calls it, so
 * what is on screen (`sortedRows`) is known where the exports are built.
 */
export function useResponsesTable({
  form,
  responses,
  variantOptions,
  withdrawnUserMap,
  sidsToUserMap,
  paramKey,
}: ResponsesTableParams) {
  const [params, setParams] = useSearchParams();
  const { error: pushError } = useToast();
  const formId = form?.id ?? null;

  // `setParams` hands its updater the params of the render that created it and
  // takes a new identity on every URL change, so a debounced write would apply
  // to a stale URL and undo whatever landed in between. Writes read the live
  // params and setter instead.
  const live = useRef({ params, setParams });
  live.current = { params, setParams };

  const searchWith = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(live.current.params);
      for (const [name, value] of Object.entries(updates)) {
        if (value === null) next.delete(paramKey(name));
        else next.set(paramKey(name), value);
      }
      return next;
    },
    [paramKey],
  );

  const updateParams = useCallback(
    (updates: Record<string, string | null>) =>
      live.current.setParams(searchWith(updates), { replace: true }),
    [searchWith],
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
        rowFields: assignedRowFields(responses),
        hasVariants: (variantOptions?.length ?? 0) > 0,
      }),
    [questions, responses, variantOptions],
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
        texts: searchedColumnIds(visibleColumnIds).map(
          (id) => row.cells[id]?.text ?? "",
        ),
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

  const [versionsOpen, setVersionsOpen] = useState(false);

  const [copied, setCopied] = useState(false);
  const copyViewLink = useCallback(async () => {
    const url = new URL(window.location.href);
    url.searchParams.set(paramKey("hidden"), view.hiddenColumns.join(","));
    if (!(await copyToClipboard(url.toString()))) {
      pushError("Could not copy the view link to the clipboard");
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [paramKey, pushError, view.hiddenColumns]);

  const visibleColumns = table.getVisibleLeafColumns().flatMap((leaf) => {
    const column = columnsById.get(leaf.id);
    return column ? [{ leaf, column }] : [];
  });

  return {
    formId,
    view,
    updateView,
    mode,
    columns,
    hiddenColumns,
    visibleColumns,
    /** Every response in scope, before the search and the version filter. */
    rows,
    /** What the table shows, in its order: searched, filtered and sorted. */
    sortedRows,
    query: queryParam,
    searchInput,
    setSearch: setSearchInput,
    filtered: queryParam !== "" || selectedSnapshotId !== null,
    clearFilters: () => {
      setSearchInput("");
      updateParams({ q: null, version: null });
    },
    selectedSnapshotId,
    selectVersion: (snapshotId: number | null) =>
      updateParams({
        version: snapshotId === null ? null : String(snapshotId),
      }),
    fieldSet,
    snapshotEntries,
    responseFormIds,
    openResponseId,
    openIndex,
    openResponse,
    /** The URL that opens a response's sheet, for the link in its row. */
    responseSearch: (responseId: number) =>
      `?${searchWith({ response: String(responseId) })}`,
    closeResponse: () => updateParams({ response: null }),
    stepResponse: (offset: number) => {
      const target = sortedRows[openIndex + offset];
      if (target) {
        updateParams({ response: String(target.original.response.id) });
      }
    },
    expandedRowIds,
    toggleRow,
    versionsOpen,
    openVersions: () => setVersionsOpen(true),
    closeVersions: () => setVersionsOpen(false),
    copied,
    copyViewLink,
  };
}

export type ResponsesTableState = ReturnType<typeof useResponsesTable>;
