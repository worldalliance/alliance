import type { TimePickerField } from "@alliance/common/forms/form-schema";
import { InspectorGroup } from "../kit/InspectorGroup";
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
      <InspectorGroup>
        <FieldLabelEditor
          value={field.label}
          onChange={(label) => onUpdate({ label })}
        />
        <RequiredToggle
          checked={field.required}
          onChange={(required) => onUpdate({ required })}
        />
        <p className="text-caption text-fg-muted">
          Hour, minute and AM/PM wheels. Starts at 9:00 AM, which is saved
          unless the member turns a wheel.
        </p>
      </InspectorGroup>
    </FieldWrapper>
  );
}
