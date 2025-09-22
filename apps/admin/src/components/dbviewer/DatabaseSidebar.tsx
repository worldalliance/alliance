import React, { useMemo } from "react";
import type { TableMetadataDto } from "@alliance/shared/client/types.gen";

interface DatabaseSidebarProps {
  tables: TableMetadataDto[];
  selectedTable: string;
  onSelectTable: (tableName: string) => void;
  loading: boolean;
  isConnected: boolean;
  onNavigateHome: () => void;
}

const DatabaseSidebar: React.FC<DatabaseSidebarProps> = ({
  tables,
  selectedTable,
  onSelectTable,
  loading,
  isConnected,
  onNavigateHome,
}) => {
  const tableCount = tables.length;

  const sortedTables = useMemo(() => {
    return [...tables].sort((a, b) => {
      if (a.recordCount === 0 && b.recordCount > 0) return 1;
      if (a.recordCount > 0 && b.recordCount === 0) return -1;
      return a.name.localeCompare(b.name);
    });
  }, [tables]);

  const isLocalhost =
    typeof window !== "undefined" && window.location.href.includes("localhost");

  return (
    <div className="w-75 border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-3">
          <button
            onClick={onNavigateHome}
            className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            title="Back to Admin Panel"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1
            className={`!text-xl font-bold ${
              isLocalhost ? "text-gray-900" : "text-red-500"
            }`}
          >
            Database Viewer
          </h1>
        </div>
        <div className="flex items-center space-x-2 mt-2">
          <p className="text-sm text-gray-600 mr-4">{tableCount} tables</p>
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-red-500"
            }`}
          ></div>
          <span className="text-xs text-gray-500">
            {isConnected ? "Live updates active" : "Disconnected"}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && !tables.length ? (
          <div className="p-6">
            <div className="animate-pulse space-y-3">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="h-14 bg-gray-200 rounded" />
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-1 pr-2">
            {sortedTables.map((table) => (
              <div
                key={table.name}
                onClick={() => onSelectTable(table.name)}
                className={`w-full text-left p-3 rounded-lg ${
                  selectedTable === table.name
                    ? "bg-blue-200"
                    : "hover:bg-gray-100 text-gray-700 cursor-pointer"
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
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        selectedTable === table.name
                          ? " text-black"
                          : "bg-gray-200 text-gray-800"
                      }`}
                    >
                      {table.recordCount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DatabaseSidebar;
