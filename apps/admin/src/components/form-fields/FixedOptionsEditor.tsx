import type { ChoiceField } from "@alliance/common/forms/formula-options";
import { optionSectionId } from "@alliance/shared/forms/optionSections";
import { cn } from "@alliance/shared/styles/util";
import { useRef } from "react";
import { VariableTextField } from "../VariableTextField";
import {
  DuplicateOptionsWarning,
  duplicateOptionValues,
} from "./CommonControls";
import {
  categoryLabel,
  OptionCategoriesEditor,
  withCategory,
} from "./OptionCategoriesEditor";

export function FixedOptionsEditor({
  field,
  onUpdate,
}: {
  field: ChoiceField;
  onUpdate: (updates: Partial<ChoiceField>) => void;
}) {
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

  const categories = field.categories ?? [];
  const options = field.options ?? [];
  const categoryIds = new Set(categories.map((category) => category.id));
  const sections = [null, ...categories]
    .map((category) => ({
      category,
      indices: options.flatMap((option, index) =>
        optionSectionId(option, categoryIds) === category?.id ? [index] : [],
      ),
    }))
    .filter(({ category, indices }) => category || indices.length > 0);

  // Picking a category remounts the row in another section, dropping focus.
  const refocusCategoryOf = useRef<number | null>(null);
  const assignCategory = (index: number, category?: string) => {
    refocusCategoryOf.current = index;
    onUpdate({
      options: options.map((option, i) =>
        i === index ? withCategory(option, category) : option,
      ),
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
    const updated = [...options];
    [updated[from], updated[to]] = [updated[to], updated[from]];
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
    <>
      <OptionCategoriesEditor
        categories={categories}
        options={options}
        onUpdate={onUpdate}
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
        <div className="space-y-2 overflow-y-auto py-1">
          {sections.map(({ category, indices }) => (
            <div
              key={category?.id ?? ""}
              role={categories.length > 0 ? "group" : undefined}
              aria-label={
                categories.length > 0
                  ? category
                    ? `Options in ${categoryLabel(category)}`
                    : "Options without a category"
                  : undefined
              }
              className="space-y-2"
            >
              {categories.length > 0 && (
                <p className="pt-1 text-xs font-semibold text-gray-600">
                  {category ? categoryLabel(category) : "No category"}
                </p>
              )}
              {category && indices.length === 0 && (
                <p className="text-xs text-gray-400">No options</p>
              )}
              {indices.map((index, position) => {
                const option = options[index];
                return (
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
                            toggleMultiDefault(
                              option.value,
                              event.target.checked,
                            )
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
                      onChange={(e) =>
                        updateOption(index, { value: e.target.value })
                      }
                      className={cn(
                        "w-20 px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500",
                        duplicates.has(option.value)
                          ? "border-red-500"
                          : "border-gray-300",
                      )}
                      placeholder="Value"
                    />
                    {categories.length > 0 && (
                      <select
                        aria-label="Category"
                        ref={(select) => {
                          if (select && refocusCategoryOf.current === index) {
                            refocusCategoryOf.current = null;
                            select.focus();
                          }
                        }}
                        value={option.category ?? ""}
                        onChange={(event) =>
                          assignCategory(index, event.target.value || undefined)
                        }
                        className="w-28 px-1 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">No category</option>
                        {option.category !== undefined &&
                          !categoryIds.has(option.category) && (
                            <option value={option.category} disabled>
                              (missing category)
                            </option>
                          )}
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {categoryLabel(category)}
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => moveOption(index, indices[position - 1])}
                        disabled={position === 0}
                        className="px-1 py-0.5 text-xs rounded border border-gray-300 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                        aria-label="Move option up"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveOption(index, indices[position + 1])}
                        disabled={position === indices.length - 1}
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
                );
              })}
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
    </>
  );
}
