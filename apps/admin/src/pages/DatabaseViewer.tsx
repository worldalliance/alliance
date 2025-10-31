/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  adminViewerCreateRecord,
  adminViewerDeleteRecords,
  adminViewerUpdateRecord,
} from "@alliance/shared/client";
import type { ColumnMetadataDto } from "@alliance/shared/client/types.gen";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import CellEditor from "../components/CellEditor";
import ConfirmDialog from "../components/ConfirmDialog";
import AddRowModal from "../components/AddRowModal";
import { useDatabaseViewerState } from "../components/dbviewer/DatabaseViewer.hooks";
import DatabaseSidebar from "../components/dbviewer/DatabaseSidebar";
import DatabaseToolbar from "../components/dbviewer/DatabaseToolbar";
import DatabaseTable from "../components/dbviewer/DatabaseTable";
import {
  formatTimeForDisplayValue,
  isTimeOnlyColumn,
  parseTimeInputValue,
  toDatabaseTimeString,
} from "../components/dbviewer/timeFieldUtils";

const describeConfirmValue = (
  raw: unknown,
  display?: string | null
): string => {
  if (display !== undefined) {
    if (!display) {
      return "null";
    }
    return display;
  }

  if (raw === null || raw === undefined) {
    return "null";
  }

  if (typeof raw === "string") {
    return raw;
  }

  if (typeof raw === "number" || typeof raw === "boolean") {
    return String(raw);
  }

  try {
    return JSON.stringify(raw);
  } catch {
    return String(raw);
  }
};

