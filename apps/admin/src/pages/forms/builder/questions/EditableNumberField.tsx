import type { NumberField } from "@alliance/common/forms/form-schema";
import { InspectorGroup } from "../kit/InspectorGroup";
import { Input } from "../../../../ui/Input";
import { CheckboxField, Field } from "../../../../ui/templates/Form";
import { RequiredToggle } from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

const parseNumber = (raw: string) => (raw ? parseFloat(raw) : undefined);

export function EditableNumberField({
  field,
  onUpdate,
  previousFields,
  laterFields,
}: BaseFieldProps<NumberField>) {
  const decimals = field.allowDecimals ?? false;
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
          <Field label="Min">
            {(control) => (
              <Input
                {...control}
                type="number"
                value={field.min ?? ""}
                onChange={(event) =>
                  onUpdate({ min: parseNumber(event.target.value) })
                }
              />
            )}
          </Field>
          <Field label="Max">
            {(control) => (
              <Input
                {...control}
                type="number"
                value={field.max ?? ""}
                onChange={(event) =>
                  onUpdate({ max: parseNumber(event.target.value) })
                }
              />
            )}
          </Field>
        </div>
        <Field label="Step" help="Allowing decimals replaces the step.">
          {(control) => (
            <Input
              {...control}
              type="number"
              step="any"
              placeholder="1"
              disabled={decimals}
              value={field.step ?? ""}
              onChange={(event) =>
                onUpdate({ step: parseNumber(event.target.value) })
              }
            />
          )}
        </Field>
        <CheckboxField
          label="Allow decimals"
          checked={decimals}
          onChange={(event) =>
            onUpdate({
              allowDecimals: event.target.checked,
              decimalPlaces: event.target.checked
                ? (field.decimalPlaces ?? 2)
                : undefined,
              step: event.target.checked ? undefined : field.step,
            })
          }
        />
        <Field
          label="Decimal places"
          help={decimals ? undefined : "Applies once decimals are allowed."}
        >
          {(control) => (
            <Input
              {...control}
              type="number"
              min={1}
              max={10}
              disabled={!decimals}
              value={decimals ? (field.decimalPlaces ?? 2) : ""}
              onChange={(event) => {
                const places = parseInt(event.target.value, 10);
                onUpdate({
                  decimalPlaces: Number.isNaN(places)
                    ? 2
                    : Math.max(1, Math.min(10, places)),
                });
              }}
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
