import {
  MAX_RANGE_OPTION_COUNT,
  MIN_RANGE_OPTION_COUNT,
  type RangeField,
} from "@alliance/common/forms/form-schema";
import { getRangeValues } from "@alliance/common/forms/range";
import { InspectorGroup } from "../../pages/forms/builder/kit/InspectorGroup";
import { Input } from "../../ui/Input";
import { Select } from "../../ui/Select";
import { Field } from "../../ui/templates/Form";
import { RequiredToggle } from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

export function EditableRangeField({
  field,
  onUpdate,
  previousFields,
  laterFields,
}: BaseFieldProps<RangeField>) {
  const defaultValue =
    typeof field.defaultValue === "number" ? field.defaultValue : "";
  const values = getRangeValues(field);
  const defaultOutsideScale =
    typeof defaultValue === "number" && !values.includes(defaultValue);

  const handleOptionCountChange = (raw: string) => {
    if (!raw) {
      onUpdate({ optionCount: undefined });
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return;
    }
    onUpdate({ optionCount: parsed });
  };

  const handleDefaultValueChange = (raw: string) => {
    if (!raw) {
      onUpdate({ defaultValue: undefined });
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return;
    }
    onUpdate({ defaultValue: parsed });
  };

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
        <Field
          label="Number of options"
          help={`From ${MIN_RANGE_OPTION_COUNT} to ${MAX_RANGE_OPTION_COUNT}.`}
        >
          {(control) => (
            <Input
              {...control}
              type="number"
              min={MIN_RANGE_OPTION_COUNT}
              max={MAX_RANGE_OPTION_COUNT}
              value={field.optionCount ?? ""}
              onChange={(event) => handleOptionCountChange(event.target.value)}
            />
          )}
        </Field>
        <Field label="Default selection" mark="optional">
          {(control) => (
            <Select
              {...control}
              value={defaultValue}
              onChange={(event) => handleDefaultValueChange(event.target.value)}
            >
              <option value="">None</option>
              {defaultOutsideScale && (
                <option value={defaultValue}>
                  {defaultValue} (outside the scale)
                </option>
              )}
              {values.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start label" mark="optional">
            {(control) => (
              <Input
                {...control}
                value={field.startLabel ?? ""}
                onChange={(event) =>
                  onUpdate({ startLabel: event.target.value })
                }
                placeholder="Not likely"
              />
            )}
          </Field>
          <Field label="End label" mark="optional">
            {(control) => (
              <Input
                {...control}
                value={field.endLabel ?? ""}
                onChange={(event) => onUpdate({ endLabel: event.target.value })}
                placeholder="Most likely"
              />
            )}
          </Field>
        </div>
        <RequiredToggle
          checked={field.required}
          onChange={(required) => onUpdate({ required })}
        />
      </InspectorGroup>
    </FieldWrapper>
  );
}
