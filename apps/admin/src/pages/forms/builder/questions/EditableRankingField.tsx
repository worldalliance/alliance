import type { RankingField } from "@alliance/common/forms/form-schema";
import { InspectorGroup } from "../kit/InspectorGroup";
import { AddItemButton } from "../kit/ItemList";
import {
  OptionLabelInput,
  OptionSection,
  OptionValueInput,
} from "./OptionRows";
import { newOption } from "./optionRules";
import { Input } from "../../../../ui/Input";
import { Field } from "../../../../ui/templates/Form";
import {
  DuplicateOptionsWarning,
  RequiredToggle,
  duplicateOptionValues,
} from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

export function EditableRankingField({
  field,
  onUpdate,
  previousFields,
  laterFields,
}: BaseFieldProps<RankingField>) {
  const duplicates = duplicateOptionValues(field.options);

  const updateOption = (
    index: number,
    updates: { label?: string; value?: string },
  ) =>
    onUpdate({
      options: field.options.map((option, i) =>
        i === index ? { ...option, ...updates } : option,
      ),
    });

  const removeOption = (index: number) => {
    const updated = field.options.filter((_, i) => i !== index);
    const updates: Partial<RankingField> = { options: updated };
    if (field.numToRank !== undefined && field.numToRank > updated.length) {
      updates.numToRank = updated.length > 0 ? updated.length : undefined;
    }
    onUpdate(updates);
  };

  const handleNumToRankChange = (raw: string) => {
    if (!raw) {
      onUpdate({ numToRank: undefined });
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const clamped = Math.max(
      1,
      Math.min(Math.floor(parsed), field.options.length),
    );
    onUpdate({ numToRank: clamped });
  };

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
          onChange={(value) => onUpdate({ label: value })}
        />
        <RequiredToggle
          checked={field.required}
          onChange={(checked) => onUpdate({ required: checked })}
        />
      </InspectorGroup>

      <InspectorGroup title="Options">
        {field.options.length > 0 && (
          <OptionSection
            label="Options"
            options={field.options}
            indices={field.options.map((_, index) => index)}
            onReorder={(options) => onUpdate({ options })}
            onRemove={removeOption}
          >
            {(index) => (
              <>
                <OptionLabelInput
                  multiline
                  value={field.options[index].label}
                  onChange={(label) => updateOption(index, { label })}
                />
                <div className="flex">
                  <OptionValueInput
                    value={field.options[index].value}
                    duplicate={duplicates.has(field.options[index].value)}
                    onChange={(value) => updateOption(index, { value })}
                  />
                </div>
              </>
            )}
          </OptionSection>
        )}
        <DuplicateOptionsWarning duplicates={duplicates} />
        <div>
          <AddItemButton
            onClick={() =>
              onUpdate({
                options: [...field.options, newOption(field.options.length)],
              })
            }
          >
            Add option
          </AddItemButton>
        </div>
        <Field label="Number of items to rank" help="Empty ranks every option.">
          {(control) => (
            <Input
              {...control}
              type="number"
              min={1}
              max={field.options.length}
              value={field.numToRank ?? ""}
              placeholder="All options"
              onChange={(event) => handleNumToRankChange(event.target.value)}
            />
          )}
        </Field>
      </InspectorGroup>
    </FieldWrapper>
  );
}
