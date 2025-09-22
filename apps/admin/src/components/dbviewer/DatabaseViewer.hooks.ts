import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  adminViewerGetTableData,
  adminViewerGetTables,
} from "@alliance/shared/client";
import type {
  ColumnMetadataDto,
  TableDataDto,
  TableMetadataDto,
} from "@alliance/shared/client/types.gen";
import { useAdminWebSocket } from "../../lib/useAdminWebSocket";

type SetSearchParamsFn = (
  nextInit: URLSearchParams | ((prev: URLSearchParams) => URLSearchParams)
) => void;

export interface SelectedRowState {
  tableName: string;
  rowId: string | number;
}

export interface TableDataQueryState {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder: "ASC" | "DESC";
  search?: string;
}

export interface ColumnFilterState {
  column: string;
  value: string;
}

type TableQueryAction =
  | { type: "SET_PAGE"; page: number }
  | { type: "SET_LIMIT"; limit: number }
  | { type: "SET_SORT"; column: string }
  | { type: "SET_SORT_WITH_ORDER"; column: string; order: "ASC" | "DESC" }
  | { type: "APPLY_DEFAULT_SORT"; column: string; order: "ASC" | "DESC" }
  | { type: "SET_SEARCH"; search?: string }
  | { type: "RESET" };

const tableQueryReducer = (
  state: TableDataQueryState,
  action: TableQueryAction
): TableDataQueryState => {
  switch (action.type) {
    case "SET_PAGE":
      if (state.page === action.page) {
        return state;
      }
      return {
        ...state,
        page: action.page,
      };
    case "SET_LIMIT":
      if (state.limit === action.limit) {
        return state.page === 1
          ? state
          : {
              ...state,
              page: 1,
            };
      }
      return {
        ...state,
        limit: action.limit,
        page: 1,
      };
    case "SET_SORT": {
      const isSameColumn = state.sortBy === action.column;
      const nextOrder =
        isSameColumn && state.sortOrder === "ASC" ? "DESC" : "ASC";
      return {
        ...state,
        sortBy: action.column,
        sortOrder: isSameColumn ? nextOrder : "ASC",
        page: 1,
      };
    }
    case "SET_SORT_WITH_ORDER":
      return {
        ...state,
        sortBy: action.column,
        sortOrder: action.order,
        page: 1,
      };
    case "APPLY_DEFAULT_SORT":
      if (state.sortBy) {
        return state;
      }
      return {
        ...state,
        sortBy: action.column,
        sortOrder: action.order,
        page: 1,
      };
    case "SET_SEARCH": {
      const nextSearch = action.search || undefined;
      if (state.search === nextSearch && state.page === 1) {
        return state;
      }
      return {
        ...state,
        search: nextSearch,
        page: 1,
      };
    }
    case "RESET":
      return {
        page: 1,
        limit: 50,
        sortOrder: "ASC",
      };
    default:
      return state;
  }
};

export const useTableQuery = (initialState: TableDataQueryState) => {
  const initialRef = useRef(initialState);
  const [query, dispatch] = useReducer(tableQueryReducer, initialRef.current);

  const setPage = useCallback((page: number) => {
    dispatch({ type: "SET_PAGE", page });
  }, []);

  const setLimit = useCallback((limit: number) => {
    dispatch({ type: "SET_LIMIT", limit });
  }, []);

  const setSort = useCallback((column: string) => {
    dispatch({ type: "SET_SORT", column });
  }, []);

  const setSortWithOrder = useCallback(
    (column: string, order: "ASC" | "DESC") => {
      dispatch({ type: "SET_SORT_WITH_ORDER", column, order });
    },
    []
  );

  const applyDefaultSort = useCallback(
    (column: string, order: "ASC" | "DESC") => {
      dispatch({ type: "APPLY_DEFAULT_SORT", column, order });
    },
    []
  );

  const setSearch = useCallback((search?: string) => {
    dispatch({ type: "SET_SEARCH", search });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  return {
    query,
    setPage,
    setLimit,
    setSort,
    setSortWithOrder,
    setSearch,
    applyDefaultSort,
    reset,
  };
};

export const useDebouncedValue = <T>(value: T, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timeout);
    };
  }, [value, delay]);

  return debouncedValue;
};

