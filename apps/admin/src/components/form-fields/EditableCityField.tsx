import type { CityField } from "@alliance/common/forms/form-schema";
import { InspectorGroup } from "../../pages/forms/builder/kit/InspectorGroup";
import { Input } from "../../ui/Input";
import { Field } from "../../ui/templates/Form";
import { RequiredToggle } from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

export function EditableCityField({
  field,
  onUpdate,
  previousFields,
  laterFields,
}: BaseFieldProps<CityField>) {
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
              placeholder="Search for a city"
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
