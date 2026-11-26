import type { ConversationField } from "@alliance/common/forms/form-schema";
import { ExpandableEditor } from "../../pages/forms/builder/kit/ExpandableEditor";
import { InspectorGroup } from "../../pages/forms/builder/kit/InspectorGroup";
import { cn } from "../../ui/cn";
import { controlClass } from "../../ui/styles";
import { Field } from "../../ui/templates/Form";
import { UserPicker } from "../UserPicker";
import { VariableTextField } from "../VariableTextField";
import { RequiredToggle } from "./CommonControls";
import { ConversationOptions } from "./ConversationOptions";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

export function EditableConversationField({
  field,
  onUpdate,
  previousFields,
  laterFields,
}: BaseFieldProps<ConversationField>) {
  return (
    <FieldWrapper
      field={field}
      onUpdate={onUpdate}
      previousFields={previousFields}
      laterFields={laterFields}
    >
      <InspectorGroup>
        <Field label="Expert">
          {() => (
            <UserPicker
              placeholder="Search users by name or id"
              ariaLabel="Expert"
              selected={field.expert}
              onChange={(expert) => onUpdate({ expert })}
            />
          )}
        </Field>
        <div className="flex flex-col gap-1.5">
          <FieldLabelEditor
            label="Question"
            value={field.label}
            onChange={(label) => onUpdate({ label })}
          />
          <p className="text-caption text-fg-muted">
            Members don&apos;t see the label. It names the answer in responses.
          </p>
        </div>
        <RequiredToggle
          checked={field.required}
          onChange={(required) => onUpdate({ required })}
          label="Choice required"
        />
        <Field label="Expert's message">
          {() => (
            <ExpandableEditor
              title="Edit expert's message"
              render={(size) => (
                <VariableTextField
                  multiline
                  rows={size === "sheet" ? 16 : 4}
                  aria-label="Expert's message"
                  value={field.message}
                  onChange={(message) => onUpdate({ message })}
                  className={cn(controlClass, "py-2")}
                  placeholder="What the expert asks (markdown)"
                />
              )}
            />
          )}
        </Field>
      </InspectorGroup>
      <ConversationOptions field={field} onUpdate={onUpdate} />
    </FieldWrapper>
  );
}
