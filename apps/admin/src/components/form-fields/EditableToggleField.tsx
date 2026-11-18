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
    </FieldWrapper>
  );
}
