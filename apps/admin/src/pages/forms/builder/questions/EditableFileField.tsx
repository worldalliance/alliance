import type { FileField } from "@alliance/common/forms/form-schema";
import { InspectorGroup } from "../kit/InspectorGroup";
import { RequiredToggle } from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

export function EditableFileField({
  field,
  onUpdate,
  previousFields,
  laterFields,
}: BaseFieldProps<FileField>) {
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
      </InspectorGroup>
    </FieldWrapper>
  );
}
