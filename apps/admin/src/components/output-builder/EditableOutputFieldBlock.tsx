import {
  elementInternalDescriptor,
  fieldPickerLabel,
} from "@alliance/common/forms/element-descriptors";
import {
  type AnyField,
  type OutputFieldBlock,
} from "@alliance/common/forms/form-schema";
import { type VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { cn } from "@alliance/shared/styles/util";
import { useEffect, useState } from "react";
import { VariableTextField } from "../VariableTextField";
import {
  ConditionalVisibility,
  type OutputBlockOption,
} from "../form-fields/CommonControls";

interface EditableOutputFieldBlockProps {
  block: OutputFieldBlock;
  onUpdate: (updates: Partial<OutputFieldBlock>) => void;
  onRemove: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
  availableFields: AnyField[];
  outputBlocks?: OutputBlockOption[];
}

export function EditableOutputFieldBlock({
  block,
  onUpdate,
  onRemove,
  onDragStart,
  onDragEnd,
  isDragging,
  availableFields,
  outputBlocks,
}: EditableOutputFieldBlockProps) {
  const selectedField = availableFields.find(
    (field) => field.id === block.fieldId,
  );
  const [showVisibilityControls, setShowVisibilityControls] = useState(() =>
    block.visibleIfFormula?.conditions
      ? Object.keys(block.visibleIfFormula.conditions).length > 0
      : false,
  );

  useEffect(() => {
    const hasConditions = block.visibleIfFormula?.conditions
      ? Object.keys(block.visibleIfFormula.conditions).length > 0
      : false;
    if (hasConditions) {
      setShowVisibilityControls(true);
    }
  }, [block.visibleIfFormula]);

  const handleVisibilityChange = (updates: {
    visibleIfFormula?: VisibleIfFormula;
  }) => {
    onUpdate(updates);
  };

  const handleVisibilityToggle = (enabled: boolean) => {
    setShowVisibilityControls(enabled);
    if (!enabled) {
      onUpdate({ visibleIfFormula: undefined });
    }
  };

  const showLabel = block.showLabel ?? true;

  return (
    <div
      className={cn(
        "group relative border rounded-lg transition-all",
        isDragging
          ? "border-blue-400 shadow-lg opacity-50"
          : "border-gray-200 hover:border-gray-300",
      )}
    >
      <div
        className="absolute -left-3 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        title="Drag to reorder"
      >
        <div className="text-gray-400 hover:text-gray-600 p-2 pr-1 bg-white shadow-lg rounded-sm">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <circle cx="2" cy="2" r="1" />
            <circle cx="6" cy="2" r="1" />
            <circle cx="2" cy="6" r="1" />
            <circle cx="6" cy="6" r="1" />
            <circle cx="2" cy="10" r="1" />
            <circle cx="6" cy="10" r="1" />
          </svg>
        </div>
      </div>

      <span
        className="absolute top-2 left-2 font-mono text-[10px] text-gray-400 px-1.5 py-0.5 bg-gray-50 border border-gray-200 rounded select-all"
        title="Block id"
      >
        {block.id}
      </span>
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <label className="flex cursor-pointer items-center px-2 py-1.5 text-gray-700 text-xs rounded-md hover:bg-gray-100">
          <input
            type="checkbox"
            className="mr-2"
            checked={showVisibilityControls}
            onChange={(event) => handleVisibilityToggle(event.target.checked)}
          />
          Conditional visibility
        </label>
        <button
          onClick={onRemove}
          className="text-gray-500 hover:text-red-500 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50"
          title="Remove block"
          type="button"
        >
          ×
        </button>
      </div>

      <div className="space-y-3 p-4 pt-8">
        <div>
          <p className="text-sm font-medium text-gray-900">
            {selectedField
              ? elementInternalDescriptor(selectedField)
              : "Select a field"}
          </p>
          <p className="text-xs text-gray-500">
            {selectedField
              ? `Field ID: ${selectedField.id}`
              : "This output block needs a field selection."}
          </p>
        </div>

        <div>
          <label className="block text-xs text-gray-700 mb-1">
            Output field
          </label>
          <select
            value={block.fieldId || ""}
            onChange={(event) => onUpdate({ fieldId: event.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          >
            {availableFields.length === 0 && (
              <option value="">No output fields available</option>
            )}
            {availableFields.map((field) => (
              <option key={field.id} value={field.id}>
                {fieldPickerLabel(field)}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center text-xs text-gray-700">
          <input
            type="checkbox"
            checked={showLabel}
            onChange={(event) =>
              onUpdate({ showLabel: event.target.checked ? true : false })
            }
            className="mr-2"
          />
          Show label when rendering
        </label>

        <div>
          <label className="block text-xs text-gray-700 mb-1">
            Label override (optional)
          </label>
          <VariableTextField
            value={block.labelOverride || ""}
            onChange={(labelOverride) =>
              onUpdate({ labelOverride: labelOverride || undefined })
            }
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            placeholder="Custom label to display"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-700 mb-1">
            Display format
          </label>
          <select
            value={block.format || "field"}
            onChange={(event) =>
              onUpdate({
                format: event.target.value as OutputFieldBlock["format"],
              })
            }
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          >
            <option value="field">As form field</option>
            <option value="textonly">Content only</option>
            {/* <option value="card">Card layout</option> */}
          </select>
        </div>
      </div>

      {showVisibilityControls && (
        <div className="border-t border-gray-200 p-4 pt-0">
          <ConditionalVisibility
            field={block as unknown as AnyField}
            previousFields={availableFields}
            outputBlocks={outputBlocks}
            onChange={handleVisibilityChange}
          />
        </div>
      )}
    </div>
  );
}
