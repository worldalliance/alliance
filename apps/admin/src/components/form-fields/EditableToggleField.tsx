import { fieldPickerLabel } from "@alliance/common/forms/element-descriptors";
import type { ToggleField } from "@alliance/common/forms/form-schema";
import { RequiredToggle } from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

export function EditableToggleField({
  field,
  onUpdate,
  previousFields,
  laterFields,
}: BaseFieldProps<ToggleField>) {
  const otherToggles = [
    ...(previousFields ?? []),
    ...(laterFields ?? []),
  ].filter((other) => other.kind === "toggle");
  const partnerMissing =
    field.atLeastOneOnWith !== undefined &&
    !otherToggles.some((other) => other.id === field.atLeastOneOnWith);

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
      <RequiredToggle
        checked={field.required}
        onChange={(checked) => onUpdate({ required: checked })}
      />
      <RequiredToggle
        label="On by default"
        checked={field.defaultValue === true}
        onChange={(checked) =>
          onUpdate({ defaultValue: checked ? true : null })
        }
      />
      <label className="block text-xs font-medium text-gray-700">
        Keep at least one on with
        <select
          value={field.atLeastOneOnWith ?? ""}
          onChange={(event) =>
            onUpdate({ atLeastOneOnWith: event.target.value || undefined })
          }
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm font-normal focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">No other toggle</option>
          {partnerMissing ? (
            <option value={field.atLeastOneOnWith}>Removed toggle</option>
          ) : null}
          {otherToggles.map((other) => (
            <option key={other.id} value={other.id}>
              {fieldPickerLabel(other)}
            </option>
          ))}
        </select>
      </label>
    </FieldWrapper>
  );
}
