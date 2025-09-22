import React from "react";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import type { TableDataDto } from "@alliance/shared/client/types.gen";
import type { SelectedRowState } from "./DatabaseViewer.hooks";

interface DatabaseToolbarProps {
  selectedTable: string;
  tableData: TableDataDto | null;
  selectedRow: SelectedRowState | null;
  querySearch?: string;
  onClearSelectedRow: () => void;
  onOpenAddRow: () => void;
  disableAddRow: boolean;
  onDeleteSelected: () => void;
  selectedRowCount: number;
  searchInput: string;
  onSearchChange: (value: string) => void;
}

const DatabaseToolbar: React.FC<DatabaseToolbarProps> = ({
  selectedTable,
  tableData,
  selectedRow,
  querySearch,
  onClearSelectedRow,
  onOpenAddRow,
  disableAddRow,
  onDeleteSelected,
  selectedRowCount,
  searchInput,
  onSearchChange,
}) => {
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center space-x-3">
            <h2 className="!text-lg font-semibold text-gray-900">
              {selectedTable}
            </h2>
            {selectedRow && selectedRow.tableName === selectedTable && (
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  Row ID: {selectedRow.rowId}
                </span>
                <button
                  onClick={onClearSelectedRow}
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
                querySearch && (
                  <span className="ml-2 text-yellow-600">
                    (filtered to show selected row)
                  </span>
                )}
            </p>
          )}
        </div>

        <div className="flex items-center space-x-4">
          <Button
            onClick={onOpenAddRow}
            disabled={disableAddRow}
            color={ButtonColor.Blue}
            className="!py-[10px] gap-x-2"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>Add Row</span>
          </Button>
          {selectedRowCount > 0 && (
            <button
              onClick={onDeleteSelected}
              className="px-4 py-2 bg-red-100 text-black border border-red-500 rounded-md hover:bg-red-300 focus:ring-2 focus:ring-red-500 flex items-center space-x-2"
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              <span>
                Delete {selectedRowCount} row
                {selectedRowCount === 1 ? "" : "s"}
              </span>
            </button>
          )}
          <div className="relative">
            <input
              type="text"
              placeholder="Search in table..."
              value={searchInput}
              onChange={(e) => onSearchChange(e.target.value)}
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
            {searchInput && (
              <div
                className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer"
                onClick={() => onSearchChange("")}
              >
                <span className="text-gray-400 !font-mono text-xs">x</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseToolbar;
