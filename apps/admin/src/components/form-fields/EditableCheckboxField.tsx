import type { CheckboxField } from "@alliance/common/forms/form-schema";
import { RequiredToggle } from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

export function EditableCheckboxField({
  field,
  onUpdate,
  onRemove,
  previousFields,
  laterFields,
}: BaseFieldProps<CheckboxField>) {
  return (
    <FieldWrapper
      field={field}
      onUpdate={onUpdate}
      previousFields={previousFields}
      laterFields={laterFields}
      onRemove={onRemove}
    >
      <FieldLabelEditor
        label="Checkbox Label"
        value={field.label}
        onChange={(v) => onUpdate({ label: v })}
        placeholder="Enter checkbox label"
      />

      <RequiredToggle
        checked={field.required}
        onChange={(checked) => onUpdate({ required: checked })}
      />

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Checkbox position
        </label>
        <select
          value={field.checkboxPosition ?? "left"}
          onChange={(event) => {
            const position = event.target.value === "right" ? "right" : "left";
            onUpdate({
              checkboxPosition: position === "left" ? undefined : position,
            });
          }}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="left">Left of text</option>
          <option value="right">Right of text</option>
        </select>
      </div>

      <RequiredToggle
        label="Checked by default"
        checked={field.defaultValue === true}
        onChange={(checked) =>
          onUpdate({ defaultValue: checked ? true : null })
        }
      />
    </FieldWrapper>
  );
}
