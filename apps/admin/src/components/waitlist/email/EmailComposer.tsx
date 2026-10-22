import {
  findWaitlistEmailPlaceholders,
  WaitlistEmailPlaceholder,
  waitlistEmailToken,
} from "@alliance/common/waitlistEmail";
import { X } from "lucide-react";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { adminRefusalMessage } from "../../../lib/adminRefusal";
import { useWaitlistEmailPreviewAdmin } from "../../../lib/useWaitlistEmailsAdmin";
import {
  blockingProblem,
  completeDraft,
  type EmailDraft,
  emailWarnings,
} from "../../../lib/waitlistEmail";
import ConfirmDialog from "../../ConfirmDialog";
import FormTextarea from "../../FormTextarea";
import { ICON_BUTTON_CLASS } from "../controlClasses";
import EmailPreviewPanel from "./EmailPreviewPanel";
import EmailSendActions from "./EmailSendActions";
import EmailTemplateControls from "./EmailTemplateControls";

const FIELD_CLASS = "w-full rounded border border-zinc-300 px-2 py-1 text-sm";

type EmailComposerProps = {
  selectedIds: ReadonlySet<number>;
  initialDraft: EmailDraft;
  onClose: () => void;
  onSent: () => void;
};

const EmailComposer: React.FC<EmailComposerProps> = ({
  selectedIds,
  initialDraft,
  onClose,
  onSent,
}) => {
  const [draft, setDraft] = useState(initialDraft);
  const [settledDraft, setSettledDraft] = useState(initialDraft);
  const [includeClaimed, setIncludeClaimed] = useState(false);
  const [sampleEntryId, setSampleEntryId] = useState<number>();
  const [discarding, setDiscarding] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const caretAfterInsert = useRef<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSettledDraft(draft), 400);
    return () => clearTimeout(timer);
  }, [draft]);

  const { used, unknown } = findWaitlistEmailPlaceholders([
    draft.subject,
    draft.body,
  ]);
  const entryIds = [...selectedIds];
  const previewDto = {
    ...settledDraft,
    entryIds,
    includeClaimed,
    sampleEntryId,
  };
  const preview = useWaitlistEmailPreviewAdmin(previewDto, {
    enabled: entryIds.length > 0 && completeDraft(settledDraft),
  });
  const current =
    preview.isSuccess &&
    !preview.isPlaceholderData &&
    !preview.isFetching &&
    settledDraft === draft &&
    completeDraft(draft)
      ? preview.data
      : null;
  const problem = preview.data
    ? blockingProblem({ preview: preview.data, used })
    : null;

  const insert = (placeholder: WaitlistEmailPlaceholder) => {
    const start = bodyRef.current?.selectionStart ?? draft.body.length;
    const end = bodyRef.current?.selectionEnd ?? start;
    const token = waitlistEmailToken(placeholder);
    caretAfterInsert.current = start + token.length;
    setDraft({
      ...draft,
      body: draft.body.slice(0, start) + token + draft.body.slice(end),
    });
  };

  // Writing the value moves the caret to the end, so the next insert would
  // land there.
  useLayoutEffect(() => {
    const caret = caretAfterInsert.current;
    if (caret === null) return;
    caretAfterInsert.current = null;
    bodyRef.current?.focus();
    bodyRef.current?.setSelectionRange(caret, caret);
  }, [draft.body]);

  return (
    <section
      aria-label="Compose email"
      className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-zinc-900">
          Email {selectedIds.size} selected
        </h2>
        <button
          type="button"
          aria-label="Discard email"
          title="Discard email"
          className={ICON_BUTTON_CLASS}
          onClick={() =>
            draft.subject.trim() || draft.body.trim()
              ? setDiscarding(true)
              : onClose()
          }
        >
          <X size={16} />
        </button>
        <ConfirmDialog
          isOpen={discarding}
          title="Discard this email?"
          message="Closes the composer and discards this subject and body."
          onConfirm={onClose}
          onCancel={() => setDiscarding(false)}
        />
      </div>
      <EmailTemplateControls draft={draft} onLoad={setDraft} />
      <input
        aria-label="Subject"
        placeholder="Subject"
        maxLength={200}
        className={FIELD_CLASS}
        value={draft.subject}
        onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
      />
      <FormTextarea
        aria-label="Body"
        placeholder="Body, in Markdown"
        minRows={6}
        maxLength={20000}
        className={FIELD_CLASS}
        textareaRef={bodyRef}
        value={draft.body}
        onChange={(e) => setDraft({ ...draft, body: e.target.value })}
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-zinc-500">Insert</span>
        {Object.values(WaitlistEmailPlaceholder).map((placeholder) => (
          <button
            key={placeholder}
            type="button"
            className="rounded border border-zinc-300 px-2 py-0.5 font-mono text-xs hover:bg-zinc-50"
            onClick={() => insert(placeholder)}
          >
            {waitlistEmailToken(placeholder)}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1 text-zinc-700">
          <input
            type="checkbox"
            checked={includeClaimed}
            onChange={(e) => setIncludeClaimed(e.target.checked)}
          />
          Include people who already claimed an invite
        </label>
      </div>
      {unknown.length > 0 && (
        <p className="text-sm text-red-600">
          Unknown placeholders: {unknown.join(", ")}
        </p>
      )}
      {selectedIds.size === 0 && (
        <p className="text-sm text-zinc-500">
          Select entries below to email them.
        </p>
      )}
      {preview.error && (
        <p className="text-sm text-red-600">
          {adminRefusalMessage(preview.error, "Unable to preview the email.")}
        </p>
      )}
      {preview.data && selectedIds.size > 0 && completeDraft(settledDraft) && (
        <EmailPreviewPanel
          preview={preview.data}
          includeClaimed={includeClaimed}
          problem={problem}
          warnings={emailWarnings({
            preview: preview.data,
            used,
            includeClaimed,
          })}
          signupLink={used.has(WaitlistEmailPlaceholder.SignupLink)}
          onSample={setSampleEntryId}
        />
      )}
      <EmailSendActions
        draft={draft}
        entryIds={entryIds}
        includeClaimed={includeClaimed}
        used={used}
        preview={current}
        blocked={problem !== null}
        onSent={onSent}
      />
    </section>
  );
};

export default EmailComposer;
