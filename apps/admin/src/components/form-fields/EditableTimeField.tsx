import type { TimeField } from "@alliance/common/forms/form-schema";
import { RequiredToggle } from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

export function EditableTimeField({
  field,
  onUpdate,
  previousFields,
  laterFields,
}: BaseFieldProps<TimeField>) {
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
      <p className="text-xs text-gray-500">
        Collects a time in 12-hour format (e.g. 7:30 PM).
      </p>
    </FieldWrapper>
  );
}
