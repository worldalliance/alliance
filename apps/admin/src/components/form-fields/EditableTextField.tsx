import type { TextField } from "@alliance/common/forms/form-schema";
import { RequiredToggle } from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

export function EditableTextField({
  field,
  onUpdate,
  previousFields,
  laterFields,
}: BaseFieldProps<TextField>) {
  return (
    <FieldWrapper
      field={field}
      onUpdate={onUpdate}
      previousFields={previousFields}
      laterFields={laterFields}
    >
      <FieldLabelEditor
        value={field.label}
        onChange={(v) => onUpdate({ label: v })}
      />

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Placeholder Text
        </label>
        <input
          type="text"
          value={field.placeholder || ""}
          onChange={(e) => onUpdate({ placeholder: e.target.value })}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Enter placeholder text"
        />
      </div>

      <div className="flex items-center space-x-4">
        <RequiredToggle
          checked={field.required}
          onChange={(checked) => onUpdate({ required: checked })}
        />

        <div className="flex items-center space-x-2">
          <label className="text-xs text-gray-700">Max Length:</label>
          <input
            type="number"
            value={field.maxLength || ""}
            onChange={(e) =>
              onUpdate({
                maxLength: e.target.value
                  ? parseInt(e.target.value)
                  : undefined,
              })
            }
            className="w-16 px-1 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            min="0"
          />
        </div>
      </div>
    </FieldWrapper>
  );
}
