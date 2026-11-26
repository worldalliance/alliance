import type { TextField } from "@alliance/common/forms/form-schema";
import { InspectorGroup } from "../kit/InspectorGroup";
import { Input } from "../../../../ui/Input";
import { Field } from "../../../../ui/templates/Form";
import { RequiredToggle } from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

export function EditableTextField({
  field,
  onUpdate,
  previousFields,
  laterFields,
}: BaseFieldProps<TextField>) {
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
        <Field label="Placeholder">
          {(control) => (
            <Input
              {...control}
              value={field.placeholder || ""}
              onChange={(event) =>
                onUpdate({ placeholder: event.target.value })
              }
              placeholder="Enter placeholder text"
            />
          )}
        </Field>
        <Field label="Max length">
          {(control) => (
            <Input
              {...control}
              type="number"
              min="0"
              value={field.maxLength || ""}
              onChange={(event) =>
                onUpdate({
                  maxLength: event.target.value
                    ? parseInt(event.target.value)
                    : undefined,
                })
              }
            />
          )}
        </Field>
        <RequiredToggle
          checked={field.required}
          onChange={(required) => onUpdate({ required })}
        />
      </InspectorGroup>
    </FieldWrapper>
  );
}
