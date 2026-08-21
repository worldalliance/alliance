import type { RangeField } from "@alliance/common/forms/form-schema";
import { RequiredToggle } from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

export function EditableRangeField({
  field,
  onUpdate,
  onRemove,
  onDragStart,
  onDragEnd,
  isDragging,
  previousFields,
}: BaseFieldProps<RangeField>) {
  const defaultValue =
    typeof field.defaultValue === "number" ? field.defaultValue : "";

  const handleOptionCountChange = (raw: string) => {
    if (!raw) {
      onUpdate({ optionCount: undefined });
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return;
    }
    onUpdate({ optionCount: parsed });
  };

  const handleDefaultValueChange = (raw: string) => {
    if (!raw) {
      onUpdate({ defaultValue: undefined });
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return;
    }
    onUpdate({ defaultValue: parsed });
  };

  return (
    <FieldWrapper
      field={field}
      onUpdate={onUpdate}
      previousFields={previousFields}
      onRemove={onRemove}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      isDragging={isDragging}
    >
      <FieldLabelEditor
        value={field.label}
        onChange={(value) => onUpdate({ label: value })}
      />

      <RequiredToggle
        checked={field.required}
        onChange={(checked) => onUpdate({ required: checked })}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Number of options
          </label>
          <input
            type="number"
            value={field.optionCount}
            onChange={(event) => handleOptionCountChange(event.target.value)}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Default selection (optional)
          </label>
          <input
            type="number"
            min={1}
            max={field.optionCount}
            value={defaultValue}
            onChange={(event) => handleDefaultValueChange(event.target.value)}
            placeholder="None"
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Start label (optional)
          </label>
          <input
            type="text"
            value={field.startLabel ?? ""}
            onChange={(event) => onUpdate({ startLabel: event.target.value })}
            placeholder="e.g. Not likely"
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            End label (optional)
          </label>
          <input
            type="text"
            value={field.endLabel ?? ""}
            onChange={(event) => onUpdate({ endLabel: event.target.value })}
            placeholder="e.g. Most likely"
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
    </FieldWrapper>
  );
}
