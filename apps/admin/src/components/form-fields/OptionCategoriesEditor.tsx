import type { SelectField } from "@alliance/common/forms/form-schema";
import {
  optionCategoryNameErrors,
  type OptionCategory,
} from "@alliance/common/forms/options-schema";
import { cn } from "@alliance/shared/styles/util";

type ChoiceOption = SelectField["options"][number];

export const categoryLabel = (category: OptionCategory) =>
  category.name.trim() || "(unnamed)";

export function withCategory(
  option: ChoiceOption,
  category?: string,
): ChoiceOption {
  const { category: _previous, ...rest } = option;
  return category ? { ...rest, category } : rest;
}

export function OptionCategoriesEditor({
  categories,
  options,
  onUpdate,
}: {
  categories: OptionCategory[];
  options: ChoiceOption[];
  onUpdate: (updates: {
    categories?: OptionCategory[];
    options?: ChoiceOption[];
  }) => void;
}) {
  const categoryErrors = optionCategoryNameErrors(categories);

  const addCategory = () => {
    for (let n = categories.length + 1; ; n += 1) {
      const next = [
        ...categories,
        { id: crypto.randomUUID(), name: `Category ${n}` },
      ];
      if (!optionCategoryNameErrors(next).at(-1)) {
        onUpdate({ categories: next });
        return;
      }
    }
  };

  const renameCategory = (index: number, name: string) =>
    onUpdate({
      categories: categories.map((category, i) =>
        i === index ? { ...category, name } : category,
      ),
    });

  const moveCategory = (from: number, to: number) => {
    const updated = [...categories];
    [updated[from], updated[to]] = [updated[to], updated[from]];
    onUpdate({ categories: updated });
  };

  const deleteCategory = (index: number) => {
    const removed = categories[index].id;
    const remaining = categories.filter((_, i) => i !== index);
    onUpdate({
      categories: remaining.length > 0 ? remaining : undefined,
      options: options.map((option) =>
        option.category === removed ? withCategory(option) : option,
      ),
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs font-medium text-gray-700">
          Categories
        </label>
        <button
          onClick={addCategory}
          className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
          type="button"
        >
          Add Category
        </button>
      </div>
      <div className="space-y-2 py-1">
        {categories.map((category, index) => (
          <div key={category.id}>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                aria-label="Category name"
                aria-invalid={!!categoryErrors[index]}
                value={category.name}
                onChange={(event) => renameCategory(index, event.target.value)}
                className={cn(
                  "flex-1 px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500",
                  categoryErrors[index] ? "border-red-500" : "border-gray-300",
                )}
                placeholder="Category name"
              />
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => moveCategory(index, index - 1)}
                  disabled={index === 0}
                  className="px-1 py-0.5 text-xs rounded border border-gray-300 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                  aria-label="Move category up"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveCategory(index, index + 1)}
                  disabled={index === categories.length - 1}
                  className="px-1 py-0.5 text-xs rounded border border-gray-300 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                  aria-label="Move category down"
                  title="Move down"
                >
                  ↓
                </button>
              </div>
              <button
                onClick={() => deleteCategory(index)}
                className="text-red-500 hover:text-red-700 text-sm"
                type="button"
                aria-label={`Delete category ${categoryLabel(category)}, keeping its options`}
                title="Delete category, keeping its options"
              >
                ×
              </button>
            </div>
            {categoryErrors[index] && (
              <p className="mt-1 text-[11px] text-red-500">
                {categoryErrors[index]}; the form won&apos;t save until this is
                fixed.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
