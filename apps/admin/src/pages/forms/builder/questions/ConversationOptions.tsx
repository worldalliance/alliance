import { conversationNoteLabel } from "@alliance/common/forms/conversation";
import type {
  ConversationField,
  ConversationOption,
} from "@alliance/common/forms/form-schema";
import { ExpandableEditor } from "../kit/ExpandableEditor";
import { InspectorGroup } from "../kit/InspectorGroup";
import {
  AddItemButton,
  ItemList,
  ItemRow,
} from "../kit/ItemList";
import { cn } from "../../../../ui/cn";
import { Input } from "../../../../ui/Input";
import { controlClass } from "../../../../ui/styles";
import { CheckboxField, Field } from "../../../../ui/templates/Form";
import { neighborMoves } from "../inspector/ChildRows";
import { VariableTextField } from "./VariableTextField";
import {
  DuplicateOptionsWarning,
  duplicateOptionValues,
} from "./CommonControls";

const textClass = cn(controlClass, "py-2");

function VariableField(params: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const { label, value, onChange, placeholder, rows } = params;
  return (
    <Field label={label}>
      {() => (
        <VariableTextField
          multiline={rows !== undefined}
          rows={rows}
          aria-label={label}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={textClass}
        />
      )}
    </Field>
  );
}

export function ConversationOptions({
  field,
  onUpdate,
}: {
  field: ConversationField;
  onUpdate: (updates: Partial<ConversationField>) => void;
}) {
  const duplicates = duplicateOptionValues(field.options);

  const updateOption = (index: number, updates: Partial<ConversationOption>) =>
    onUpdate({
      options: field.options.map((option, i) =>
        i === index ? { ...option, ...updates } : option,
      ),
    });

  const addOption = () => {
    const next = field.options.length + 1;
    onUpdate({
      options: [
        ...field.options,
        { label: `Option ${next}`, value: `option${next}` },
      ],
    });
  };

  const removeOption = (index: number) => {
    const removed = field.options[index];
    onUpdate({
      options: field.options.filter((_, i) => i !== index),
      ...(removed?.value === field.defaultValue ? { defaultValue: null } : {}),
    });
  };

  return (
    <InspectorGroup title="Member options">
      {field.options.length > 0 && (
        <ItemList label="Member options">
          {field.options.map((option, index) => (
            <ItemRow
              key={index}
              name={`Option ${index + 1}`}
              {...neighborMoves(field.options, index, (options) =>
                onUpdate({ options }),
              )}
              onRemove={() => removeOption(index)}
            >
              <VariableField
                label={`Option ${index + 1} label`}
                value={option.label}
                onChange={(label) => updateOption(index, { label })}
                placeholder="Option label"
              />
              <Field
                label={`Option ${index + 1} value`}
                error={
                  duplicates.has(option.value)
                    ? "Another option has this value."
                    : null
                }
              >
                {(control) => (
                  <Input
                    {...control}
                    className="font-mono"
                    value={option.value}
                    onChange={(event) =>
                      updateOption(index, { value: event.target.value })
                    }
                    placeholder="Value"
                  />
                )}
              </Field>
              <Field label={`Option ${index + 1}: expert's reply`}>
                {() => (
                  <ExpandableEditor
                    title={`Edit expert's reply to option ${index + 1}`}
                    render={(size) => (
                      <VariableTextField
                        multiline
                        rows={size === "sheet" ? 12 : 2}
                        aria-label={`Option ${index + 1}: expert's reply`}
                        value={option.reply ?? ""}
                        onChange={(reply) =>
                          updateOption(index, { reply: reply || undefined })
                        }
                        className={textClass}
                        placeholder="Optional, markdown"
                      />
                    )}
                  />
                )}
              </Field>
              <CheckboxField
                label="Show note box"
                checked={option.note !== undefined}
                onChange={(event) =>
                  updateOption(index, {
                    note: event.target.checked ? {} : undefined,
                  })
                }
              />
              {option.note && (
                <div className="flex flex-col gap-3 pl-6">
                  <CheckboxField
                    label="Note required"
                    checked={!!option.note.required}
                    onChange={(event) =>
                      updateOption(index, {
                        note: {
                          ...option.note,
                          required: event.target.checked,
                        },
                      })
                    }
                  />
                  <VariableField
                    label={`Option ${index + 1} note box label`}
                    value={option.note.label ?? ""}
                    placeholder={`Default: ${conversationNoteLabel(option.note)}`}
                    onChange={(label) =>
                      updateOption(index, {
                        note: { ...option.note, label: label || undefined },
                      })
                    }
                  />
                  <VariableField
                    label={`Option ${index + 1} note box placeholder`}
                    value={option.note.placeholder ?? ""}
                    onChange={(placeholder) =>
                      updateOption(index, {
                        note: {
                          ...option.note,
                          placeholder: placeholder || undefined,
                        },
                      })
                    }
                  />
                </div>
              )}
            </ItemRow>
          ))}
        </ItemList>
      )}
      <DuplicateOptionsWarning duplicates={duplicates} />
      <div>
        <AddItemButton onClick={addOption}>Add option</AddItemButton>
      </div>
    </InspectorGroup>
  );
}
