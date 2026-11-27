import { errorMessage } from "@alliance/common/errorMessage";
import { useState } from "react";
import TextareaWithHighlights from "../../../components/TextareaWithHighlights";
import {
  useReminderEmailPreviewAdmin,
  useReminderTextPreviewAdmin,
} from "../../../lib/useReminderPreviewsAdmin";
import Button, { ButtonVariant } from "../../../ui/Button";
import { Field } from "../../../ui/templates/Form";
import { keywords } from "./ReminderKeywordHelp";
import type { ReminderGroupDraft } from "./reminderGroupDraft";

type TaskCount = 1 | 2;

const TASK_COUNTS: readonly TaskCount[] = [1, 2];

type Message = "emailMessage" | "textMessage" | "pushMessage";

const toggle = (count: TaskCount) => (current: TaskCount | null) =>
  current === count ? null : count;

function PreviewButtons({
  noun,
  shown,
  onToggle,
}: {
  noun: string;
  shown: TaskCount | null;
  onToggle: (count: TaskCount) => void;
}) {
  return (
    <span className="flex gap-1">
      {TASK_COUNTS.map((count) => (
        <Button
          key={count}
          size="small"
          variant={shown === count ? ButtonVariant.Soft : ButtonVariant.Ghost}
          aria-pressed={shown === count}
          onClick={() => onToggle(count)}
        >
          Preview {noun} ({count === 1 ? "1 task" : "2 tasks"})
        </Button>
      ))}
    </span>
  );
}

function Rendered({
  error,
  children,
}: {
  error: Error | null;
  children: React.ReactNode;
}) {
  return (
    <div className="member-surface min-h-24 rounded-md border border-line bg-surface-2 p-3 whitespace-pre-wrap break-words">
      {error ? (
        <p role="alert" className="text-danger">
          {errorMessage({ error, fallback: "Couldn't render the preview." })}
        </p>
      ) : (
        children
      )}
    </div>
  );
}

/**
 * The four messages with their keywords highlighted, each with the server's
 * rendering for one or two tasks in place of the text while shown.
 */
export function ReminderMessageFields({
  eventId,
  draft,
  onChange,
}: {
  eventId: number | null;
  draft: ReminderGroupDraft;
  onChange: (patch: Partial<ReminderGroupDraft>) => void;
}) {
  const [emailCount, setEmailCount] = useState<TaskCount | null>(null);
  const [textCount, setTextCount] = useState<TaskCount | null>(null);
  const [pushCount, setPushCount] = useState<TaskCount | null>(null);
  const email = useReminderEmailPreviewAdmin(
    eventId,
    emailCount === null
      ? null
      : {
          emailMessage: draft.emailMessage,
          emailSubject: draft.emailSubject,
          taskCount: emailCount,
        },
  );
  const text = useReminderTextPreviewAdmin(
    eventId,
    textCount === null
      ? null
      : { textMessage: draft.textMessage, taskCount: textCount },
  );
  const push = useReminderTextPreviewAdmin(
    eventId,
    pushCount === null
      ? null
      : { textMessage: draft.pushMessage, taskCount: pushCount },
  );
  const editor = (field: Message | "emailSubject", rows: number) =>
    function Editor(control: { id: string }) {
      return (
        <TextareaWithHighlights
          {...control}
          keywords={keywords}
          value={draft[field]}
          onChange={(value) => onChange({ [field]: value })}
          rows={rows}
          highlightHashPipeSyntax
        />
      );
    };
  const message = (params: {
    field: Message;
    label: string;
    noun: string;
    rows: number;
    shown: TaskCount | null;
    setShown: (update: (current: TaskCount | null) => TaskCount | null) => void;
    rendered: React.ReactNode;
    error: Error | null;
  }) => (
    <div className="flex flex-col gap-1.5">
      <Field
        label={params.label}
        help={
          params.shown === null
            ? undefined
            : `As the server renders it for ${params.shown === 1 ? "1 task" : "2 tasks"}. Press the button again to edit.`
        }
      >
        {(control) =>
          params.shown === null ? (
            editor(params.field, params.rows)(control)
          ) : (
            <Rendered error={params.error}>{params.rendered}</Rendered>
          )
        }
      </Field>
      <PreviewButtons
        noun={params.noun}
        shown={params.shown}
        onToggle={(count) => params.setShown(toggle(count))}
      />
    </div>
  );

  return (
    <>
      <Field label="Email subject">{editor("emailSubject", 1)}</Field>
      {message({
        field: "emailMessage",
        label: "Email message",
        noun: "email",
        rows: 6,
        shown: emailCount,
        setShown: setEmailCount,
        error: email.error,
        rendered: email.data && (
          <>
            <p className="mb-3 font-semibold">{email.data.subject}</p>
            <div dangerouslySetInnerHTML={{ __html: email.data.html }} />
          </>
        ),
      })}
      {message({
        field: "textMessage",
        label: "Text message",
        noun: "text",
        rows: 3,
        shown: textCount,
        setShown: setTextCount,
        error: text.error,
        rendered: text.data,
      })}
      {message({
        field: "pushMessage",
        label: "Push message",
        noun: "push",
        rows: 2,
        shown: pushCount,
        setShown: setPushCount,
        error: push.error,
        rendered: push.data,
      })}
    </>
  );
}
