import type { CheckboxField } from "@alliance/common/forms/form-schema";
import { InspectorGroup } from "../kit/InspectorGroup";
import { Select } from "../../../../ui/Select";
import { Field } from "../../../../ui/templates/Form";
import { RequiredToggle } from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

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
        <Field label="Checkbox position">
          {(control) => (
            <Select
              {...control}
              value={field.checkboxPosition ?? "left"}
              onChange={(event) =>
                onUpdate({
                  checkboxPosition:
                    event.target.value === "right" ? "right" : undefined,
                })
              }
            >
              <option value="left">Left of the text</option>
              <option value="right">Right of the text</option>
            </Select>
          )}
        </Field>
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
