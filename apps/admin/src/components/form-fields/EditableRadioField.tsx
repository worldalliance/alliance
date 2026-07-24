import type { RadioField } from "@alliance/common/forms/form-schema";
import { cn } from "@alliance/shared/styles/util";
import {
  DuplicateOptionsWarning,
  RequiredToggle,
  duplicateOptionValues,
} from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

export function EditableRadioField({
  field,
  onUpdate,
  onRemove,
  onDragStart,
  onDragEnd,
  isDragging,
  previousFields,
}: BaseFieldProps<RadioField>) {
  const duplicates = duplicateOptionValues(field.options || []);

  const addOption = () => {
    const newOption = {
      label: `Option ${(field.options?.length || 0) + 1}`,
      value: `option${(field.options?.length || 0) + 1}`,
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
    const nextUpdates: Partial<RadioField> = { options: updatedOptions };
    if (
      updates.value !== undefined &&
      previousValue === field.defaultValue &&
      updates.value !== field.defaultValue
    ) {
      nextUpdates.defaultValue =
        updates.value && updates.value.length > 0 ? updates.value : null;
    }
    onUpdate(nextUpdates);
  };

  const removeOption = (index: number) => {
    const updatedOptions = field.options?.filter((_, i) => i !== index) || [];
    const removedOption = field.options?.[index];
    const updates: Partial<RadioField> = { options: updatedOptions };
    if (removedOption?.value && removedOption.value === field.defaultValue) {
      updates.defaultValue = null;
    }
    onUpdate(updates);
  };

  const setDefaultValue = (value?: string) => {
    onUpdate({ defaultValue: value ?? null });
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

      <RequiredToggle
        label="Randomize options"
        checked={!!field.randomizeOptions}
        onChange={(checked) => onUpdate({ randomizeOptions: checked })}
      />

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
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {field.options?.map((option, index) => (
            <div key={index} className="flex items-center space-x-2">
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
              <input
                type="text"
                value={option.label}
                onChange={(e) => updateOption(index, { label: e.target.value })}
                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
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
        <div className="flex items-center justify-end mt-2">
          <button
            type="button"
            onClick={() => setDefaultValue(undefined)}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Clear default
          </button>
        </div>
      </div>
    </FieldWrapper>
  );
}
