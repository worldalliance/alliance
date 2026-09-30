import { waitlistEmailAdminFindEmailAdmin } from "@alliance/shared/client";
import type {
  WaitlistEmailBatchDto,
  WaitlistEmailSkipReason,
} from "@alliance/shared/client/types.gen";
import { formatDateTime } from "@alliance/shared/lib/dateFormatters";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { adminRefusalMessage } from "../../../lib/adminRefusal";
import {
  inProgress,
  SENDING_POLL_MS,
  STATUS_LABELS,
} from "../../../lib/waitlistEmail";
import EmailRetryActions from "./EmailRetryActions";

const SKIP_LABELS: Record<WaitlistEmailSkipReason, string> = {
  unsubscribed: "Unsubscribed",
  invite_claimed: "Already claimed an invite",
};

const EmailBatchDetail: React.FC<{ batch: WaitlistEmailBatchDto }> = ({
  batch,
}) => {
  const detail = useQuery({
    queryKey: queryKeys.waitlistEmailAdmin(batch.id),
    queryFn: () =>
      waitlistEmailAdminFindEmailAdmin({
        path: { id: batch.id },
        throwOnError: true,
      }).then((r) => r.data),
    refetchInterval: (query) =>
      query.state.data && inProgress(query.state.data)
        ? SENDING_POLL_MS
        : false,
  });

  return (
    <div className="space-y-3 border-t border-zinc-100 bg-zinc-50 p-4 text-sm">
      <EmailRetryActions batch={batch} />
      <pre className="whitespace-pre-wrap rounded border border-zinc-200 bg-white p-2 font-sans">
        {batch.body}
      </pre>
      {detail.isPending && <p className="text-zinc-500">Loading…</p>}
      {detail.error && (
        <p className="text-red-600">
          {adminRefusalMessage(detail.error, "Unable to load recipients.")}
        </p>
      )}
      {detail.data && (
        <table className="w-full text-left">
          <thead className="text-zinc-500">
            <tr>
              <th className="py-1 font-medium">Recipient</th>
              <th className="py-1 font-medium">Status</th>
              <th className="py-1 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {detail.data.recipients.map((recipient) => (
              <tr key={recipient.id} className="border-t border-zinc-200">
                <td className="py-1">
                  {recipient.name}{" "}
                  <span className="text-zinc-500">{recipient.email}</span>
                </td>
                <td className="py-1">{STATUS_LABELS[recipient.status]}</td>
                <td className="py-1 text-zinc-600">
                  {recipient.skipReason
                    ? SKIP_LABELS[recipient.skipReason]
                    : recipient.acceptedAt
                      ? `Sent ${formatDateTime(new Date(recipient.acceptedAt))}`
                      : recipient.error}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default EmailBatchDetail;
