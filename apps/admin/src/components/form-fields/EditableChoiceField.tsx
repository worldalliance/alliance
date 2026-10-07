import type { MultiSelectField } from "@alliance/common/forms/form-schema";
import type { ChoiceField } from "@alliance/common/forms/formula-options";
import { RequiredToggle } from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import { FixedOptionsEditor } from "./FixedOptionsEditor";
import { OptionsFormulaEditor } from "./OptionsFormulaEditor";
import { OptionsSourcePicker } from "./OptionsSourcePicker";
import type { BaseFieldProps } from "./types";

enum MultiSelectDisplay {
  Checkboxes = "checkboxes",
  Dropdown = "dropdown",
  SearchableDropdown = "searchable-dropdown",
}

const MULTISELECT_DISPLAYS: Record<
  MultiSelectDisplay,
  { label: string; flags: Pick<MultiSelectField, "dropdown" | "searchable"> }
> = {
  [MultiSelectDisplay.Checkboxes]: {
    label: "Checkboxes",
    flags: { dropdown: undefined, searchable: undefined },
  },
  [MultiSelectDisplay.Dropdown]: {
    label: "Dropdown",
    flags: { dropdown: true, searchable: undefined },
  },
  [MultiSelectDisplay.SearchableDropdown]: {
    label: "Searchable dropdown",
    flags: { dropdown: true, searchable: true },
  },
};

function multiSelectDisplay(field: MultiSelectField): MultiSelectDisplay {
  if (!field.dropdown) return MultiSelectDisplay.Checkboxes;
  return field.searchable
    ? MultiSelectDisplay.SearchableDropdown
    : MultiSelectDisplay.Dropdown;
}

type EditableChoiceFieldProps = BaseFieldProps<ChoiceField>;

export function EditableChoiceField({
  field,
  onUpdate,
  onRemove,
  previousFields,
  laterFields,
}: EditableChoiceFieldProps) {
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

      {(field.kind === "multiselect" || field.kind === "select") && (
        <RequiredToggle
          label="Randomize options"
          checked={!!field.randomizeOptions}
          onChange={(checked) => onUpdate({ randomizeOptions: checked })}
        />
      )}

      {field.kind === "select" && (
        <RequiredToggle
          label="Dropdown with search"
          checked={!!field.searchable}
          onChange={(checked) => onUpdate({ searchable: checked })}
        />
      )}

      {field.kind === "multiselect" && (
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">
            Display
            <select
              value={multiSelectDisplay(field)}
              onChange={(event) => {
                const display = Object.values(MultiSelectDisplay).find(
                  (value) => value === event.target.value,
                );
                if (!display) {
                  throw new Error(`unknown display: ${event.target.value}`);
                }
                onUpdate(MULTISELECT_DISPLAYS[display].flags);
              }}
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm font-normal focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {Object.entries(MULTISELECT_DISPLAYS).map(
                ([value, { label }]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
      )}

      {field.kind === "multiselect" && (
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">
            Max selections (optional)
          </label>
          <input
            type="number"
            min={1}
            value={field.maxSelections ?? ""}
            onChange={(event) => {
              const raw = event.target.value;
              if (!raw) {
                onUpdate({ maxSelections: undefined });
                return;
              }
              const parsed = Number(raw);
              if (Number.isNaN(parsed) || parsed < 1) {
                onUpdate({ maxSelections: undefined });
                return;
              }
              onUpdate({ maxSelections: Math.floor(parsed) });
            }}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="No limit"
          />
        </div>
      )}

      <OptionsSourcePicker field={field} onUpdate={onUpdate} />

      {field.optionsFormula !== undefined ? (
        <OptionsFormulaEditor
          fieldId={field.id}
          formula={field.optionsFormula}
          onChange={(optionsFormula) => onUpdate({ optionsFormula })}
        />
      ) : (
        <FixedOptionsEditor field={field} onUpdate={onUpdate} />
      )}
    </FieldWrapper>
  );
}
