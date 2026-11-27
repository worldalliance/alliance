import type { CheckboxField } from "@alliance/common/forms/form-schema";
import { RadioGroupField } from "../../../../ui/templates/Form";
import { InspectorGroup } from "../kit/InspectorGroup";
import { RequiredToggle } from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

const POSITIONS = [
  { value: "left", label: "Left of the text" },
  { value: "right", label: "Right of the text" },
] as const;

export function EditableCheckboxField({
  field,
  onUpdate,
  previousFields,
  laterFields,
}: BaseFieldProps<CheckboxField>) {
  return (
    <FieldWrapper
      field={field}
      onUpdate={onUpdate}
      previousFields={previousFields}
      laterFields={laterFields}
    >
      <InspectorGroup>
        <FieldLabelEditor
          label="Checkbox label"
          value={field.label}
          onChange={(label) => onUpdate({ label })}
          placeholder="Enter checkbox label"
        />
        <RadioGroupField
          label="Checkbox position"
          choices={POSITIONS}
          value={field.checkboxPosition ?? "left"}
          onChange={(position) =>
            onUpdate({
              checkboxPosition: position === "right" ? "right" : undefined,
            })
          }
        />
        <RequiredToggle
          label="Checked by default"
          checked={field.defaultValue === true}
          onChange={(checked) =>
            onUpdate({ defaultValue: checked ? true : null })
          }
        />
        <RequiredToggle
          checked={field.required}
          onChange={(required) => onUpdate({ required })}
        />
      </InspectorGroup>
    </FieldWrapper>
  );
}