export const useTimedSet = (ttlMs: number) => {
  const [values, setValues] = useState<Set<string>>(new Set());
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const removeInternal = useCallback((key: string) => {
    const timeout = timeoutsRef.current.get(key);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(key);
    }
    setValues((prev) => {
      if (!prev.has(key)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const add = useCallback(
    (value: string | number) => {
      const key = String(value);
      const existing = timeoutsRef.current.get(key);
      if (existing) {
        clearTimeout(existing);
      }

      setValues((prev) => {
        if (prev.has(key)) {
          return prev;
        }
        const next = new Set(prev);
        next.add(key);
        return next;
      });

      const timeout = setTimeout(() => {
        removeInternal(key);
      }, ttlMs);

      timeoutsRef.current.set(key, timeout);
    },
    [ttlMs, removeInternal]
  );

  const remove = useCallback(
    (value: string | number) => {
      removeInternal(String(value));
    },
    [removeInternal]
  );

  const clear = useCallback(() => {
    timeoutsRef.current.forEach((timeout) => {
      clearTimeout(timeout);
    });
    timeoutsRef.current.clear();
    setValues(new Set());
  }, []);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeout) => {
        clearTimeout(timeout);
      });
      timeoutsRef.current.clear();
    };
  }, []);

  return {
    values,
    add,
    remove,
    clear,
  };
};

interface UseTableLiveUpdatesParams {
  selectedTable: string | null;
  onRowInserted?: (event: {
    tableName: string;
    entity?: Record<string, unknown>;
  }) => void;
  onRowUpdated?: (event: { tableName: string }) => void;
  onRowDeleted?: (event: { tableName: string }) => void;
}

export const useTableLiveUpdates = ({
  selectedTable,
  onRowInserted,
  onRowUpdated,
  onRowDeleted,
}: UseTableLiveUpdatesParams) => {
  const {
    isConnected,
    subscribeToTable,
    unsubscribeFromTable,
    setEventHandlers,
  } = useAdminWebSocket();

  useEffect(() => {
    setEventHandlers({
      onRowInserted,
      onRowUpdated,
      onRowDeleted,
    });
  }, [setEventHandlers, onRowInserted, onRowUpdated, onRowDeleted]);

  useEffect(() => {
    if (!selectedTable) {
      return;
    }

    if (isConnected) {
      subscribeToTable(selectedTable);
    }

    return () => {
      if (isConnected) {
        unsubscribeFromTable(selectedTable);
      }
    };
  }, [selectedTable, isConnected, subscribeToTable, unsubscribeFromTable]);

  return { isConnected };
};

interface UseDatabaseViewerStateParams {
  initialTable?: string;
  initialRowId?: string | null;
  setSearchParams: SetSearchParamsFn;
}

interface UseDatabaseViewerStateResult {
  tables: TableMetadataDto[];
  loadingTables: boolean;
  tableData: TableDataDto | null;
  loadingTableData: boolean;
  selectedTable: string;
  selectTable: (tableName: string) => void;
  selectedRow: SelectedRowState | null;
  setSelectedRow: (row: SelectedRowState | null) => void;
  query: TableDataQueryState;
  setPage: (page: number) => void;
  setSort: (column: string) => void;
  setSortWithOrder: (column: string, order: "ASC" | "DESC") => void;
  applyImmediateSearch: (value?: string) => void;
  searchInput: string;
  setSearchInput: (value: string) => void;
  columnFilter: ColumnFilterState | null;
  applyColumnFilter: (column: string, value: string) => void;
  clearColumnFilter: () => void;
  highlightedRows: Set<string>;
  highlightRow: (value: string | number) => void;
  clearHighlights: () => void;
  selectedRows: Set<string | number>;
  toggleRowSelection: (
    primaryKeyValue: string | number,
    checked: boolean
  ) => void;
  toggleAllRowSelection: (checked: boolean) => void;
  resetRowSelection: () => void;
  refreshTableData: () => Promise<void>;
  refreshTables: () => Promise<void>;
  isConnected: boolean;
  errorMessage: string | null;
  setErrorMessage: (message: string | null) => void;
  getRowPrimaryKey: (
    row: unknown[],
    columns: ColumnMetadataDto[]
  ) => string | number | null;
}

