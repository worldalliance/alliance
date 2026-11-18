import type { TimePickerField } from "@alliance/common/forms/form-schema";
import { RequiredToggle } from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

export function EditableTimePickerField({
  field,
  onUpdate,
  previousFields,
  laterFields,
}: BaseFieldProps<TimePickerField>) {
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
        Hour, minute and AM/PM wheels. Starts at 9:00 AM, which is saved unless
        the member turns a wheel.
      </p>
    </FieldWrapper>
  );
}
