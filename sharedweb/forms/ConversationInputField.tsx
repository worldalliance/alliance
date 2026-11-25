import { chosenConversationOption } from "@alliance/common/forms/conversation";
import type {
  ConversationExpert,
  ConversationField,
  FormValue,
} from "@alliance/common/forms/form-schema";
import { type FormValueUpdater } from "@alliance/shared/forms/formValueUpdater";
import { useExpertTyping } from "@alliance/shared/forms/useExpertTyping";
import { cn } from "@alliance/shared/styles/util";
import { useId, type ReactNode } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { prefersReducedMotion } from "../lib/reducedMotion";
import { AvatarProfile } from "../ui/Avatar";
import FormMarkdownWrapper from "../ui/FormMarkdownWrapper";
import {
  fieldInputClassName,
  sharedInputClasses,
  ValidationMessage,
} from "./fieldParts";

function ExpertBubble({
  expert,
  showName,
  id,
  children,
}: {
  expert: ConversationExpert | null;
  showName?: boolean;
  id?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-end gap-2">
      <AvatarProfile
        pfp={expert?.userProfilePicture ?? null}
        size="medium"
        alt=""
        className="shrink-0"
      />
      <div className="flex min-w-0 max-w-[85%] flex-col items-start gap-1">
        {showName && expert && (
          <span className="px-2 text-xs text-zinc-500">{expert.userName}</span>
        )}
        <div
          id={id}
          className="rounded-2xl rounded-bl-sm bg-zinc-200 px-3.5 py-2 text-zinc-900"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function TypingDots({ name }: { name: string | undefined }) {
  return (
    <span
      role="status"
      aria-label={name ? `${name} is typing` : "Typing"}
      className="flex h-6 items-center gap-1"
    >
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          aria-hidden
          className="size-2 animate-bounce rounded-full bg-zinc-500"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

export function ConversationInputField({
  field,
  value,
  onChange,
  noteValue,
  onNoteChange,
  disabled,
  errorMessage,
  required,
}: {
  field: ConversationField;
  value: FormValue | undefined;
  onChange?: (value: FormValueUpdater) => void;
  noteValue: FormValue | undefined;
  onNoteChange?: (value: FormValueUpdater) => void;
  disabled?: boolean;
  errorMessage: string | null;
  required: boolean;
}) {
  const instanceId = useId();
  const messageId = `${field.id}-${instanceId}-message`;
  const noteId = `${field.id}-${instanceId}-note`;
  const hasError = errorMessage !== null;
  const choice = typeof value === "string" ? value : undefined;
  const chosen = chosenConversationOption(field, choice);
  const typing = useExpertTyping({
    choice,
    reduceMotion: prefersReducedMotion(),
  });
  const expertName = field.expert?.userName;

  return (
    <div className="flex flex-col gap-3">
      <ExpertBubble expert={field.expert} showName id={messageId}>
        <FormMarkdownWrapper markdownContent={field.message} />
      </ExpertBubble>

      <div className="flex justify-end">
        <div
          role="radiogroup"
          aria-labelledby={messageId}
          aria-required={required}
          aria-invalid={hasError}
          className={cn(
            "flex max-w-[85%] flex-col divide-y divide-zinc-200 overflow-hidden rounded-2xl rounded-br-sm border bg-white",
            hasError ? "border-red-500" : "border-zinc-200",
          )}
        >
          {field.options.map((option) => {
            const selected = option.value === choice;
            return (
              <label
                key={option.value}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 text-zinc-800",
                  "has-focus-visible:ring-2 has-focus-visible:ring-green has-focus-visible:ring-inset",
                  selected ? "bg-green/10" : "hover:bg-zinc-50",
                  disabled ? "cursor-default" : "cursor-pointer",
                )}
              >
                <input
                  type="radio"
                  name={`${field.id}-${instanceId}`}
                  value={option.value}
                  checked={selected}
                  onChange={
                    onChange ? (e) => onChange(e.target.value) : undefined
                  }
                  disabled={disabled}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 bg-white",
                    selected ? "border-green" : "border-zinc-500",
                  )}
                >
                  {selected && (
                    <span className="size-2.5 rounded-full bg-green" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <FormMarkdownWrapper markdownContent={option.label} inline />
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div aria-live="polite" className="flex flex-col gap-3">
        {chosen?.reply &&
          (typing ? (
            <ExpertBubble expert={field.expert}>
              <TypingDots name={expertName} />
            </ExpertBubble>
          ) : (
            <ExpertBubble expert={field.expert}>
              <FormMarkdownWrapper markdownContent={chosen.reply} />
            </ExpertBubble>
          ))}
      </div>

      {chosen?.note && !typing && (
        <div className="space-y-1">
          <label htmlFor={noteId} className="block text-sm text-zinc-700">
            Your note{chosen.note.required ? "" : " (optional)"}
          </label>
          <TextareaAutosize
            id={noteId}
            minRows={3}
            value={typeof noteValue === "string" ? noteValue : ""}
            onChange={
              onNoteChange ? (e) => onNoteChange(e.target.value) : undefined
            }
            disabled={disabled}
            required={chosen.note.required}
            placeholder={chosen.note.placeholder}
            className={fieldInputClassName({
              base: sharedInputClasses + " resize-none overflow-hidden",
              hasError,
            })}
          />
        </div>
      )}
      <ValidationMessage message={errorMessage} />
    </div>
  );
}
