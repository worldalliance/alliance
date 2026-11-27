import { WaitlistEmailPlaceholder } from "@alliance/common/waitlistEmail";
import type { WaitlistEmailPreviewDto } from "@alliance/shared/client/types.gen";
import { FlaskConical, Send } from "lucide-react";
import { useRef, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { countOf } from "../../lib/formatNumber";
import { notifyRealPeopleText } from "../../lib/notifyRealMembers";
import {
  useSendTestWaitlistEmailAdmin,
  useSendWaitlistEmailAdmin,
} from "../../lib/useWaitlistEmailsAdmin";
import { type EmailDraft, sendConfirmation } from "../../lib/waitlistEmail";
import Button, { ButtonVariant } from "../../ui/Button";
import ConfirmDialog from "../../ui/ConfirmDialog";
import InlineError from "../../ui/InlineError";
import { useToast } from "../../ui/ToastProvider";

type ConfirmingSend = {
  mobilize: boolean;
  recipients: number;
  requestId: string;
  entryIds: number[];
  message: string;
};

/** `send()` in `waitlist-email.service.ts` starts the sender at once, and no endpoint stops it. */
const NO_UNDO = "Sending starts at once and can't be stopped or undone.";

/**
 * Send a test to yourself, or send to the selection, each after a
 * confirmation that says who gets what. Sending waits for a preview of the
 * current draft and selection, and nothing blocking.
 */
export function EmailSendActions({
  draft,
  entryIds,
  includeClaimed,
  used,
  preview,
  blocked,
  onSent,
}: {
  draft: EmailDraft;
  entryIds: number[];
  includeClaimed: boolean;
  used: ReadonlySet<WaitlistEmailPlaceholder>;
  /** Null until a preview matches the draft and selection. */
  preview: WaitlistEmailPreviewDto | null;
  blocked: boolean;
  onSent: () => void;
}) {
  const { success } = useToast();
  const [testing, setTesting] = useState<{
    entryId: number;
    name: string;
  } | null>(null);
  const [sending, setSending] = useState<ConfirmingSend | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  // Retrying a send reuses its request id, so a send that went through before
  // its answer was lost isn't made twice.
  const requestIds = useRef(new Map<string, string>());

  const sendTest = useSendTestWaitlistEmailAdmin({
    onSuccess: () => success("Test email sent to you"),
    onError: (err) =>
      setRefusal(adminRefusalMessage(err, "Couldn't send the test email.")),
    onSettled: () => setTesting(null),
  });
  const send = useSendWaitlistEmailAdmin({
    onSuccess: (recipients) => {
      success(
        `Sending to ${countOf(recipients, "recipient")}. Follow it in the Emails tab.`,
      );
      onSent();
    },
    onError: (err) =>
      setRefusal(adminRefusalMessage(err, "Couldn't send the email.")),
    onSettled: () => setSending(null),
  });

  const confirmSend = (mobilize: boolean) => {
    if (!preview) return;
    const attempt = JSON.stringify({
      draft,
      entryIds: [...entryIds].sort((a, b) => a - b),
      includeClaimed,
      mobilize,
    });
    const requestId = requestIds.current.get(attempt) ?? crypto.randomUUID();
    requestIds.current.set(attempt, requestId);
    setRefusal(null);
    setSending({
      mobilize,
      recipients: preview.recipientIds.length,
      requestId,
      entryIds,
      message: `${sendConfirmation({
        preview,
        used,
        includeClaimed,
        subject: draft.subject.trim(),
        mobilize,
      })}\n\n${NO_UNDO}`,
    });
  };

  const sample = preview?.sample;
  const holdReason = !preview
    ? "Sending waits for an up-to-date preview."
    : blocked
      ? "Sending is off until the preview's problem is fixed."
      : null;
  const sendDisabled = holdReason !== null || send.isPending;

  return (
    <footer className="flex flex-col gap-2 border-t border-line pt-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          variant={ButtonVariant.Ghost}
          disabled={!sample?.html || sendTest.isPending}
          onClick={() => {
            setRefusal(null);
            if (sample)
              setTesting({ entryId: sample.entryId, name: sample.name });
          }}
        >
          <FlaskConical aria-hidden="true" className="size-4" />
          Send test to me
        </Button>
        <p className="ml-auto min-h-lh text-caption text-fg-muted">
          {holdReason}
        </p>
        <Button
          variant={ButtonVariant.Default}
          disabled={sendDisabled}
          onClick={() => confirmSend(false)}
        >
          Send email
        </Button>
        <Button
          variant={ButtonVariant.Primary}
          disabled={sendDisabled}
          onClick={() => confirmSend(true)}
        >
          <Send aria-hidden="true" className="size-4" />
          Send email and mark as mobilized
        </Button>
      </div>
      <InlineError message={refusal} className="justify-end" />
      <ConfirmDialog
        open={testing !== null}
        title="Send a test email to yourself?"
        message={`Sends this email to your own address, filled in with ${testing?.name}'s details${used.has(WaitlistEmailPlaceholder.SignupLink) ? ", a sample signup link," : ""} and a sample unsubscribe link.`}
        confirmLabel="Send test"
        busy={sendTest.isPending}
        onConfirm={() =>
          testing && sendTest.mutate({ ...draft, entryId: testing.entryId })
        }
        onCancel={() => setTesting(null)}
      />
      <ConfirmDialog
        open={sending !== null}
        title={
          sending?.mobilize
            ? "Send this email and mark as mobilized?"
            : "Send this email?"
        }
        message={sending?.message}
        requiredText={notifyRealPeopleText(sending?.recipients ?? 0)}
        confirmLabel={
          sending?.mobilize
            ? "Send and mark mobilized"
            : `Send to ${countOf(sending?.recipients ?? 0, "recipient")}`
        }
        busy={send.isPending}
        onConfirm={() =>
          sending &&
          send.mutate({
            email: {
              ...draft,
              entryIds: sending.entryIds,
              includeClaimed,
              mobilize: sending.mobilize,
              requestId: sending.requestId,
            },
            recipients: sending.recipients,
          })
        }
        onCancel={() => setSending(null)}
      />
    </footer>
  );
}
