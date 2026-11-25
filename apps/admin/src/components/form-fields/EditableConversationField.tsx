import { conversationNoteLabel } from "@alliance/common/forms/conversation";
import type {
  ConversationField,
  ConversationOption,
} from "@alliance/common/forms/form-schema";
import { cn } from "@alliance/shared/styles/util";
import { UserPicker } from "../UserPicker";
import { VariableTextField } from "../VariableTextField";
import {
  DuplicateOptionsWarning,
  RequiredToggle,
  duplicateOptionValues,
} from "./CommonControls";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

const inputClassName =
  "w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500";

export function EditableConversationField({
  field,
  onUpdate,
  previousFields,
  laterFields,
}: BaseFieldProps<ConversationField>) {
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
    <FieldWrapper
      field={field}
      onUpdate={onUpdate}
      previousFields={previousFields}
      laterFields={laterFields}
    >
      <div className="space-y-1">
        <span className="block text-xs font-medium text-gray-700">Expert</span>
        <UserPicker
          placeholder="Search users by name or id"
          ariaLabel="Expert"
          selected={field.expert}
          onChange={(expert) => onUpdate({ expert })}
        />
      </div>

      <FieldLabelEditor
        value={field.label}
        onChange={(label) => onUpdate({ label })}
      />
      <p className="text-xs text-gray-500">
        Members don&apos;t see the label. It names the answer in responses.
      </p>

      <RequiredToggle
        checked={field.required}
        onChange={(required) => onUpdate({ required })}
        label="Choice required"
      />

      <label className="block space-y-1">
        <span className="block text-xs font-medium text-gray-700">
          Expert&apos;s message (markdown)
        </span>
        <VariableTextField
          multiline
          rows={4}
          value={field.message}
          onChange={(message) => onUpdate({ message })}
          className={cn(inputClassName, "resize-y")}
          placeholder="What the expert asks"
        />
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="block text-xs font-medium text-gray-700">
            Member&apos;s options
          </span>
          <button
            onClick={addOption}
            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            type="button"
          >
            Add option
          </button>
        </div>
        {field.options.map((option, index) => (
          <fieldset
            key={index}
            className="space-y-2 rounded border border-gray-200 p-2"
          >
            <legend className="px-1 text-xs text-gray-500">
              Option {index + 1}
            </legend>
            <div className="flex items-center gap-2">
              <VariableTextField
                multiline
                rows={1}
                value={option.label}
                onChange={(label) => updateOption(index, { label })}
                containerClassName="flex-1"
                className={cn(inputClassName, "resize-y")}
                placeholder="Option label"
              />
              <input
                type="text"
                aria-label={`Option ${index + 1} value`}
                value={option.value}
                onChange={(e) => updateOption(index, { value: e.target.value })}
                className={cn(
                  inputClassName,
                  "w-20",
                  duplicates.has(option.value) && "border-red-500",
                )}
                placeholder="Value"
              />
              <button
                onClick={() => removeOption(index)}
                className="text-xs text-red-600 hover:text-red-700"
                type="button"
              >
                Remove
              </button>
            </div>
            <VariableTextField
              multiline
              rows={2}
              value={option.reply ?? ""}
              onChange={(reply) =>
                updateOption(index, { reply: reply || undefined })
              }
              className={cn(inputClassName, "resize-y")}
              placeholder="Expert's reply to this option (optional, markdown)"
            />
            <RequiredToggle
              checked={option.note !== undefined}
              onChange={(on) =>
                updateOption(index, { note: on ? {} : undefined })
              }
              label="Show note box"
            />
            {option.note && (
              <div className="space-y-2 pl-5">
                <RequiredToggle
                  checked={option.note.required}
                  onChange={(required) =>
                    updateOption(index, { note: { ...option.note, required } })
                  }
                  label="Note required"
                />
                <VariableTextField
                  aria-label={`Option ${index + 1} note box label`}
                  value={option.note.label ?? ""}
                  onChange={(label) =>
                    updateOption(index, {
                      note: { ...option.note, label: label || undefined },
                    })
                  }
                  className={inputClassName}
                  placeholder={`Note box label (default: ${conversationNoteLabel(option.note)})`}
                />
                <VariableTextField
                  value={option.note.placeholder ?? ""}
                  onChange={(placeholder) =>
                    updateOption(index, {
                      note: {
                        ...option.note,
                        placeholder: placeholder || undefined,
                      },
                    })
                  }
                  className={inputClassName}
                  placeholder="Note box placeholder (optional)"
                />
              </div>
            )}
          </fieldset>
        ))}
        <DuplicateOptionsWarning duplicates={duplicates} />
      </div>
    </FieldWrapper>
  );
}
