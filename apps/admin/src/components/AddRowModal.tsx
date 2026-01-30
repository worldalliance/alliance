import React, { useEffect, useMemo } from "react";
import type { ColumnMetadataDto } from "@alliance/shared/client/types.gen";
import { isTimeOnlyColumn } from "./dbviewer/timeFieldUtils";

interface AddRowModalProps {
  isOpen: boolean;
  tableName: string;
  columns: ColumnMetadataDto[];
  inputs: Record<string, string>;
  fieldErrors: Record<string, string>;
  globalError: string | null;
  successMessage: string | null;
  isCreating: boolean;
  disableCreate: boolean;
  onChange: (columnName: string, value: string) => void;
  onClose: () => void;
  onCreate: () => void;
}

const AddRowModal: React.FC<AddRowModalProps> = ({
  isOpen,
  tableName,
  columns,
  inputs,
  fieldErrors,
  globalError,
  successMessage,
  isCreating,
  disableCreate,
  onChange,
  onClose,
  onCreate,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (successMessage) {
      setTimeout(() => {
        onClose();
      }, 1000);
    }
  }, [successMessage, onClose]);

  const renderedColumns = useMemo(() => {
    return columns.map((column) => {
      const isTimeColumn = isTimeOnlyColumn(column);
      const value = inputs[column.name] ?? "";
      const hasError = !!fieldErrors[column.name];
      const baseClasses =
        "w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white";
      const inputClasses = `${baseClasses} ${
        hasError ? "border-red-500" : "border-gray-300"
      }`;

      const placeholder = isTimeColumn
        ? "07:00"
        : column.isNullable
        ? "Leave blank for NULL"
        : undefined;

      const commonInputProps = {
        value,
        onChange: (
          e: React.ChangeEvent<
            HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
          >
        ) => onChange(column.name, e.target.value),
        className: inputClasses,
        placeholder,
      } as const;

      let field: React.ReactNode;

      if (isTimeColumn) {
        field = <input {...commonInputProps} type="time" step="1" />;
      } else {
        switch (column.dataType) {
          case "boolean":
            field = (
              <select {...commonInputProps}>
                <option value="">-- Select --</option>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            );
            break;
          case "enum":
            field = (
              <select {...commonInputProps}>
                <option value="">-- Select --</option>
                {column.enumValues?.map((enumValue) => (
                  <option key={enumValue} value={enumValue}>
                    {enumValue}
                  </option>
                ))}
              </select>
            );
            break;
          case "number":
            field = (
              <input {...commonInputProps} type="text" inputMode="decimal" />
            );
            break;
          case "relation":
            field = (
              <input
                {...commonInputProps}
                type="text"
                placeholder={
                  column.relationTarget
                    ? `Enter ${column.relationTarget} ID`
                    : "Enter related record ID"
                }
              />
            );
            break;
          case "date":
            field = <input {...commonInputProps} type="date" />;
            break;
          case "datetime":
            field = <input {...commonInputProps} type="datetime-local" />;
            break;
          case "json":
            field = (
              <textarea
                {...commonInputProps}
                className={`${inputClasses} h-32 resize-y`}
                placeholder="Enter JSON"
              />
            );
            break;
          default:
            field = <input {...commonInputProps} type="text" />;
            break;
        }
      }

      return (
        <div
          key={column.name}
          className={`space-y-1 ${
            column.dataType === "json" ? "md:col-span-2" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              {column.name}
            </label>
            <div className="flex items-center space-x-2 text-xs text-gray-400">
              <span>{isTimeColumn ? "time" : column.dataType}</span>
              {column.isPrimary && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">
                  PK
                </span>
              )}
              {column.relationTarget && <span>↗ {column.relationTarget}</span>}
            </div>
          </div>
          {field}
          {hasError ? (
            <p className="text-xs text-red-600">{fieldErrors[column.name]}</p>
          ) : (
            <span className="text-xs text-gray-400">
              {column.isNullable
                ? "Optional"
                : column.isPrimary
                ? "Leave blank to use the auto-generated default"
                : "Required (may have default)"}
            </span>
          )}
        </div>
      );
    });
  }, [columns, inputs, fieldErrors, onChange]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Add Row to {tableName}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Provide values for the columns you want to set. Leave fields blank
            to keep database defaults or NULL for nullable columns.
          </p>
        </div>
        {!successMessage && (
          <div className="px-6 py-4 overflow-y-auto">
            <div className="grid gap-4 md:grid-cols-2">{renderedColumns}</div>
          </div>
        )}
        {globalError && (
          <div className={`px-6 text-sm text-red-600 whitespace-pre-line`}>
            {globalError}
          </div>
        )}
        {successMessage && (
          <div
            className={`px-6 text-sm text-green-600 whitespace-pre-line py-10`}
          >
            {successMessage}
          </div>
        )}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:ring-2 focus:ring-blue-500"
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onCreate}
            disabled={disableCreate}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? "Creating..." : "Create Record"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddRowModal;
