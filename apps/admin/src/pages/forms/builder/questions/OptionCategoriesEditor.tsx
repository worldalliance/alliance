import type { SelectField } from "@alliance/common/forms/form-schema";
import {
  optionCategoryNameErrors,
  type OptionCategory,
} from "@alliance/common/forms/options-schema";
import { useId } from "react";
import { InspectorGroup } from "../kit/InspectorGroup";
import {
  AddItemButton,
  ItemList,
  ItemRow,
} from "../kit/ItemList";
import { swapOptions } from "./optionRules";
import { Input } from "../../../../ui/Input";

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

  const move = (from: number, to: number) =>
    to < 0 || to >= categories.length
      ? null
      : () => onUpdate({ categories: swapOptions(categories, from, to) });

  return (
    <InspectorGroup title="Categories">
      {categories.length > 0 && (
        <ItemList label="Categories">
          {categories.map((category, index) => (
            <ItemRow
              key={category.id}
              name={`Category ${categoryLabel(category)}`}
              onMoveUp={move(index, index - 1)}
              onMoveDown={move(index, index + 1)}
              onRemove={() => deleteCategory(index)}
              removeLabel="Delete category, keeping its options"
            >
              <CategoryName
                name={category.name}
                error={categoryErrors[index]}
                onChange={(name) => renameCategory(index, name)}
              />
            </ItemRow>
          ))}
        </ItemList>
      )}
      <div>
        <AddItemButton onClick={addCategory}>Add category</AddItemButton>
      </div>
    </InspectorGroup>
  );
}

function CategoryName({
  name,
  error,
  onChange,
}: {
  name: string;
  error: string | null | undefined;
  onChange: (name: string) => void;
}) {
  const errorId = useId();
  return (
    <>
      <Input
        aria-label="Category name"
        placeholder="Category name"
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        value={name}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && (
        <p id={errorId} className="text-caption text-danger">
          {error}; the form won&apos;t save until this is fixed.
        </p>
      )}
    </>
  );
}
