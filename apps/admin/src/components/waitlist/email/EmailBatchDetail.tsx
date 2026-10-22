import type {
  WaitlistEmailBatchDto,
  WaitlistEmailSkipReason,
} from "@alliance/shared/client/types.gen";
import { formatDateTime } from "@alliance/shared/lib/dateFormatters";
import { CopyPlus } from "lucide-react";
import React from "react";
import { useNavigate } from "react-router";
import { adminRefusalMessage } from "../../../lib/adminRefusal";
import { useWaitlistEmailAdmin } from "../../../lib/useWaitlistEmailsAdmin";
import { waitlistContactLabel } from "../../../lib/waitlistContact";
import {
  type EmailDraft,
  emailDraftState,
  STATUS_LABELS,
} from "../../../lib/waitlistEmail";
import { BORDERED_ICON_BUTTON_CLASS } from "../controlClasses";
import EmailRetryActions from "./EmailRetryActions";

const SKIP_LABELS: Record<WaitlistEmailSkipReason, string> = {
  no_email: "Phone contact — no email address",
  unsubscribed: "Unsubscribed",
  invite_claimed: "Already claimed an invite",
  spam: "Marked or suspected as spam",
};

const EmailBatchDetail: React.FC<{ batch: WaitlistEmailBatchDto }> = ({
  batch,
}) => {
  const navigate = useNavigate();
  const detail = useWaitlistEmailAdmin(batch.id);
  const draft: EmailDraft = { subject: batch.subject, body: batch.body };

  return (
    <div className="space-y-3 border-t border-zinc-100 bg-zinc-50 p-4 text-sm">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-label="Use again as a new draft"
          title="Use again as a new draft"
          className={BORDERED_ICON_BUTTON_CLASS}
          onClick={() =>
            navigate("/waitlist", { state: emailDraftState(draft) })
          }
        >
          <CopyPlus size={16} />
        </button>
        <EmailRetryActions batch={batch} />
      </div>
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
                  <span className="text-zinc-500">
                    {waitlistContactLabel(recipient)}
                  </span>
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
