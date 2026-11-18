import type { ImageField } from "@alliance/common/forms/form-schema";
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
      <FieldLabelEditor
        label="Caption"
        value={field.label}
        onChange={(v) => onUpdate({ label: v })}
        placeholder="Upload photo"
      />
      <RequiredToggle
        checked={field.required}
        onChange={(checked) => onUpdate({ required: checked })}
      />
    </FieldWrapper>
  );
}
