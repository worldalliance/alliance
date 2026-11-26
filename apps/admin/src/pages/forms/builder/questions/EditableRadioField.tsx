import type { RadioField } from "@alliance/common/forms/form-schema";
import { InspectorGroup } from "../kit/InspectorGroup";
import { AddItemButton } from "../kit/ItemList";
import {
  DefaultChoice,
  OptionLabelInput,
  OptionSection,
  OptionValueInput,
} from "./OptionRows";
import {
  DefaultKind,
  editOption,
  newOption,
  removeOption,
  type OptionDefaults,
} from "./optionRules";
import Button, { ButtonVariant } from "../../../../ui/Button";
import { CheckboxField } from "../../../../ui/templates/Form";
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
  previousFields,
  laterFields,
}: BaseFieldProps<RadioField>) {
  const options = field.options ?? [];
  const duplicates = duplicateOptionValues(options);
  const defaults: OptionDefaults = {
    kind: DefaultKind.One,
    value: field.defaultValue,
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
      </InspectorGroup>

      <InspectorGroup title="Options">
        {options.length > 0 && (
          <OptionSection
            label="Options"
            options={options}
            indices={options.map((_, index) => index)}
            onReorder={(next) => onUpdate({ options: next })}
            onRemove={(index) =>
              onUpdate(removeOption({ options, index, defaults }))
            }
          >
            {(index) => (
              <>
                <OptionLabelInput
                  value={options[index].label}
                  onChange={(label) =>
                    onUpdate(
                      editOption({
                        options,
                        index,
                        updates: { label },
                        defaults,
                      }),
                    )
                  }
                />
                <div className="flex items-center gap-2">
                  <OptionValueInput
                    value={options[index].value}
                    duplicate={duplicates.has(options[index].value)}
                    onChange={(value) =>
                      onUpdate(
                        editOption({
                          options,
                          index,
                          updates: { value },
                          defaults,
                        }),
                      )
                    }
                  />
                  <DefaultChoice
                    kind={DefaultKind.One}
                    group={`${field.id}-default`}
                    checked={field.defaultValue === options[index].value}
                    onChange={() =>
                      onUpdate({ defaultValue: options[index].value })
                    }
                  />
                </div>
              </>
            )}
          </OptionSection>
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
            disabled={field.defaultValue == null}
            onClick={() => onUpdate({ defaultValue: null })}
          >
            Clear default
          </Button>
        </div>
      </InspectorGroup>
    </FieldWrapper>
  );
}
