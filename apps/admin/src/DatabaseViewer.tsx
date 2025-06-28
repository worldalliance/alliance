import React, { useState, useEffect, useCallback, useRef } from "react";
import type {
  TableDataDto,
  ColumnMetadataDto,
  TableMetadataDto,
} from "@alliance/shared/client/types.gen";
import {
  adminViewerGetTableData,
  adminViewerGetTables,
} from "@alliance/shared/client";

interface TableDataQueryDto {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
  search?: string;
}

const DatabaseViewer: React.FC = () => {
  const [tables, setTables] = useState<TableMetadataDto[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [tableData, setTableData] = useState<TableDataDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<{
    tableName: string;
    rowId: string | number;
  } | null>(null);
  const [query, setQuery] = useState<TableDataQueryDto>({
    page: 1,
    limit: 50,
    sortOrder: "ASC",
  });
  const [searchInput, setSearchInput] = useState("");
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadTables();
  }, []);

  const loadTableData = useCallback(async () => {
    if (!selectedTable) return;

    const isInitialLoad = !tableData;

    try {
      // Only show loading for initial load
      if (isInitialLoad) {
        setLoading(true);
      }

      const response = await adminViewerGetTableData({
        path: { tableName: selectedTable },
        query: {
          page: query.page,
          limit: query.limit,
          sortBy: query.sortBy,
          sortOrder: query.sortOrder as "ASC" | "DESC",
          search: query.search,
        },
      });
      if (response.data) {
        setTableData(response.data);

        // If we have a selected row for this table and it's not visible on this page,
        // try to find it by searching for it
        if (
          selectedRow &&
          selectedRow.tableName === selectedTable &&
          response.data.rows.length > 0
        ) {
          const rowExists = response.data.rows.some((row) => {
            const rowPrimaryKey = getRowPrimaryKey(row, response.data.columns);
            return (
              rowPrimaryKey !== null &&
              String(rowPrimaryKey) === String(selectedRow.rowId)
            );
          });

          // If row not found and we're not already searching, search for the ID
          if (!rowExists && !query.search) {
            setLoading(false);
            setQuery((prev) => ({
              ...prev,
              search: String(selectedRow.rowId),
              page: 1,
            }));
            return; // This will trigger another loadTableData call
          }
        }
      }
    } catch (error) {
      console.error("Failed to load table data:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedTable, query, selectedRow, tableData]);

  useEffect(() => {
    if (selectedTable) {
      loadTableData();
    }
  }, [selectedTable, query, loadTableData]);

  const loadTables = async () => {
    try {
      setLoading(true);
      const response = await adminViewerGetTables();
      if (response.data) {
        console.log("response.data", response.data);
        setTables(response.data.tables);
      }
    } catch (error) {
      console.error("Failed to load tables:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (columnName: string) => {
    setQuery((prev) => ({
      ...prev,
      sortBy: columnName,
      sortOrder:
        prev.sortBy === columnName && prev.sortOrder === "ASC" ? "DESC" : "ASC",
      page: 1,
    }));
  };

  const handlePageChange = (newPage: number) => {
    setQuery((prev) => ({ ...prev, page: newPage }));
  };

  const handleSearch = (search: string) => {
    setSearchInput(search);

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      setQuery((prev) => ({ ...prev, search: search || undefined, page: 1 }));
    }, 300);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const navigateToRelatedRow = (tableName: string, rowId: string | number) => {
    setSelectedRow({ tableName, rowId });
    setSelectedTable(tableName);
    setQuery((prev) => ({ ...prev, page: 1, search: undefined }));
  };

  // Clear table data when changing tables to avoid showing stale data
  useEffect(() => {
    setTableData(null);
    setSearchInput("");
    setQuery((prev) => ({ ...prev, search: undefined, page: 1 }));
  }, [selectedTable]);

  // Helper function to get the primary key value for a row
  const getRowPrimaryKey = (row: unknown[], columns: ColumnMetadataDto[]) => {
    const primaryKeyColumn = columns.find((col) => col.isPrimary);
    if (!primaryKeyColumn) return null;

    const primaryKeyIndex = columns.findIndex((col) => col.isPrimary);
    return primaryKeyIndex >= 0 ? row[primaryKeyIndex] : null;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatCellValue = (value: any, column: ColumnMetadataDto) => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400">null</span>;
    }

    switch (column.dataType) {
      case "relation":
        return (
          <button
            onClick={() => navigateToRelatedRow(column.relationTarget!, value)}
            className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
          >
            {value}
          </button>
        );

      case "boolean":
        return (
          <span className={value ? "text-green-600" : "text-red-600"}>
            {value ? "true" : "false"}
          </span>
        );

      case "number":
        return (
          <span className="text-blue-800 font-mono">
            {typeof value === "number" ? value.toLocaleString() : value}
          </span>
        );

      case "date":
        return (
          <span className="text-purple-600">
            {new Date(value).toLocaleDateString()}
          </span>
        );

      case "datetime":
        return (
          <span className="text-purple-600">
            {new Date(value).toLocaleString()}
          </span>
        );

      case "json":
        return (
          <div className="max-w-xs">
            <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
              {typeof value === "object"
                ? JSON.stringify(value, null, 2)
                : value}
            </pre>
          </div>
        );

      case "uuid":
        return <span className="font-mono text-xs text-gray-600">{value}</span>;

      case "enum":
        return (
          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
            {value}
          </span>
        );

      case "string":
      default: {
        const stringValue = String(value);
        if (stringValue.length > 100) {
          return (
            <div className="max-w-xs">
              <div className="truncate" title={stringValue}>
                {stringValue}
              </div>
            </div>
          );
        }
        return stringValue;
      }
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">Database Viewer</h1>
          <p className="text-sm text-gray-600 mt-1">
            {tables.length} tables available
          </p>
        </div>

        {/* Tables List */}
        <div className="flex-1 overflow-y-auto">
          {loading && !tables.length ? (
            <div className="p-6">
              <div className="animate-pulse space-y-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-1">
              {tables.map((table) => (
                <button
                  key={table.name}
                  onClick={() => setSelectedTable(table.name)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedTable === table.name
                      ? "bg-blue-50 border border-blue-200 text-blue-900"
                      : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {table.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {table.entityName}
                      </div>
                    </div>
                    <div className="ml-2 flex-shrink-0">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {table.recordCount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedTable ? (
          <>
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="flex items-center space-x-3">
                    <h2 className="text-lg font-semibold text-gray-900">
                      {selectedTable}
                    </h2>
                    {selectedRow && selectedRow.tableName === selectedTable && (
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Row ID: {selectedRow.rowId}
                        </span>
                        <button
                          onClick={() => {
                            setSelectedRow(null);
                            setSearchInput("");
                            setQuery((prev) => ({
                              ...prev,
                              search: undefined,
                              page: 1,
                            }));
                          }}
                          className="text-gray-400 hover:text-gray-600"
                          title="Clear selection"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                  {tableData && (
                    <p className="text-sm text-gray-600">
                      {tableData.totalCount.toLocaleString()} total records
                      {selectedRow &&
                        selectedRow.tableName === selectedTable &&
                        query.search && (
                          <span className="ml-2 text-yellow-600">
                            (filtered to show selected row)
                          </span>
                        )}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search in table..."
                      value={searchInput}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg
                        className="h-5 w-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-hidden">
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : tableData ? (
                <div className="h-full flex flex-col">
                  <div className="flex-1 overflow-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          {tableData.columns.map((column, columnIndex) => (
                            <th
                              key={`${column.name}-${columnIndex}`}
                              onClick={() => handleSort(column.name)}
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            >
                              <div className="flex items-center space-x-1">
                                <span>{column.name}</span>
                                {column.isPrimary && (
                                  <span className="text-yellow-500">🔑</span>
                                )}
                                {column.dataType === "relation" && (
                                  <span className="text-blue-500">🔗</span>
                                )}
                                {query.sortBy === column.name && (
                                  <span>
                                    {query.sortOrder === "ASC" ? "↑" : "↓"}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-400 normal-case">
                                <span className="font-medium">
                                  {column.dataType}
                                </span>
                                <span className="text-gray-300 ml-1">
                                  ({column.rawType})
                                </span>
                                {column.relationTarget && (
                                  <span className="text-blue-400">
                                    {" "}
                                    → {column.relationTarget}
                                  </span>
                                )}
                                {column.enumValues && (
                                  <div className="text-xs mt-1">
                                    {column.enumValues.join(", ")}
                                  </div>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {tableData.rows.map((row, rowIndex) => {
                          const rowPrimaryKey = getRowPrimaryKey(
                            row,
                            tableData.columns
                          );
                          const isSelectedRow =
                            selectedRow !== null &&
                            selectedRow.tableName === selectedTable &&
                            rowPrimaryKey !== null &&
                            String(rowPrimaryKey) === String(selectedRow.rowId);

                          // Use primary key if available, otherwise use page and row index for uniqueness
                          const uniqueKey =
                            rowPrimaryKey !== null
                              ? `${selectedTable}-${rowPrimaryKey}`
                              : `${selectedTable}-page${query.page}-row${rowIndex}`;

                          return (
                            <tr
                              key={uniqueKey}
                              className={`${
                                isSelectedRow
                                  ? "bg-yellow-50 border-yellow-200 hover:bg-yellow-100"
                                  : "hover:bg-gray-50"
                              } ${
                                isSelectedRow
                                  ? "border-l-4 border-l-yellow-400"
                                  : ""
                              }`}
                            >
                              {row.map((cell, cellIndex) => (
                                <td
                                  key={cellIndex}
                                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                                >
                                  {formatCellValue(
                                    cell,
                                    tableData.columns[cellIndex]
                                  )}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {tableData.totalPages > 1 && (
                    <div className="border-t border-gray-200 bg-white px-6 py-3">
                      <div className="flex justify-between items-center">
                        <div className="text-sm text-gray-700">
                          Showing page {tableData.page} of{" "}
                          {tableData.totalPages}
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handlePageChange(tableData.page - 1)}
                            disabled={tableData.page <= 1}
                            className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                          >
                            Previous
                          </button>

                          <div className="flex space-x-1">
                            {Array.from(
                              { length: Math.min(5, tableData.totalPages) },
                              (_, i) => {
                                const page =
                                  Math.max(1, tableData.page - 2) + i;
                                if (page > tableData.totalPages) return null;
                                return (
                                  <button
                                    key={page}
                                    onClick={() => handlePageChange(page)}
                                    className={`px-3 py-1 text-sm border rounded-md ${
                                      page === tableData.page
                                        ? "bg-blue-600 text-white border-blue-600"
                                        : "bg-white border-gray-300 hover:bg-gray-50"
                                    }`}
                                  >
                                    {page}
                                  </button>
                                );
                              }
                            )}
                          </div>

                          <button
                            onClick={() => handlePageChange(tableData.page + 1)}
                            disabled={tableData.page >= tableData.totalPages}
                            className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
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
    </div>
  );
};

export default DatabaseViewer;
