import type { TimeField } from "@alliance/common/forms/form-schema";
import { InspectorGroup } from "../../pages/forms/builder/kit/InspectorGroup";
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
          Collects a time in 12-hour format (e.g. 7:30 PM).
        </p>
      </InspectorGroup>
    </FieldWrapper>
  );
}
