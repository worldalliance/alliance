import type { NumberField } from "@alliance/common/forms/form-schema";
import { RequiredToggle } from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

export function EditableNumberField({
  field,
  onUpdate,
  onRemove,
  previousFields,
  laterFields,
}: BaseFieldProps<NumberField>) {
  return (
    <FieldWrapper
      field={field}
      onUpdate={onUpdate}
      previousFields={previousFields}
      laterFields={laterFields}
      onRemove={onRemove}
    >
      <FieldLabelEditor
        value={field.label}
        onChange={(v) => onUpdate({ label: v })}
      />

      <RequiredToggle
        checked={field.required}
        onChange={(checked) => onUpdate({ required: checked })}
      />

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs text-gray-700 mb-1">Min Value</label>
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
          <label className="block text-xs text-gray-700 mb-1">Max Value</label>
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
