import type { TimezoneField } from "@alliance/common/forms/form-schema";
import { RequiredToggle } from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

export function EditableTimezoneField({
  field,
  onUpdate,
  onRemove,
  previousFields,
  laterFields,
}: BaseFieldProps<TimezoneField>) {
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

      <RequiredToggle
        checked={field.required}
        onChange={(checked) => onUpdate({ required: checked })}
      />
    </FieldWrapper>
  );
}
