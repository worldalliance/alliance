import { fieldPickerLabel } from "@alliance/common/forms/element-descriptors";
import type { ToggleField } from "@alliance/common/forms/form-schema";
import { Select } from "../../../../ui/Select";
import { Field } from "../../../../ui/templates/Form";
import { InspectorGroup } from "../kit/InspectorGroup";
import { RequiredToggle } from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

export function EditableToggleField({
  field,
  onUpdate,
  previousFields,
  laterFields,
}: BaseFieldProps<ToggleField>) {
  const otherToggles = [
    ...(previousFields ?? []),
    ...(laterFields ?? []),
  ].filter((other) => other.kind === "toggle");
  const partnerMissing =
    field.atLeastOneOnWith !== undefined &&
    !otherToggles.some((other) => other.id === field.atLeastOneOnWith);

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
          label="On by default"
          checked={field.defaultValue === true}
          onChange={(checked) =>
            onUpdate({ defaultValue: checked ? true : null })
          }
        />
        <Field label="Keep at least one on with">
          {(control) => (
            <Select
              {...control}
              value={field.atLeastOneOnWith ?? ""}
              onChange={(event) =>
                onUpdate({ atLeastOneOnWith: event.target.value || undefined })
              }
            >
              <option value="">No other toggle</option>
              {partnerMissing ? (
                <option value={field.atLeastOneOnWith}>Removed toggle</option>
              ) : null}
              {otherToggles.map((other) => (
                <option key={other.id} value={other.id}>
                  {fieldPickerLabel(other)}
                </option>
              ))}
            </Select>
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
