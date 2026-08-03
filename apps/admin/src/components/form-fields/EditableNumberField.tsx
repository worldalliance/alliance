import {
  NUMBER_FIELD_CONTROLS,
  NUMBER_VALUE_TEMPLATE_TOKEN,
  numberFieldControl,
  type NumberField,
  type NumberFieldControl,
} from "@alliance/common/forms/form-schema";
import { RequiredToggle } from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

const CONTROL_LABELS: Record<NumberFieldControl, string> = {
  input: "Number input",
  slider: "Slider",
};

const SLIDER_DEFAULT_MIN = 0;
const SLIDER_DEFAULT_MAX = 100;

export function EditableNumberField({
  field,
  onUpdate,
  onRemove,
  onDragStart,
  onDragEnd,
  isDragging,
  previousFields,
}: BaseFieldProps<NumberField>) {
  const control = numberFieldControl(field);
  const isSlider = control === "slider";
  const boundsLabelSuffix = isSlider ? " (required)" : "";

  return (
    <FieldWrapper
      field={field}
      onUpdate={onUpdate}
      previousFields={previousFields}
      onRemove={onRemove}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      isDragging={isDragging}
    >
      <FieldLabelEditor
        value={field.label}
        onChange={(v) => onUpdate({ label: v })}
      />

      <RequiredToggle
        checked={field.required}
        onChange={(checked) => onUpdate({ required: checked })}
      />

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Display as
        </label>
        <select
          value={control}
          onChange={(event) => {
            const next =
              NUMBER_FIELD_CONTROLS.find((c) => c === event.target.value) ??
              "input";
            onUpdate({
              control: next === "input" ? undefined : next,
              // A slider can't be drawn without bounds, and the schema
              // validator rejects it — seed them rather than fail on save.
              ...(next === "slider" && {
                min: field.min ?? SLIDER_DEFAULT_MIN,
                max: field.max ?? SLIDER_DEFAULT_MAX,
              }),
            });
          }}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {NUMBER_FIELD_CONTROLS.map((option) => (
            <option key={option} value={option}>
              {CONTROL_LABELS[option]}
            </option>
          ))}
        </select>
      </div>

      {isSlider && (
        <div>
          <label className="block text-xs text-gray-700 mb-1">
            Value display template
          </label>
          <input
            type="text"
            value={field.valueTemplate ?? ""}
            onChange={(e) =>
              onUpdate({ valueTemplate: e.target.value || undefined })
            }
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder={NUMBER_VALUE_TEMPLATE_TOKEN}
          />
          <p className="mt-1 text-xs text-gray-500">
            {NUMBER_VALUE_TEMPLATE_TOKEN} stands in for the number — e.g.{" "}
            <code>{`${NUMBER_VALUE_TEMPLATE_TOKEN}%`}</code> shows 50 as{" "}
            <code>50%</code>. Leave blank for just the number.
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs text-gray-700 mb-1">
            Min Value{boundsLabelSuffix}
          </label>
          <input
            type="number"
            value={field.min ?? ""}
            onChange={(e) =>
              onUpdate({
                min: e.target.value ? parseFloat(e.target.value) : undefined,
              })
            }
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Min"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-700 mb-1">
            Max Value{boundsLabelSuffix}
          </label>
          <input
            type="number"
            value={field.max ?? ""}
            onChange={(e) =>
              onUpdate({
                max: e.target.value ? parseFloat(e.target.value) : undefined,
              })
            }
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Max"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-700 mb-1">Step</label>
          <input
            type="number"
            value={field.step ?? ""}
            onChange={(e) =>
              onUpdate({
                step: e.target.value ? parseFloat(e.target.value) : undefined,
              })
            }
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="1"
            step="any"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-1">
        <input
          type="checkbox"
          id={`${field.id}-allow-decimals`}
          checked={field.allowDecimals ?? false}
          onChange={(e) =>
            onUpdate({
              allowDecimals: e.target.checked,
              decimalPlaces: e.target.checked
                ? (field.decimalPlaces ?? 2)
                : undefined,
              step: e.target.checked ? undefined : field.step,
            })
          }
          className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label
          htmlFor={`${field.id}-allow-decimals`}
          className="text-xs text-gray-700"
        >
          Allow decimals
        </label>
      </div>

      {field.allowDecimals && (
        <div className="mt-1">
          <label className="block text-xs text-gray-700 mb-1">
            Decimal places
          </label>
          <input
            type="number"
            value={field.decimalPlaces ?? 2}
            min={1}
            max={10}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              onUpdate({
                decimalPlaces: Number.isNaN(val)
                  ? 2
                  : Math.max(1, Math.min(10, val)),
              });
            }}
            className="w-24 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}
    </FieldWrapper>
  );
}
