import type { ImageField } from "@alliance/common/forms/form-schema";
import { InspectorGroup } from "../../pages/forms/builder/kit/InspectorGroup";
import { RequiredToggle } from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

export function EditableImageField({
  field,
  onUpdate,
  previousFields,
  laterFields,
}: BaseFieldProps<ImageField>) {
  return (
    <FieldWrapper
      field={field}
      onUpdate={onUpdate}
      previousFields={previousFields}
      laterFields={laterFields}
    >
      <InspectorGroup>
        <FieldLabelEditor
          label="Caption"
          placeholder="Upload photo"
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
