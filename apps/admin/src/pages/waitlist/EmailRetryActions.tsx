import { pickForCount } from "@alliance/common/plural";
import type { WaitlistEmailBatchDto } from "@alliance/shared/client/types.gen";
import { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { countOf } from "../../lib/formatNumber";
import { useRetryWaitlistEmailAdmin } from "../../lib/useWaitlistEmailsAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import ConfirmDialog from "../../ui/ConfirmDialog";
import InlineError from "../../ui/InlineError";
import { useToast } from "../../ui/ToastProvider";

/**
 * Queues failed recipients again, and uncertain ones only when asked, since
 * the mail server may already have taken theirs (`retry()` in
 * `waitlist-email.service.ts`). Renders nothing when neither is left.
 */
export function EmailRetryActions({ batch }: { batch: WaitlistEmailBatchDto }) {
  const { success } = useToast();
  const [retrying, setRetrying] = useState<{
    includeUncertain: boolean;
  } | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  const retry = useRetryWaitlistEmailAdmin(batch.id, {
    onSuccess: () => success("Resending the email"),
    onError: (err) =>
      setRefusal(adminRefusalMessage(err, "Couldn't resend the email.")),
    onSettled: () => setRetrying(null),
  });

  const { failed, uncertain } = batch.counts;
  if (failed === 0 && uncertain === 0) return null;
  const resent = [
    failed > 0 ? countOf(failed, "failed recipient") : null,
    countOf(uncertain, "uncertain recipient"),
  ].filter((part) => part !== null);

  const open = (includeUncertain: boolean) => {
    setRefusal(null);
    setRetrying({ includeUncertain });
  };

  return (
    <>
      {failed > 0 && (
        <Button
          size="small"
          variant={ButtonVariant.Default}
          busy={retry.isPending && retrying?.includeUncertain === false}
          onClick={() => open(false)}
        >
          Retry {countOf(failed, "failed recipient")}
        </Button>
      )}
      {uncertain > 0 && (
        <Button
          size="small"
          variant={ButtonVariant.Default}
          busy={retry.isPending && retrying?.includeUncertain === true}
          onClick={() => open(true)}
        >
          {failed > 0 ? "Resend failed and uncertain" : "Resend uncertain"}
        </Button>
      )}
      <InlineError message={refusal} />
      <ConfirmDialog
        open={retrying !== null}
        title="Resend this email?"
        message={
          retrying?.includeUncertain
            ? `Resends to ${resent.join(" and ")}. The mail server may already have taken ${pickForCount(uncertain, "the uncertain one", "the uncertain ones")}, so they could get it twice.`
            : `Resends to ${countOf(failed, "recipient")} whose email failed. Recipients it reached don't get it again.`
        }
        confirmLabel="Resend"
        busy={retry.isPending}
        onConfirm={() => retrying && retry.mutate(retrying.includeUncertain)}
        onCancel={() => setRetrying(null)}
      />
    </>
  );
}
