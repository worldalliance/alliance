import { waitlistEmailAdminFindEmailsAdmin } from "@alliance/shared/client";
import { formatDateTime } from "@alliance/shared/lib/dateFormatters";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import React, { useState } from "react";
import EmailBatchDetail from "../components/waitlist/email/EmailBatchDetail";
import { adminRefusalMessage } from "../lib/adminRefusal";
import {
  inProgress,
  SENDING_POLL_MS,
  STATUS_LABELS,
  STATUSES,
} from "../lib/waitlistEmail";

const WaitlistEmailsPage: React.FC = () => {
  const [openId, setOpenId] = useState<number | null>(null);
  const emails = useQuery({
    queryKey: queryKeys.waitlistEmailsAdmin(),
    queryFn: () =>
      waitlistEmailAdminFindEmailsAdmin({ throwOnError: true }).then(
        (r) => r.data,
      ),
    refetchInterval: (query) =>
      query.state.data?.some(inProgress) ? SENDING_POLL_MS : false,
  });

  return (
    <div className="space-y-4 p-5">
      <title>Waitlist emails - Admin</title>
      <h1 className="text-lg font-bold text-zinc-900">Waitlist emails</h1>
      {emails.isPending && <p className="text-sm text-zinc-500">Loading…</p>}
      {emails.error && (
        <p className="text-sm text-red-500">
          {adminRefusalMessage(emails.error, "Unable to load emails.")}
        </p>
      )}
      {emails.data?.length === 0 && (
        <p className="text-sm text-zinc-500">
          No emails yet. Send one from the waitlist.
        </p>
      )}
      {emails.data && emails.data.length > 0 && (
        <ul className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          {emails.data.map((batch) => {
            const open = openId === batch.id;
            return (
              <li key={batch.id} className="border-b border-zinc-100">
                <button
                  type="button"
                  aria-expanded={open}
                  className="flex w-full items-start gap-2 p-3 text-left text-sm hover:bg-zinc-50"
                  onClick={() => setOpenId(open ? null : batch.id)}
                >
                  {open ? (
                    <ChevronDown size={16} className="mt-0.5" />
                  ) : (
                    <ChevronRight size={16} className="mt-0.5" />
                  )}
                  <span className="flex-1">
                    <span className="font-medium text-zinc-900">
                      {batch.subject}
                    </span>
                    <span className="block text-zinc-500">
                      {formatDateTime(new Date(batch.createdAt))}
                      {batch.staffName && ` · ${batch.staffName}`}
                      {batch.mobilize && " · Marks mobilized"}
                    </span>
                  </span>
                  <span className="text-zinc-600">
                    {STATUSES.filter((status) => batch.counts[status] > 0)
                      .map(
                        (status) =>
                          `${STATUS_LABELS[status]} ${batch.counts[status]}`,
                      )
                      .join(" · ")}
                  </span>
                </button>
                {open && <EmailBatchDetail batch={batch} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default WaitlistEmailsPage;
