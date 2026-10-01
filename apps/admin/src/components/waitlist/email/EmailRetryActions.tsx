import { pickForCount, withCount } from "@alliance/common/plural";
import { waitlistEmailAdminRetryEmailAdmin } from "@alliance/shared/client";
import type { WaitlistEmailBatchDto } from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { useRefusalToast } from "../../../lib/useRefusalToast";
import ConfirmDialog from "../../ConfirmDialog";

const EmailRetryActions: React.FC<{ batch: WaitlistEmailBatchDto }> = ({
  batch,
}) => {
  const queryClient = useQueryClient();
  const refusalToast = useRefusalToast();
  const { success } = useToast();
  const [retrying, setRetrying] = useState<{
    includeUncertain: boolean;
  } | null>(null);

  const retry = useMutation({
    mutationFn: (includeUncertain: boolean) =>
      waitlistEmailAdminRetryEmailAdmin({
        path: { id: batch.id },
        body: { includeUncertain },
        throwOnError: true,
      }),
    onSuccess: () => success("Resending the email"),
    onError: (err) => refusalToast(err, "Could not resend the email."),
    onSettled: async () => {
      setRetrying(null);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.waitlistEmailAdmin(batch.id),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.waitlistEmailsAdmin(),
        }),
      ]);
    },
  });

  const { failed, uncertain } = batch.counts;
  const resent = [
    failed > 0 ? withCount(failed, "failed recipient") : null,
    withCount(uncertain, "uncertain recipient"),
  ].filter((part) => part !== null);

  if (failed === 0 && uncertain === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {failed > 0 && (
        <Button
          color={ButtonColor.White}
          size="small"
          disabled={retry.isPending}
          onClick={() => setRetrying({ includeUncertain: false })}
        >
          Retry {withCount(failed, "failed recipient")}
        </Button>
      )}
      {uncertain > 0 && (
        <Button
          color={ButtonColor.White}
          size="small"
          disabled={retry.isPending}
          onClick={() => setRetrying({ includeUncertain: true })}
        >
          {failed > 0 ? "Resend failed and uncertain" : "Resend uncertain"}
        </Button>
      )}
      <ConfirmDialog
        isOpen={retrying !== null}
        title="Resend this email?"
        message={
          retrying?.includeUncertain
            ? `Resends to ${resent.join(" and ")}. The mail server may already have taken ${pickForCount(uncertain, "the uncertain one", "the uncertain ones")}, so they could get it twice.`
            : `Resends to ${withCount(failed, "recipient")} whose email failed. Recipients it reached don't get it again.`
        }
        onConfirm={() => retrying && retry.mutate(retrying.includeUncertain)}
        onCancel={() => setRetrying(null)}
        isLoading={retry.isPending}
      />
    </div>
  );
};

export default EmailRetryActions;