const DatabaseViewer: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const tableParam = searchParams.get("table") ?? undefined;
  const rowParam = searchParams.get("id");
  const {
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
    setSortWithOrder,
    applyImmediateSearch,
    searchInput,
    setSearchInput,
    columnFilter,
    applyColumnFilter,
    clearColumnFilter,
    highlightedRows,
    highlightRow,
    selectedRows,
    toggleRowSelection,
    toggleAllRowSelection,
    resetRowSelection,
    refreshTableData,
    isConnected,
    errorMessage,
    setErrorMessage,
    getRowPrimaryKey,
  } = useDatabaseViewerState({
    initialTable: tableParam,
    initialRowId: rowParam,
    setSearchParams,
  });
  const [banner, setBanner] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    columnIndex: number;
    originalValue: any;
  } | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<{
    tableName: string;
    primaryKeyValue: any;
    columnName: string;
    newValue: any;
    originalValue: any;
    originalDisplayValue?: string | null;
    newDisplayValue?: string | null;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    tableName: string;
    primaryKeyValues: (string | number)[];
  } | null>(null);
  const [isAddRowOpen, setIsAddRowOpen] = useState(false);
  const [newRecordInputs, setNewRecordInputs] = useState<
    Record<string, string>
  >({});
  const [isCreatingRecord, setIsCreatingRecord] = useState(false);
  const [newRecordError, setNewRecordError] = useState<string | null>(null);
  const [newRecordSuccess, setNewRecordSuccess] = useState<string | null>(null);
  const [newRecordFieldErrors, setNewRecordFieldErrors] = useState<
    Record<string, string>
  >({});
  const editableColumns = useMemo(() => {
    if (!tableData) return [] as ColumnMetadataDto[];

    const seen = new Set<string>();

    return tableData.columns.filter((column) => {
      const normalized = column.name.toLowerCase();

      if (
        normalized === "createdat" ||
        normalized === "updatedat" ||
        normalized === "datecreated" ||
        normalized === "dateupdated"
      ) {
        return false;
      }

      if (column.dataType === "relation") {
        return false;
      }

      if (seen.has(column.name)) {
        return false;
      }

      seen.add(column.name);
      return true;
    });
  }, [tableData]);

  const showSuccess = useCallback((message: string) => {
    setBanner({ type: "success", message });
  }, []);

  const showError = useCallback((message: string) => {
    setBanner({ type: "error", message });
  }, []);

  const dismissBanner = useCallback(() => setBanner(null), []);

  useEffect(() => {
    if (!errorMessage) return;
    showError(errorMessage);
    setErrorMessage(null);
  }, [errorMessage, showError, setErrorMessage]);

  const handleSortAscending = useCallback(
    (columnName: string) => {
      setSortWithOrder(columnName, "ASC");
    },
    [setSortWithOrder]
  );

  const handleSortDescending = useCallback(
    (columnName: string) => {
      setSortWithOrder(columnName, "DESC");
    },
    [setSortWithOrder]
  );

  const handleFilterColumn = useCallback(
    (columnName: string, value: string) => {
      applyColumnFilter(columnName, value);
    },
    [applyColumnFilter]
  );

  const handleClearColumnFilter = useCallback(() => {
    clearColumnFilter();
  }, [clearColumnFilter]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
    },
    [setPage]
  );

  const handleSearch = useCallback(
    (search: string) => {
      setSearchInput(search);
    },
    [setSearchInput]
  );

  const handleSelectRow = useCallback(
    (primaryKeyValue: string | number, checked: boolean) => {
      toggleRowSelection(primaryKeyValue, checked);
    },
    [toggleRowSelection]
  );

  const handleSelectAllRows = useCallback(
    (checked: boolean) => {
      toggleAllRowSelection(checked);
    },
    [toggleAllRowSelection]
  );

  const clearSelectedRow = useCallback(() => {
    setSelectedRow(null);
    applyImmediateSearch(undefined);
  }, [setSelectedRow, applyImmediateSearch]);
  const navigateToRelatedRow = useCallback(
    (tableName: string, rowId: string | number) => {
      selectTable(tableName);
      setSelectedRow({ tableName, rowId });
      applyImmediateSearch(String(rowId));
    },
    [selectTable, setSelectedRow, applyImmediateSearch]
  );

  const handleCellClick = useCallback(
    (
      rowIndex: number,
      columnIndex: number,
      cellValue: any,
      column: ColumnMetadataDto
    ) => {
      if (column.isPrimary || column.dataType === "relation") {
        return;
      }

      setEditingCell({
        rowIndex,
        columnIndex,
        originalValue: cellValue,
      });
    },
    []
  );

  const handleCellSave = useCallback(
    async (newValue: any) => {
      if (!editingCell || !tableData) return;

      const { rowIndex, columnIndex } = editingCell;
      const column = tableData.columns[columnIndex];
      const isTimeColumn =
        column.dataType === "datetime" && isTimeOnlyColumn(column);
      const row = tableData.rows[rowIndex];
      const primaryKeyColumn = tableData.columns.find((col) => col.isPrimary);

      if (!primaryKeyColumn) {
        showError("Cannot update: No primary key found");
        setEditingCell(null);
        return;
      }

      const primaryKeyIndex = tableData.columns.findIndex(
        (col) => col.isPrimary
      );
      const primaryKeyValue = row[primaryKeyIndex];

      // Check if value actually changed
      const comparableNewValue = isTimeColumn
        ? toDatabaseTimeString(newValue)
        : newValue;
      const comparableOriginalValue = isTimeColumn
        ? toDatabaseTimeString(editingCell.originalValue)
        : editingCell.originalValue;

      if (comparableNewValue === comparableOriginalValue) {
        setEditingCell(null);
        return;
      }

      const displayOriginal = isTimeColumn
        ? formatTimeForDisplayValue(editingCell.originalValue)
        : undefined;
      const displayNew = isTimeColumn
        ? formatTimeForDisplayValue(newValue)
        : undefined;

      // Set up pending update for confirmation
      setPendingUpdate({
        tableName: selectedTable,
        primaryKeyValue,
        columnName: column.name,
        newValue: comparableNewValue,
        originalValue: editingCell.originalValue,
        originalDisplayValue: displayOriginal,
        newDisplayValue: displayNew,
      });

      setEditingCell(null);
    },
    [editingCell, tableData, selectedTable, showError]
  );

  const handleCellCancel = useCallback(() => {
    setEditingCell(null);
  }, []);

  const confirmUpdate = useCallback(async () => {
    if (!pendingUpdate) return;

    try {
      const response = await adminViewerUpdateRecord({
        path: { tableName: pendingUpdate.tableName },
        body: {
          primaryKeyValue: pendingUpdate.primaryKeyValue,
          updates: {
            [pendingUpdate.columnName]: pendingUpdate.newValue,
          },
        },
      });

      if (response.data?.success) {
        await refreshTableData();
        showSuccess("Record updated successfully");
      } else {
        showError(response.data?.message || "Update failed");
      }
    } catch (error) {
      console.error("Update failed:", error);
      showError(
        error instanceof Error ? error.message : "Unknown error updating record"
      );
    } finally {
      setPendingUpdate(null);
    }
  }, [pendingUpdate, refreshTableData, showSuccess, showError]);

  const cancelUpdate = useCallback(() => {
    setPendingUpdate(null);
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedRows.size === 0 || !selectedTable) return;

    setPendingDelete({
      tableName: selectedTable,
      primaryKeyValues: Array.from(selectedRows),
    });
  }, [selectedRows, selectedTable]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;

    try {
      const response = await adminViewerDeleteRecords({
        path: { tableName: pendingDelete.tableName },
        body: {
          primaryKeyValues: pendingDelete.primaryKeyValues.map((value) =>
            String(value)
          ),
        },
      });

      if (response.data?.success) {
        if (
          selectedRow &&
          selectedRow.tableName === pendingDelete.tableName &&
          pendingDelete.primaryKeyValues.some(
            (deletedId) => String(deletedId) === String(selectedRow.rowId)
          )
        ) {
          setSelectedRow(null);
          applyImmediateSearch(undefined);
        }

        resetRowSelection();
        await refreshTableData();
        showSuccess(
          `Deleted ${response.data.deletedCount} record${
            response.data.deletedCount === 1 ? "" : "s"
          }`
        );
      } else {
        showError(response.data?.message || "Delete failed");
      }
    } catch (error) {
      console.error("Delete failed:", error);
      showError(
        error instanceof Error
          ? error.message
          : "Unknown error deleting records"
      );
    } finally {
      setPendingDelete(null);
    }
  }, [
    pendingDelete,
    selectedRow,
    setSelectedRow,
    applyImmediateSearch,
    resetRowSelection,
    refreshTableData,
    showSuccess,
    showError,
  ]);

  const cancelDelete = useCallback(() => {
    setPendingDelete(null);
  }, []);

  const openAddRowModal = useCallback(() => {
    if (!tableData) return;

    const initialInputs: Record<string, string> = {};
    editableColumns.forEach((column) => {
      initialInputs[column.name] = "";
    });

    setNewRecordInputs(initialInputs);
    setNewRecordError(null);
    setNewRecordSuccess(null);
    setNewRecordFieldErrors({});
    setIsAddRowOpen(true);
  }, [tableData, editableColumns]);

  const closeAddRowModal = useCallback(() => {
    setIsAddRowOpen(false);
    setNewRecordInputs({});
    setNewRecordError(null);
    setNewRecordSuccess(null);
    setNewRecordFieldErrors({});
  }, []);

  const parseNewRecordValue = useCallback(
    (
      column: ColumnMetadataDto,
      rawValue: string
    ): { value: unknown; error?: string } => {
      const trimmed = rawValue.trim();

      if (trimmed === "") {
        if (column.isNullable) {
          return { value: null };
        }
        return { value: undefined };
      }

      const columnLabel = `Value for "${column.name}"`;

      switch (column.dataType) {
        case "number": {
          const parsed = Number(trimmed);
          if (Number.isNaN(parsed)) {
            return {
              value: undefined,
              error: `${columnLabel} must be a valid number.`,
            };
          }
          return { value: parsed };
        }

        case "boolean": {
          const lower = trimmed.toLowerCase();
          if (["true", "1"].includes(lower)) {
            return { value: true };
          }
          if (["false", "0"].includes(lower)) {
            return { value: false };
          }
          return {
            value: undefined,
            error: `${columnLabel} must be true/false or 1/0.`,
          };
        }

        case "json": {
          try {
            return { value: JSON.parse(trimmed) };
          } catch {
            return {
              value: undefined,
              error: `${columnLabel} must be valid JSON.`,
            };
          }
        }

        case "date":
          if (Number.isNaN(Date.parse(trimmed))) {
            return {
              value: undefined,
              error: `${columnLabel} must be a valid date/time.`,
            };
          }
          return { value: trimmed };

        case "datetime":
          if (isTimeOnlyColumn(column)) {
            const normalizedTime = parseTimeInputValue(trimmed);
            if (!normalizedTime) {
              return {
                value: undefined,
                error: `${columnLabel} must be a valid time (e.g., 7:00 AM).`,
              };
            }
            const databaseValue = toDatabaseTimeString(normalizedTime);
            if (!databaseValue) {
              return {
                value: undefined,
                error: `${columnLabel} must be a valid time (e.g., 7:00 AM).`,
              };
            }
            return { value: databaseValue };
          }

          if (Number.isNaN(Date.parse(trimmed))) {
            return {
              value: undefined,
              error: `${columnLabel} must be a valid date/time.`,
            };
          }
          return { value: trimmed };

        case "enum": {
          if (column.enumValues && !column.enumValues.includes(trimmed)) {
            return {
              value: undefined,
              error: `${columnLabel} must be one of: ${column.enumValues.join(
                ", "
              )}.`,
            };
          }
          return { value: trimmed };
        }

        case "uuid": {
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(trimmed)) {
            return {
              value: undefined,
              error: `${columnLabel} must be a valid UUID.`,
            };
          }
          return { value: trimmed };
        }

        default:
          return { value: rawValue };
      }
    },
    []
  );

  const handleNewRecordInputChange = useCallback(
    (columnName: string, value: string) => {
      setNewRecordInputs((prev) => ({
        ...prev,
        [columnName]: value,
      }));

      const column = editableColumns.find((col) => col.name === columnName);
      if (!column) return;

      const { error } = parseNewRecordValue(column, value);

      setNewRecordFieldErrors((prev) => {
        const next = { ...prev };
        if (error) {
          next[columnName] = error;
        } else {
          delete next[columnName];
        }
        return next;
      });

      setNewRecordError(null);
      setNewRecordSuccess(null);
    },
    [editableColumns, parseNewRecordValue]
  );

  const handleCreateRecord = useCallback(async () => {
    if (!selectedTable || !tableData) return;

    setNewRecordError(null);
    setNewRecordSuccess(null);
    const record: Record<string, unknown> = {};
    const fieldErrors: Record<string, string> = {};

    editableColumns.forEach((column) => {
      const rawValue = newRecordInputs[column.name] ?? "";
      const { value, error } = parseNewRecordValue(column, rawValue);

      if (error) {
        fieldErrors[column.name] = error;
        return;
      }

      if (value !== undefined) {
        record[column.name] = value;
      }
    });

    const errorMessages = Object.values(fieldErrors);
    if (errorMessages.length > 0) {
      setNewRecordFieldErrors(fieldErrors);
      setNewRecordError(errorMessages.join("\n"));
      return;
    }

    if (Object.keys(record).length === 0) {
      setNewRecordError("Provide at least one value before creating a record.");
      return;
    }

    try {
      setIsCreatingRecord(true);
      setNewRecordFieldErrors({});
      const response = await adminViewerCreateRecord({
        path: { tableName: selectedTable },
        body: { record },
      });

      if (response.data?.success) {
        setNewRecordSuccess("Record created successfully");

        const primaryKeyColumn = tableData.columns.find((col) => col.isPrimary);
        if (primaryKeyColumn) {
          const createdRecord = response.data.createdRecord as
            | Record<string, unknown>
            | undefined;
          const primaryKeyValue =
            createdRecord?.[primaryKeyColumn.name] ??
            record[primaryKeyColumn.name];

          if (
            primaryKeyValue !== undefined &&
            primaryKeyValue !== null &&
            (typeof primaryKeyValue === "string" ||
              typeof primaryKeyValue === "number")
          ) {
            highlightRow(primaryKeyValue);
          }
        }

        const blankInputs: Record<string, string> = {};
        editableColumns.forEach((column) => {
          blankInputs[column.name] = "";
        });
        setNewRecordInputs(blankInputs);
        setNewRecordFieldErrors({});
        await refreshTableData();
      } else {
        setNewRecordError(response.data?.message || "Failed to create record");
      }
    } catch (error) {
      console.error("Failed to create record:", error);
      setNewRecordError(
        error instanceof Error ? error.message : "Unknown error creating record"
      );
    } finally {
      setIsCreatingRecord(false);
    }
  }, [
    selectedTable,
    tableData,
    editableColumns,
    newRecordInputs,
    parseNewRecordValue,
    highlightRow,
    refreshTableData,
  ]);

  const formatCellValue = useCallback(
    (
      value: any,
      column: ColumnMetadataDto,
      rowIndex?: number,
      columnIndex?: number
    ) => {
      let editor: React.ReactNode | null = null;

      if (
        editingCell &&
        rowIndex !== undefined &&
        columnIndex !== undefined &&
        editingCell.rowIndex === rowIndex &&
        editingCell.columnIndex === columnIndex
      ) {
        editor = (
          <CellEditor
            value={value}
            column={column}
            onSave={handleCellSave}
            onCancel={handleCellCancel}
          />
        );
      }

      // Add edit cursor for editable cells
      const isEditable = !column.isPrimary && column.dataType !== "relation";
      const baseClassName = isEditable
        ? "cursor-pointer hover:bg-gray-100 p-1 rounded"
        : "";

      let element: React.ReactNode | null = null;
      if (value === null || value === undefined) {
        element = (
          <span className={`text-gray-400 ${baseClassName}`}>null</span>
        );
      } else {
        switch (column.dataType) {
          case "relation":
            element = (
              <button
                onClick={() =>
                  navigateToRelatedRow(column.relationTarget!, value)
                }
                className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
              >
                {value}
              </button>
            );
            break;

          case "boolean":
            element = (
              <span
                className={`${
                  value ? "text-green-600" : "text-red-600"
                } ${baseClassName}`}
              >
                {value ? "true" : "false"}
              </span>
            );
            break;

          case "number":
            element = (
              <span className={`text-blue-800 font-mono ${baseClassName}`}>
                {typeof value === "number" ? value.toLocaleString() : value}
              </span>
            );
            break;
          case "date":
            element = (
              <span className={`text-purple-600 ${baseClassName}`}>
                {new Date(value).toLocaleDateString()}
              </span>
            );
            break;
          case "datetime":
            if (isTimeOnlyColumn(column)) {
              const displayTime = formatTimeForDisplayValue(value);
              element = (
                <span className={`text-purple-600 ${baseClassName}`}>
                  {displayTime}
                </span>
              );
            } else {
              element = (
                <span className={`text-purple-600 ${baseClassName}`}>
                  {new Date(value).toLocaleString()}
                </span>
              );
            }
            break;
          case "json":
            element = (
              <div className={`max-w-xs ${baseClassName}`}>
                <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                  {typeof value === "object"
                    ? JSON.stringify(value, null, 2)
                    : value}
                </pre>
              </div>
            );
            break;
          case "uuid":
            element = (
              <span
                className={`font-mono text-xs text-gray-600 ${baseClassName}`}
              >
                {value}
              </span>
            );
            break;

          case "enum":
            element = (
              <span
                className={`bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs ${baseClassName}`}
              >
                {value}
              </span>
            );
            break;

          case "string":
          default: {
            const stringValue = String(value);
            if (stringValue.length > 100) {
              element = (
                <div className={`max-w-xs ${baseClassName}`}>
                  <div className="truncate" title={stringValue}>
                    {stringValue}
                  </div>
                </div>
              );
            }
            element = <span className={baseClassName}>{stringValue}</span>;
          }
        }
      }

      return (
        <div className="relative min-w-10">
          <div className={`${editor && "opacity-0"}`}>{element}</div>
          {editor}
        </div>
      );
    },
    [editingCell, handleCellSave, handleCellCancel, navigateToRelatedRow]
  );

  return (
    <div className="flex h-screen bg-gray-50">
      <DatabaseSidebar
        tables={tables}
        selectedTable={selectedTable}
        onSelectTable={selectTable}
        loading={loadingTables}
        isConnected={isConnected}
        onNavigateHome={() => navigate("/")}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {banner && (
          <div
            className={`px-4 py-3 text-sm flex items-start justify-between ${
              banner.type === "success"
                ? "border-green-200 bg-[#e4ffd1] text-green-900"
                : "border-red-200 bg-red-50 text-red-900"
            }`}
          >
            <span>{banner.message}</span>
            <button
              onClick={dismissBanner}
              className="ml-4 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>
        )}
        {selectedTable ? (
          <>
            <DatabaseToolbar
              selectedTable={selectedTable}
              tableData={tableData}
              selectedRow={selectedRow}
              querySearch={query.search}
              onClearSelectedRow={clearSelectedRow}
              onOpenAddRow={openAddRowModal}
              disableAddRow={!tableData || isAddRowOpen}
              onDeleteSelected={handleDeleteSelected}
              selectedRowCount={selectedRows.size}
              searchInput={searchInput}
              onSearchChange={handleSearch}
            />

            <div className="flex-1 overflow-hidden">
              {loadingTableData && !tableData ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : tableData ? (
                <DatabaseTable
                  tableData={tableData}
                  selectedTable={selectedTable}
                  selectedRow={selectedRow}
                  query={query}
                  selectedRows={selectedRows}
                  highlightedRows={highlightedRows}
                  onSelectRow={handleSelectRow}
                  onSelectAllRows={handleSelectAllRows}
                  onSortAscending={handleSortAscending}
                  onSortDescending={handleSortDescending}
                  onApplyFilter={handleFilterColumn}
                  onClearFilter={handleClearColumnFilter}
                  columnFilter={columnFilter}
                  onPageChange={handlePageChange}
                  formatCellValue={formatCellValue}
                  handleCellClick={handleCellClick}
                  getRowPrimaryKey={getRowPrimaryKey}
                />
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                No table selected
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Choose a table from the sidebar to view its data
              </p>
            </div>
          </div>
        )}
      </div>

      <AddRowModal
        isOpen={isAddRowOpen && !!tableData}
        tableName={selectedTable}
        columns={editableColumns}
        inputs={newRecordInputs}
        fieldErrors={newRecordFieldErrors}
        globalError={newRecordError}
        successMessage={newRecordSuccess}
        isCreating={isCreatingRecord}
        disableCreate={
          isCreatingRecord ||
          editableColumns.length === 0 ||
          Object.keys(newRecordFieldErrors).length > 0
        }
        onChange={handleNewRecordInputChange}
        onClose={closeAddRowModal}
        onCreate={handleCreateRecord}
      />

      <ConfirmDialog
        isOpen={!!pendingUpdate}
        title="Confirm Update"
        message={
          pendingUpdate
            ? `Are you sure you want to update "${
                pendingUpdate.columnName
              }" from "${describeConfirmValue(
                pendingUpdate.originalValue,
                pendingUpdate.originalDisplayValue
              )}" to "${describeConfirmValue(
                pendingUpdate.newValue,
                pendingUpdate.newDisplayValue
              )}"?`
            : ""
        }
        confirmText="Update"
        cancelText="Cancel"
        onConfirm={confirmUpdate}
        onCancel={cancelUpdate}
        isLoading={false}
      />

      <ConfirmDialog
        isOpen={!!pendingDelete}
        title="Confirm Delete"
        message={
          pendingDelete
            ? `Are you sure you want to delete ${
                pendingDelete.primaryKeyValues.length
              } record${
                pendingDelete.primaryKeyValues.length === 1 ? "" : "s"
              }? This action cannot be undone.`
            : ""
        }
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        isLoading={false}
      />
    </div>
  );
};

export default DatabaseViewer;
