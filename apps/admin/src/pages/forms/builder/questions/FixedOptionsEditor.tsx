import type { ChoiceField } from "@alliance/common/forms/formula-options";
import { optionSectionId } from "@alliance/shared/forms/optionSections";
import { useRef } from "react";
import Button, { ButtonVariant } from "../../../../ui/Button";
import { Select } from "../../../../ui/Select";
import { EditorSize, ExpandableEditor } from "../kit/ExpandableEditor";
import { AddItemButton } from "../kit/ItemList";
import { focusInPlace } from "../kit/revealInPane";
import {
  DuplicateOptionsWarning,
  duplicateOptionValues,
} from "./CommonControls";
import { FixedOptionsTable, type OptionSectionRows } from "./FixedOptionsTable";
import { categoryLabel, withCategory } from "./OptionCategoriesEditor";
import {
  DefaultChoice,
  OptionLabelInput,
  OptionSection,
  OptionValueInput,
} from "./OptionRows";
import {
  DefaultKind,
  defaultList,
  editOption,
  isDefault,
  newOption,
  removeOption,
  toggleManyDefault,
  type OptionDefaults,
} from "./optionRules";

/** Past this many options the inspector offers the one-line-per-option table. */
const TABLE_AFTER = 8;

/** The fixed option rows of a select or multi-select, grouped by category. */
export function FixedOptionsEditor({
  field,
  onUpdate,
}: {
  field: ChoiceField;
  onUpdate: (updates: Partial<ChoiceField>) => void;
}) {
  const options = field.options ?? [];
  const categories = field.categories ?? [];
  const duplicates = duplicateOptionValues(options);
  const defaults: OptionDefaults =
    field.kind === "select"
      ? { kind: DefaultKind.One, value: field.defaultValue }
      : { kind: DefaultKind.Many, value: field.defaultValue };
  const hasDefault =
    field.kind === "select"
      ? field.defaultValue != null
      : defaultList(field.defaultValue).length > 0;

  const categoryIds = new Set(categories.map((category) => category.id));
  const sections: OptionSectionRows[] = [null, ...categories]
    .map((category) => ({
      id: category?.id ?? "",
      label: category
        ? `Options in ${categoryLabel(category)}`
        : categories.length > 0
          ? "Options without a category"
          : "Options",
      heading:
        categories.length > 0
          ? category
            ? categoryLabel(category)
            : "No category"
          : null,
      indices: options.flatMap((option, index) =>
        optionSectionId(option, categoryIds) === category?.id ? [index] : [],
      ),
      empty: category !== null,
    }))
    .filter(({ empty, indices }) => empty || indices.length > 0);

  // Picking a category moves the row to another section, which drops focus.
  const refocusCategory = useRef<{ index: number; where: EditorSize } | null>(
    null,
  );
  const assignCategory = (params: {
    index: number;
    category?: string;
    where: EditorSize;
  }) => {
    refocusCategory.current = { index: params.index, where: params.where };
    onUpdate({
      options: options.map((option, i) =>
        i === params.index ? withCategory(option, params.category) : option,
      ),
    });
  };

  const setDefault = (value: string, checked: boolean) =>
    onUpdate(
      field.kind === "select"
        ? { defaultValue: value }
        : {
            defaultValue: toggleManyDefault({
              value: field.defaultValue,
              option: value,
              checked,
            }),
          },
    );

  const cells = {
    label: (index: number) => (
      <OptionLabelInput
        value={options[index].label}
        onChange={(label) =>
          onUpdate(editOption({ options, index, updates: { label }, defaults }))
        }
      />
    ),
    value: (index: number) => (
      <OptionValueInput
        value={options[index].value}
        duplicate={duplicates.has(options[index].value)}
        onChange={(value) =>
          onUpdate(editOption({ options, index, updates: { value }, defaults }))
        }
      />
    ),
    default: (index: number) => (
      <DefaultChoice
        kind={defaults.kind}
        group={`${field.id}-default`}
        checked={isDefault(defaults, options[index].value)}
        onChange={(checked) => setDefault(options[index].value, checked)}
      />
    ),
    category: (index: number, where: EditorSize) => {
      const option = options[index];
      return categories.length === 0 ? null : (
        <Select
          aria-label="Category"
          ref={(select) => {
            const pending = refocusCategory.current;
            if (select && pending?.index === index && pending.where === where) {
              refocusCategory.current = null;
              focusInPlace(select);
            }
          }}
          value={option.category ?? ""}
          onChange={(event) =>
            assignCategory({
              index,
              category: event.target.value || undefined,
              where,
            })
          }
          className="h-control-sm text-caption"
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
        </Select>
      );
    },
  };

  const reorder = (next: typeof options) => onUpdate({ options: next });
  const remove = (index: number) =>
    onUpdate(removeOption({ options, index, defaults }));

  const rows = () =>
    sections.map((section) => (
      <div
        key={section.id}
        role={section.heading === null ? undefined : "group"}
        aria-label={section.heading === null ? undefined : section.label}
        className="flex flex-col gap-2"
      >
        {section.heading !== null && (
          <p className="text-caption font-medium text-fg-muted">
            {section.heading}
          </p>
        )}
        {section.indices.length === 0 ? (
          <p className="text-caption text-fg-muted">No options</p>
        ) : (
          <OptionSection
            label={section.label}
            options={options}
            indices={section.indices}
            onReorder={reorder}
            onRemove={remove}
          >
            {(index) => (
              <>
                {cells.label(index)}
                <div className="flex items-center gap-2">
                  {cells.value(index)}
                  {cells.default(index)}
                </div>
                {cells.category(index, EditorSize.Inspector)}
              </>
            )}
          </OptionSection>
        )}
      </div>
    ));

  return (
    <>
      {options.length > TABLE_AFTER ? (
        <ExpandableEditor
          title="Edit options"
          render={(size) =>
            size === EditorSize.Inspector ? (
              rows()
            ) : (
              <FixedOptionsTable
                options={options}
                sections={sections}
                withCategory={categories.length > 0}
                onReorder={reorder}
                onRemove={remove}
                cells={{
                  ...cells,
                  category: (index) => cells.category(index, EditorSize.Sheet),
                }}
              />
            )
          }
        />
      ) : (
        rows()
      )}
      <DuplicateOptionsWarning duplicates={duplicates} />
      <div className="flex flex-wrap gap-2">
        <AddItemButton
          onClick={() =>
            onUpdate({ options: [...options, newOption(options.length)] })
          }
        >
          Add option
        </AddItemButton>
        <Button
          variant={ButtonVariant.Ghost}
          size="small"
          disabled={!hasDefault}
          onClick={() => onUpdate({ defaultValue: null })}
        >
          {field.kind === "select" ? "Clear default" : "Clear defaults"}
        </Button>
      </div>
    </>
  );
}