const DEFAULT_QUERY: TableDataQueryState = {
  page: 1,
  limit: 50,
  sortOrder: "ASC",
};

export const useDatabaseViewerState = ({
  initialTable,
  initialRowId,
  setSearchParams,
}: UseDatabaseViewerStateParams): UseDatabaseViewerStateResult => {
  const [tables, setTables] = useState<TableMetadataDto[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [tableData, setTableData] = useState<TableDataDto | null>(null);
  const [loadingTableData, setLoadingTableData] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string>(
    initialTable ?? ""
  );
  const [selectedRow, setSelectedRowState] = useState<SelectedRowState | null>(
    initialTable && initialRowId
      ? { tableName: initialTable, rowId: initialRowId }
      : null
  );
  const [searchInput, setSearchInputState] = useState<string>("");
  const [columnFilter, setColumnFilterState] = useState<ColumnFilterState | null>(
    null
  );
  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(
    new Set()
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedTableRef = useRef(selectedTable);
  useEffect(() => {
    selectedTableRef.current = selectedTable;
  }, [selectedTable]);

  const selectedRowRef = useRef<SelectedRowState | null>(selectedRow);
  useEffect(() => {
    selectedRowRef.current = selectedRow;
  }, [selectedRow]);

  const tableDataRef = useRef<TableDataDto | null>(null);
  useEffect(() => {
    tableDataRef.current = tableData;
  }, [tableData]);

  const {
    query,
    setPage,
    setSort,
    setSortWithOrder,
    setSearch,
    applyDefaultSort,
    reset,
  } = useTableQuery(DEFAULT_QUERY);

  const debouncedSearch = useDebouncedValue(searchInput, 300);

  useEffect(() => {
    setSearch(debouncedSearch || undefined);
  }, [debouncedSearch, setSearch]);

  const parseColumnFilter = useCallback(
    (input: string): ColumnFilterState | null => {
      if (!input) {
        return null;
      }

      const colonIndex = input.indexOf(":");
      if (colonIndex === -1) {
        return null;
      }

      const columnPart = input.slice(0, colonIndex).trim();
      const valuePart = input.slice(colonIndex + 1).trim();

      if (!columnPart || !valuePart || !tableData?.columns?.length) {
        return null;
      }

      const matchingColumn = tableData.columns.find(
        (col) => col.name.toLowerCase() === columnPart.toLowerCase()
      );

      if (!matchingColumn) {
        return null;
      }

      return {
        column: matchingColumn.name,
        value: valuePart,
      };
    },
    [tableData]
  );

  useEffect(() => {
    const parsed = parseColumnFilter(searchInput);
    setColumnFilterState((prev) => {
      if (!parsed && !prev) {
        return prev;
      }

      if (
        parsed &&
        prev &&
        parsed.column === prev.column &&
        parsed.value === prev.value
      ) {
        return prev;
      }

      return parsed;
    });
  }, [searchInput, parseColumnFilter]);

  const updateSearchInput = useCallback((value: string) => {
    setSearchInputState(value);
  }, []);

  const updateSearchParams = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(updates).forEach(([key, value]) => {
          if (value === null || value === undefined || value === "") {
            next.delete(key);
          } else {
            next.set(key, value);
          }
        });
        return next;
      });
    },
    [setSearchParams]
  );

  const {
    values: highlightedRows,
    add: highlightRow,
    clear: clearHighlights,
  } = useTimedSet(3000);

  const applyImmediateSearch = useCallback(
    (value?: string) => {
      updateSearchInput(value ?? "");
      setSearch(value ?? undefined);
    },
    [setSearch, updateSearchInput]
  );

  const applyColumnFilter = useCallback(
    (columnName: string, rawValue: string) => {
      const trimmedValue = rawValue.trim();

      if (!trimmedValue) {
        applyImmediateSearch(undefined);
        return;
      }

      const resolvedColumn =
        tableData?.columns.find((col) => col.name === columnName)?.name ??
        tableData?.columns.find(
          (col) => col.name.toLowerCase() === columnName.toLowerCase()
        )?.name ??
        columnName;

      const filterString = `${resolvedColumn}: ${trimmedValue}`;
      applyImmediateSearch(filterString);
    },
    [tableData, applyImmediateSearch]
  );

  const clearColumnFilter = useCallback(() => {
    applyImmediateSearch(undefined);
  }, [applyImmediateSearch]);

  const selectTable = useCallback(
    (tableName: string) => {
      setSelectedTable(tableName);
      setSelectedRowState(null);
      setSelectedRows(new Set());
      clearHighlights();
      applyImmediateSearch(undefined);
      reset();
      updateSearchParams({ table: tableName || null, id: null });
    },
    [clearHighlights, reset, updateSearchParams, applyImmediateSearch]
  );

  const setSelectedRow = useCallback(
    (row: SelectedRowState | null) => {
      setSelectedRowState(row);
      updateSearchParams({
        table: row ? row.tableName : selectedTable || null,
        id: row ? String(row.rowId) : null,
      });
    },
    [selectedTable, updateSearchParams]
  );

  const loadTables = useCallback(async () => {
    setLoadingTables(true);
    try {
      const response = await adminViewerGetTables();
      if (response.data) {
        setTables(response.data.tables);
        setErrorMessage(null);
      }
    } catch (error) {
      console.error("Failed to load tables:", error);
      setErrorMessage("Failed to load tables");
    } finally {
      setLoadingTables(false);
    }
  }, []);

  const getDefaultSortColumn = useCallback((columns: ColumnMetadataDto[]) => {
    if (columns.some((col) => col.name === "updatedAt")) {
      return { column: "updatedAt", order: "DESC" as const };
    }
    if (columns.some((col) => col.name === "createdAt")) {
      return { column: "createdAt", order: "DESC" as const };
    }
    return null;
  }, []);

  const getRowPrimaryKey = useCallback(
    (row: unknown[], columns: ColumnMetadataDto[]) => {
      const primaryKeyColumn = columns.find((col) => col.isPrimary);
      if (!primaryKeyColumn) return null;
      const primaryKeyIndex = columns.findIndex((col) => col.isPrimary);
      return primaryKeyIndex >= 0
        ? (row[primaryKeyIndex] as string | number | null)
        : null;
    },
    []
  );

  const loadTableData = useCallback(async () => {
    if (!selectedTable) {
      setTableData(null);
      return;
    }

    setLoadingTableData(true);
    try {
      const response = await adminViewerGetTableData({
        path: { tableName: selectedTable },
        query: {
          page: query.page,
          limit: query.limit,
          sortBy: query.sortBy,
          sortOrder: query.sortOrder,
          search: query.search,
        },
      });

      const data = response.data;
      if (!data) {
        setTableData(null);
        return;
      }

      setErrorMessage(null);

      const defaultSort = !query.sortBy
        ? getDefaultSortColumn(data.columns)
        : null;

      if (defaultSort) {
        applyDefaultSort(defaultSort.column, defaultSort.order);
        return;
      }

      if (
        selectedRow &&
        selectedRow.tableName === selectedTable &&
        data.rows.length > 0
      ) {
        const rowExists = data.rows.some((row) => {
          const primaryKeyValue = getRowPrimaryKey(row, data.columns);
          return (
            primaryKeyValue !== null &&
            String(primaryKeyValue) === String(selectedRow.rowId)
          );
        });

        if (!rowExists && !query.search) {
          applyImmediateSearch(String(selectedRow.rowId));
          return;
        }
      }

      setTableData(data);
    } catch (error) {
      console.error("Failed to load table data:", error);
      setErrorMessage("Failed to load table data");
    } finally {
      setLoadingTableData(false);
    }
  }, [
    selectedTable,
    query.page,
    query.limit,
    query.sortBy,
    query.sortOrder,
    query.search,
    selectedRow,
    getDefaultSortColumn,
    applyDefaultSort,
    getRowPrimaryKey,
    applyImmediateSearch,
  ]);

  const loadTableDataRef = useRef(loadTableData);
  useEffect(() => {
    loadTableDataRef.current = loadTableData;
  }, [loadTableData]);

  const refreshTableData = useCallback(async () => {
    await loadTableDataRef.current();
  }, []);

  useEffect(() => {
    if (!initialTable) {
      if (selectedTableRef.current) {
        setSelectedTable("");
        setSelectedRows(new Set());
        clearHighlights();
        applyImmediateSearch(undefined);
        reset();
        setSelectedRowState(null);
      }
      return;
    }

    if (selectedTableRef.current === initialTable) {
      return;
    }

    setSelectedTable(initialTable);
    setSelectedRows(new Set());
    clearHighlights();
    applyImmediateSearch(undefined);
    reset();
    setSelectedRowState(
      initialRowId ? { tableName: initialTable, rowId: initialRowId } : null
    );
  }, [
    initialTable,
    clearHighlights,
    applyImmediateSearch,
    reset,
    initialRowId,
  ]);

  useEffect(() => {
    if (!initialTable) {
      return;
    }

    if (initialRowId) {
      setSelectedRowState({ tableName: initialTable, rowId: initialRowId });
      return;
    }

    if (
      selectedRowRef.current &&
      selectedRowRef.current.tableName === initialTable
    ) {
      setSelectedRowState(null);
    }
  }, [initialTable, initialRowId]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  useEffect(() => {
    loadTableData();
  }, [loadTableData]);

  const toggleRowSelection = useCallback(
    (primaryKeyValue: string | number, checked: boolean) => {
      setSelectedRows((prev) => {
        const next = new Set(prev);
        if (checked) {
          next.add(primaryKeyValue);
        } else {
          next.delete(primaryKeyValue);
        }
        return next;
      });
    },
    []
  );

  const toggleAllRowSelection = useCallback(
    (checked: boolean) => {
      if (!tableData) return;
      setSelectedRows((prev) => {
        const next = new Set(prev);
        tableData.rows.forEach((row) => {
          const primaryKeyValue = getRowPrimaryKey(row, tableData.columns);
          if (primaryKeyValue === null) return;
          if (checked) {
            next.add(primaryKeyValue);
          } else {
            next.delete(primaryKeyValue);
          }
        });
        return next;
      });
    },
    [tableData, getRowPrimaryKey]
  );

  const resetRowSelection = useCallback(() => {
    setSelectedRows(new Set());
  }, []);

  const handleRowInserted = useCallback(
    (event: { tableName: string; entity?: Record<string, unknown> }) => {
      if (event.tableName !== selectedTable) {
        return;
      }

      const currentTableData = tableDataRef.current;
      if (!currentTableData) {
        refreshTableData();
        return;
      }

      const primaryKeyColumn = currentTableData.columns.find(
        (col) => col.isPrimary
      );
      if (primaryKeyColumn && event.entity) {
        const value = event.entity[primaryKeyColumn.name];
        if (value !== undefined && value !== null) {
          highlightRow(value as string | number);
        }
      }

      refreshTableData();
    },
    [selectedTable, refreshTableData, highlightRow]
  );

  const handleRowUpdated = useCallback(
    (event: { tableName: string }) => {
      if (event.tableName !== selectedTable) {
        return;
      }
      refreshTableData();
    },
    [selectedTable, refreshTableData]
  );

  const handleRowDeleted = useCallback(
    (event: { tableName: string }) => {
      if (event.tableName !== selectedTable) {
        return;
      }
      refreshTableData();
    },
    [selectedTable, refreshTableData]
  );

  const { isConnected } = useTableLiveUpdates({
    selectedTable: selectedTable || null,
    onRowInserted: handleRowInserted,
    onRowUpdated: handleRowUpdated,
    onRowDeleted: handleRowDeleted,
  });

  return {
    tables,
    loadingTables,
    tableData,
    loadingTableData,
    selectedTable,
    selectTable,
    selectedRow,
    setSelectedRow,
    query,
    setPage,
    setSort,
    setSortWithOrder,
    applyImmediateSearch,
    searchInput,
    setSearchInput: updateSearchInput,
    columnFilter,
    applyColumnFilter,
    clearColumnFilter,
    highlightedRows,
    highlightRow,
    clearHighlights,
    selectedRows,
    toggleRowSelection,
    toggleAllRowSelection,
    resetRowSelection,
    refreshTableData,
    refreshTables: loadTables,
    isConnected,
    errorMessage,
    setErrorMessage,
    getRowPrimaryKey,
  };
};
