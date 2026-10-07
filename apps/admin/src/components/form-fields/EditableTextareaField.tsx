import type { TextareaField } from "@alliance/common/forms/form-schema";
import { RequiredToggle } from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

export function EditableTextareaField({
  field,
  onUpdate,
  onRemove,
  previousFields,
  laterFields,
}: BaseFieldProps<TextareaField>) {
  return (
    <FieldWrapper
      field={field}
      onUpdate={onUpdate}
      previousFields={previousFields}
      laterFields={laterFields}
      onRemove={onRemove}
    >
      <FieldLabelEditor
        value={field.label}
        onChange={(v) => onUpdate({ label: v })}
      />

      <div className="flex items-center space-x-2">
        <label className="text-xs text-gray-700">Rows:</label>
        <input
          type="number"
          value={field.rows || 3}
          onChange={(e) => onUpdate({ rows: parseInt(e.target.value) || 3 })}
          className="w-16 px-1 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          min="1"
          max="20"
        />
        <label className="text-xs text-gray-700">Max Length:</label>
        <input
          type="number"
          value={field.maxLength || ""}
          onChange={(e) =>
            onUpdate({
              maxLength: e.target.value ? parseInt(e.target.value) : undefined,
            })
          }
          className="w-16 px-1 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 mr-5"
          min="0"
        />
        <RequiredToggle
          checked={field.required}
          onChange={(checked) => onUpdate({ required: checked })}
        />
      </div>

      <div className="space-y-1 w-full">
        <label className="block text-xs text-gray-700 font-medium">
          Placeholder
        </label>
        <input
          type="text"
          value={field.placeholder ?? ""}
          onChange={(event) =>
            onUpdate({ placeholder: event.target.value || undefined })
          }
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Enter placeholder text"
        />
      </div>
    </FieldWrapper>
  );
}
