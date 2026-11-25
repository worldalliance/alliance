import {
  chosenConversationOption,
  conversationNoteLabel,
} from "@alliance/common/forms/conversation";
import type {
  ConversationField,
  FormValue,
} from "@alliance/common/forms/form-schema";
import { type FormValueUpdater } from "@alliance/shared/forms/formValueUpdater";
import { useExpertTyping } from "@alliance/shared/forms/useExpertTyping";
import { autoResponseLabel } from "@alliance/shared/lib/copy";
import { cn } from "@alliance/shared/styles/util";
import { useId } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { prefersReducedMotion } from "../lib/reducedMotion";
import FormMarkdownWrapper from "../ui/FormMarkdownWrapper";
import { ExpertBubble } from "./ExpertBubble";
import {
  fieldInputClassName,
  sharedInputClasses,
  ValidationMessage,
} from "./fieldParts";

function TypingDots({ name }: { name: string | undefined }) {
  return (
    <span
      role="status"
      aria-label={name ? `${name} is typing` : "Typing"}
      className="flex h-4 items-center gap-1"
    >
      {[0, 120, 240].map((delay) => (
        <span
          key={delay}
          aria-hidden
          className="size-1.5 animate-bounce rounded-full bg-zinc-400"
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
    hasReply: Boolean(chosen?.reply),
    reduceMotion: prefersReducedMotion(),
  });
  const expertName = field.expert?.userName;

  return (
    <div className="flex flex-col gap-3">
      <ExpertBubble expert={field.expert} showName id={messageId}>
        <FormMarkdownWrapper markdownContent={field.message} />
      </ExpertBubble>

      <div className="ml-[75px] flex">
        <div
          role="radiogroup"
          aria-labelledby={messageId}
          aria-required={required}
          aria-invalid={hasError}
          className={cn(
            "flex max-w-[85%] flex-col divide-y divide-zinc-200 overflow-hidden rounded-2xl border bg-white",
            hasError ? "border-red-500" : "border-zinc-200",
          )}
        >
          {field.options.map((option) => {
            const selected = option.value === choice;
            return (
              <label
                key={option.value}
                className={cn(
                  // Anchors the sr-only radio to this row: focusing it otherwise
                  // scrolls the page to wherever its absolute position lands.
                  "relative flex items-start gap-3 px-4 py-3 text-zinc-800",
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
            <ExpertBubble expert={field.expert} faint>
              <TypingDots name={expertName} />
            </ExpertBubble>
          ) : (
            <ExpertBubble expert={field.expert} caption={autoResponseLabel}>
              <FormMarkdownWrapper markdownContent={chosen.reply} />
            </ExpertBubble>
          ))}
      </div>

      {chosen?.note && !typing && (
        <div className="ml-[75px] space-y-1">
          <label htmlFor={noteId} className="block text-sm text-zinc-700">
            {conversationNoteLabel(chosen.note)}
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
