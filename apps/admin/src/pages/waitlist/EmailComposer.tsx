import {
  findWaitlistEmailPlaceholders,
  WaitlistEmailPlaceholder,
  waitlistEmailToken,
} from "@alliance/common/waitlistEmail";
import { type Ref, useEffect, useLayoutEffect, useRef, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatCount } from "../../lib/formatNumber";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import { useWaitlistEmailPreviewAdmin } from "../../lib/useWaitlistEmailsAdmin";
import {
  blockingProblem,
  completeDraft,
  type EmailDraft,
  emailWarnings,
} from "../../lib/waitlistEmail";
import Button, { ButtonVariant } from "../../ui/Button";
import InlineError from "../../ui/InlineError";
import { Input } from "../../ui/Input";
import { Textarea } from "../../ui/Textarea";
import { CheckboxField, Field } from "../../ui/templates/Form";
import { Panel, PanelNote } from "../../ui/templates/Overview";
import { EmailPreview } from "./EmailPreview";
import { EmailSendActions } from "./EmailSendActions";
import { EmailTemplateControls } from "./EmailTemplateControls";

const PREVIEW_DELAY_MS = 400;

/**
 * Writes an email to the selected entries, previews it per recipient, and
 * sends it. The selection stays editable in the list while it is open.
 */
export function EmailComposer({
  ref,
  subjectRef,
  selectedIds,
  draft,
  onDraftChange,
  onClose,
  onSent,
}: {
  ref?: Ref<HTMLDivElement>;
  subjectRef?: Ref<HTMLInputElement>;
  selectedIds: ReadonlySet<number>;
  draft: EmailDraft;
  onDraftChange: (draft: EmailDraft) => void;
  onClose: () => void;
  onSent: () => void;
}) {
  const confirm = useConfirmOnPage();
  const [settledDraft, setSettledDraft] = useState(draft);
  const [includeClaimed, setIncludeClaimed] = useState(false);
  const [sampleEntryId, setSampleEntryId] = useState<number>();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const caretAfterInsert = useRef<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSettledDraft(draft), PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft]);

  const { used, unknown } = findWaitlistEmailPlaceholders([
    draft.subject,
    draft.body,
  ]);
  const entryIds = [...selectedIds];
  const previewable = entryIds.length > 0 && completeDraft(settledDraft);
  const preview = useWaitlistEmailPreviewAdmin(
    { ...settledDraft, entryIds, includeClaimed, sampleEntryId },
    { enabled: previewable },
  );
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
    onDraftChange({
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

  const discard = async () => {
    if (draft.subject.trim() || draft.body.trim()) {
      const ok = await confirm({
        title: "Discard this email?",
        message: "Closes the composer and discards this subject and body.",
        confirmLabel: "Discard",
        destructive: true,
      });
      if (!ok) return;
    }
    onClose();
  };

  return (
    <div
      ref={ref}
      // The bulk bar clears the selection, the email's audience, on Escape.
      // Menus and dialogs in here still close on Escape.
      onKeyDown={(event) => {
        if (event.key === "Escape") event.preventDefault();
      }}
    >
      <Panel
        title={`Email ${formatCount(selectedIds.size)} selected`}
        action={
          <Button
            size="small"
            variant={ButtonVariant.Ghost}
            onClick={() => void discard()}
          >
            Discard email
          </Button>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="grid gap-section @5xl:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-4">
              <EmailTemplateControls draft={draft} onLoad={onDraftChange} />
              <Field label="Subject">
                {(control) => (
                  <Input
                    {...control}
                    ref={subjectRef}
                    maxLength={200}
                    className="h-control"
                    value={draft.subject}
                    onChange={(event) =>
                      onDraftChange({ ...draft, subject: event.target.value })
                    }
                  />
                )}
              </Field>
              <Field
                label="Body"
                help="Markdown. Placeholders fill in for each recipient."
              >
                {(control) => (
                  <Textarea
                    {...control}
                    ref={bodyRef}
                    rows={12}
                    maxLength={20000}
                    value={draft.body}
                    onChange={(event) =>
                      onDraftChange({ ...draft, body: event.target.value })
                    }
                  />
                )}
              </Field>
              <div
                role="group"
                aria-label="Insert a placeholder"
                className="flex flex-wrap items-center gap-2"
              >
                <span className="text-fg-muted">Insert</span>
                {Object.values(WaitlistEmailPlaceholder).map((placeholder) => (
                  <Button
                    key={placeholder}
                    size="small"
                    variant={ButtonVariant.Default}
                    className="font-mono text-xs"
                    onClick={() => insert(placeholder)}
                  >
                    {waitlistEmailToken(placeholder)}
                  </Button>
                ))}
              </div>
              <InlineError
                message={
                  unknown.length > 0
                    ? `Unknown placeholders: ${unknown.join(", ")}`
                    : null
                }
              />
              <CheckboxField
                label="Include people who already claimed an invite"
                help="They're skipped unless this is on."
                checked={includeClaimed}
                onChange={(event) => setIncludeClaimed(event.target.checked)}
              />
            </div>
            <section
              aria-label="Preview"
              className="flex min-w-0 flex-col gap-3 rounded-md bg-surface-2 p-card"
            >
              {selectedIds.size === 0 ? (
                <PanelNote>Select entries in the list to email them.</PanelNote>
              ) : preview.isError ? (
                <InlineError
                  message={adminRefusalMessage(
                    preview.error,
                    "Couldn't preview the email.",
                  )}
                />
              ) : preview.data && previewable ? (
                <EmailPreview
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
              ) : (
                <PanelNote>
                  {previewable
                    ? "Previewing…"
                    : "Write a subject and body to preview the email."}
                </PanelNote>
              )}
            </section>
          </div>
          <EmailSendActions
            draft={draft}
            entryIds={entryIds}
            includeClaimed={includeClaimed}
            used={used}
            preview={current}
            blocked={problem !== null}
            onSent={onSent}
          />
        </div>
      </Panel>
    </div>
  );
}
