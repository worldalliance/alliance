import { withCount } from "@alliance/common/plural";
import { WaitlistEmailPlaceholder } from "@alliance/common/waitlistEmail";
import type { WaitlistEmailPreviewDto } from "@alliance/shared/client/types.gen";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import React, { useRef, useState } from "react";
import { useRefusalToast } from "../../../lib/useRefusalToast";
import {
  useSendTestWaitlistEmailAdmin,
  useSendWaitlistEmailAdmin,
} from "../../../lib/useWaitlistEmailsAdmin";
import { type EmailDraft, sendConfirmation } from "../../../lib/waitlistEmail";
import ConfirmDialog from "../../ConfirmDialog";

type ConfirmingSend = {
  mobilize: boolean;
  recipients: number;
  requestId: string;
  entryIds: number[];
  message: string;
};

type EmailSendActionsProps = {
  draft: EmailDraft;
  entryIds: number[];
  includeClaimed: boolean;
  used: ReadonlySet<WaitlistEmailPlaceholder>;
  /** Null until a preview matches the draft and selection. */
  preview: WaitlistEmailPreviewDto | null;
  blocked: boolean;
  onSent: () => void;
};

const EmailSendActions: React.FC<EmailSendActionsProps> = ({
  draft,
  entryIds,
  includeClaimed,
  used,
  preview,
  blocked,
  onSent,
}) => {
  const refusalToast = useRefusalToast();
  const { success } = useToast();
  const [testing, setTesting] = useState<{
    entryId: number;
    name: string;
  } | null>(null);
  const [sending, setSending] = useState<ConfirmingSend | null>(null);
  // Retrying a send reuses its request id, so a send that went through before
  // its answer was lost isn't made twice.
  const requestIds = useRef(new Map<string, string>());

  const sendTest = useSendTestWaitlistEmailAdmin({
    onSuccess: () => success("Test email sent to you"),
    onError: (err) => refusalToast(err, "Could not send the test email."),
    onSettled: () => setTesting(null),
  });

  const send = useSendWaitlistEmailAdmin({
    onSuccess: (recipients) => {
      success(
        `Sending to ${withCount(recipients, "recipient")}. Follow it under Waitlist emails.`,
      );
      onSent();
    },
    onError: (err) => refusalToast(err, "Could not send the email."),
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
    setSending({
      mobilize,
      recipients: preview.recipientIds.length,
      requestId,
      entryIds,
      message: sendConfirmation({
        preview,
        used,
        includeClaimed,
        subject: draft.subject.trim(),
        mobilize,
      }),
    });
  };

  const disabled = !preview || blocked || send.isPending;
  const sample = preview?.sample;

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        color={ButtonColor.White}
        size="small"
        disabled={!sample?.html || sendTest.isPending}
        onClick={() =>
          sample && setTesting({ entryId: sample.entryId, name: sample.name })
        }
      >
        Send test to me
      </Button>
      <Button
        color={ButtonColor.White}
        size="small"
        disabled={disabled}
        onClick={() => confirmSend(false)}
      >
        Send email
      </Button>
      <Button
        color={ButtonColor.Black}
        size="small"
        disabled={disabled}
        onClick={() => confirmSend(true)}
      >
        Send email and mark as mobilized
      </Button>
      <ConfirmDialog
        isOpen={testing !== null}
        title="Send a test email to yourself?"
        message={`Sends this email to your own address, filled in with ${testing?.name}'s details${used.has(WaitlistEmailPlaceholder.SignupLink) ? ", a sample signup link," : ""} and a sample unsubscribe link.`}
        onConfirm={() =>
          testing && sendTest.mutate({ ...draft, entryId: testing.entryId })
        }
        onCancel={() => setTesting(null)}
        isLoading={sendTest.isPending}
      />
      <ConfirmDialog
        isOpen={sending !== null}
        title={
          sending?.mobilize
            ? "Send this email and mark as mobilized?"
            : "Send this email?"
        }
        message={sending?.message ?? ""}
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
        isLoading={send.isPending}
      />
    </div>
  );
};

export default EmailSendActions;
