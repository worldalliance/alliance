import type { TextareaField } from "@alliance/common/forms/form-schema";
import { InspectorGroup } from "../../pages/forms/builder/kit/InspectorGroup";
import { Input } from "../../ui/Input";
import { Field } from "../../ui/templates/Form";
import { RequiredToggle } from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

export function EditableTextareaField({
  field,
  onUpdate,
  previousFields,
  laterFields,
}: BaseFieldProps<TextareaField>) {
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rows">
            {(control) => (
              <Input
                {...control}
                type="number"
                min="1"
                max="20"
                value={field.rows || 3}
                onChange={(event) =>
                  onUpdate({ rows: parseInt(event.target.value) || 3 })
                }
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
        </div>
        <Field label="Placeholder">
          {(control) => (
            <Input
              {...control}
              value={field.placeholder ?? ""}
              onChange={(event) =>
                onUpdate({ placeholder: event.target.value || undefined })
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
