import type {
  MultiSelectField,
  SelectField,
} from "@alliance/common/forms/form-schema";
import { cn } from "@alliance/shared/styles/util";
import { VariableTextField } from "../VariableTextField";
import {
  DuplicateOptionsWarning,
  RequiredToggle,
  duplicateOptionValues,
} from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

type ChoiceField = SelectField | MultiSelectField;

type EditableChoiceFieldProps = BaseFieldProps<ChoiceField>;

export function EditableChoiceField({
  field,
  onUpdate,
  onRemove,
  onDragStart,
  onDragEnd,
  isDragging,
  previousFields,
}: EditableChoiceFieldProps) {
  const duplicates = duplicateOptionValues(field.options || []);

  const addOption = () => {
    const nextIndex = (field.options?.length || 0) + 1;
    const newOption = {
      label: `Option ${nextIndex}`,
      value: `option${nextIndex}`,
    };
    onUpdate({
      options: [...(field.options || []), newOption],
    });
  };

  const updateOption = (
    index: number,
    updates: { label?: string; value?: string },
  ) => {
    const previousOptions = field.options || [];
    const previousValue = previousOptions[index]?.value;
    const updatedOptions = [...previousOptions];
    updatedOptions[index] = { ...updatedOptions[index], ...updates };
    const nextUpdates: Partial<ChoiceField> = { options: updatedOptions };
    if (
      field.kind === "select" &&
      updates.value !== undefined &&
      previousValue === field.defaultValue &&
      updates.value !== field.defaultValue
    ) {
      nextUpdates.defaultValue =
        updates.value && updates.value.length > 0 ? updates.value : null;
    }
    if (
      field.kind === "multiselect" &&
      updates.value !== undefined &&
      previousValue
    ) {
      const defaults: string[] =
        Array.isArray(field.defaultValue) &&
        field.defaultValue.every((value) => typeof value === "string")
          ? field.defaultValue.slice()
          : [];
      if (defaults.includes(previousValue)) {
        const filtered = defaults.filter((value) => value !== previousValue);
        if (updates.value && updates.value.length > 0) {
          filtered.push(updates.value);
        }
        nextUpdates.defaultValue = filtered.length > 0 ? filtered : null;
      }
    }
    onUpdate(nextUpdates);
  };

  const removeOption = (index: number) => {
    const updatedOptions = field.options?.filter((_, i) => i !== index) || [];
    const updates: Partial<ChoiceField> = { options: updatedOptions };
    const removedValue = field.options?.[index]?.value;
    if (
      field.kind === "select" &&
      field.defaultValue &&
      field.options?.[index]?.value === field.defaultValue
    ) {
      updates.defaultValue = null;
    }
    if (
      field.kind === "multiselect" &&
      removedValue &&
      Array.isArray(field.defaultValue) &&
      field.defaultValue.every((value) => typeof value === "string") &&
      field.defaultValue.includes(removedValue as string)
    ) {
      const filtered = field.defaultValue.filter(
        (value) => value !== removedValue,
      );
      updates.defaultValue = filtered.length > 0 ? filtered : null;
    }
    onUpdate(updates);
  };

  const moveOption = (from: number, to: number) => {
    if (!field.options) return;
    if (to < 0 || to >= field.options.length) return;
    const updated = [...field.options];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    onUpdate({ options: updated });
  };

  const setDefaultValue = (value?: string) => {
    if (field.kind !== "select") {
      return;
    }
    onUpdate({ defaultValue: value ?? null });
  };

  const toggleMultiDefault = (value: string, checked: boolean) => {
    if (field.kind !== "multiselect") {
      return;
    }
    const defaults = new Set(
      Array.isArray(field.defaultValue) &&
        field.defaultValue.every((value) => typeof value === "string")
        ? field.defaultValue
        : [],
    );
    if (checked) {
      defaults.add(value);
    } else {
      defaults.delete(value);
    }
    const next = Array.from(defaults);
    onUpdate({ defaultValue: next.length > 0 ? next : null });
  };

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

      {(field.kind === "multiselect" || field.kind === "select") && (
        <RequiredToggle
          label="Randomize options"
          checked={!!field.randomizeOptions}
          onChange={(checked) => onUpdate({ randomizeOptions: checked })}
        />
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

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-medium text-gray-700">
            Options
          </label>
          <button
            onClick={addOption}
            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            type="button"
          >
            Add Option
          </button>
        </div>
        <div className="space-y-2 overflow-y-auto py-1">
          {field.options?.map((option, index) => (
            <div key={index} className="flex items-center space-x-2">
              {field.kind === "select" && (
                <label className="flex items-center space-x-1 text-xs text-gray-600">
                  <input
                    type="radio"
                    name={`${field.id}-default`}
                    checked={field.defaultValue === option.value}
                    onChange={() => setDefaultValue(option.value)}
                    className="h-3 w-3 text-blue-500 focus:ring-blue-500"
                  />
                  <span>Default</span>
                </label>
              )}
              {field.kind === "multiselect" && (
                <label className="flex items-center space-x-1 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={
                      Array.isArray(field.defaultValue) &&
                      field.defaultValue.every(
                        (value) => typeof value === "string",
                      ) &&
                      field.defaultValue.includes(option.value)
                    }
                    onChange={(event) =>
                      toggleMultiDefault(option.value, event.target.checked)
                    }
                    className="h-3 w-3 text-blue-500 focus:ring-blue-500"
                  />
                  <span>Default</span>
                </label>
              )}
              <VariableTextField
                value={option.label}
                onChange={(label) => updateOption(index, { label })}
                containerClassName="flex-1"
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Option label"
              />
              <input
                type="text"
                value={option.value}
                onChange={(e) => updateOption(index, { value: e.target.value })}
                className={cn(
                  "w-20 px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500",
                  duplicates.has(option.value)
                    ? "border-red-500"
                    : "border-gray-300",
                )}
                placeholder="Value"
              />
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => moveOption(index, index - 1)}
                  disabled={index === 0}
                  className="px-1 py-0.5 text-xs rounded border border-gray-300 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                  aria-label="Move option up"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveOption(index, index + 1)}
                  disabled={index === (field.options?.length || 0) - 1}
                  className="px-1 py-0.5 text-xs rounded border border-gray-300 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                  aria-label="Move option down"
                  title="Move down"
                >
                  ↓
                </button>
              </div>
              <button
                onClick={() => removeOption(index)}
                className="text-red-500 hover:text-red-700 text-sm"
                type="button"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <DuplicateOptionsWarning duplicates={duplicates} />
        {field.kind === "select" && (
          <div className="flex items-center justify-end mt-2">
            <button
              type="button"
              onClick={() => setDefaultValue(undefined)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear default
            </button>
          </div>
        )}
        {field.kind === "multiselect" && (
          <div className="flex items-center justify-end mt-2">
            <button
              type="button"
              onClick={() => onUpdate({ defaultValue: null })}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear defaults
            </button>
          </div>
        )}
      </div>
    </FieldWrapper>
  );
}
