import type { MultiSelectField } from "@alliance/common/forms/form-schema";
import type { ChoiceField } from "@alliance/common/forms/formula-options";
import { InspectorGroup } from "../kit/InspectorGroup";
import { Input } from "../../../../ui/Input";
import { Select } from "../../../../ui/Select";
import { CheckboxField, Field } from "../../../../ui/templates/Form";
import { RequiredToggle } from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import { FixedOptionsEditor } from "./FixedOptionsEditor";
import { OptionCategoriesEditor } from "./OptionCategoriesEditor";
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
  previousFields,
  laterFields,
}: EditableChoiceFieldProps) {
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
          onChange={(v) => onUpdate({ label: v })}
        />
        <RequiredToggle
          checked={field.required}
          onChange={(checked) => onUpdate({ required: checked })}
        />
        <CheckboxField
          label="Randomize options"
          checked={!!field.randomizeOptions}
          onChange={(event) =>
            onUpdate({ randomizeOptions: event.target.checked })
          }
        />
        {field.kind === "select" && (
          <CheckboxField
            label="Dropdown with search"
            checked={!!field.searchable}
            onChange={(event) => onUpdate({ searchable: event.target.checked })}
          />
        )}
        {field.kind === "multiselect" && (
          <MultiSelectSettings field={field} onUpdate={onUpdate} />
        )}
        <OptionsSourcePicker field={field} onUpdate={onUpdate} />
      </InspectorGroup>

      {field.optionsFormula === undefined && (
        <OptionCategoriesEditor
          categories={field.categories ?? []}
          options={field.options}
          onUpdate={onUpdate}
        />
      )}

      <InspectorGroup title="Options">
        {field.optionsFormula !== undefined ? (
          <OptionsFormulaEditor
            fieldId={field.id}
            formula={field.optionsFormula}
            onChange={(optionsFormula) => onUpdate({ optionsFormula })}
          />
        ) : (
          <FixedOptionsEditor field={field} onUpdate={onUpdate} />
        )}
      </InspectorGroup>
    </FieldWrapper>
  );
}

function MultiSelectSettings({
  field,
  onUpdate,
}: {
  field: MultiSelectField;
  onUpdate: (updates: Partial<MultiSelectField>) => void;
}) {
  return (
    <>
      <Field label="Display">
        {(control) => (
          <Select
            {...control}
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
          >
            {Object.entries(MULTISELECT_DISPLAYS).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Max selections" mark="optional">
        {(control) => (
          <Input
            {...control}
            type="number"
            min={1}
            value={field.maxSelections ?? ""}
            placeholder="No limit"
            onChange={(event) => {
              const parsed = Number(event.target.value);
              onUpdate({
                maxSelections:
                  event.target.value && !Number.isNaN(parsed) && parsed >= 1
                    ? Math.floor(parsed)
                    : undefined,
              });
            }}
          />
        )}
      </Field>
    </>
  );
}
