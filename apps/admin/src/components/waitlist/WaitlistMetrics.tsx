import { withCount } from "@alliance/common/plural";
import { waitlistAdminFindEntryMetricsAdmin } from "@alliance/shared/client";
import type {
  WaitlistEntryFilterDto,
  WaitlistNamedRefDto,
} from "@alliance/shared/client/types.gen";
import { formatMediumDateEnUS } from "@alliance/shared/lib/dateFormatters";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { cn } from "@alliance/shared/styles/util";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import React, { type ReactNode } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";

const share = (part: number, whole: number) =>
  `${part} of ${whole}${whole ? ` (${Math.round((part / whole) * 100)}%)` : ""}`;

const oneDecimal = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

export const formatElapsed = (seconds: number) => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(seconds / 360) / 10;
  if (hours < 48) return `${oneDecimal.format(hours)} h`;
  return `${oneDecimal.format(seconds / 86400)} days`;
};

const nameOr = (ref: WaitlistNamedRefDto | null, fallback: string) =>
  ref?.name ?? fallback;

const MetricsTable: React.FC<{
  caption: string;
  headers: string[];
  rows: ReactNode[][];
}> = ({ caption, headers, rows }) =>
  rows.length === 0 ? (
    <p className="text-zinc-500">
      <span className="font-semibold text-zinc-800">{caption}:</span> none
    </p>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="text-left font-semibold text-zinc-800 pb-1">
          {caption}
        </caption>
        <thead className="bg-zinc-100 text-left">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 font-medium text-zinc-600">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((cells, row) => (
            <tr key={row}>
              {cells.map((cell, column) => (
                <td key={column} className="px-3 py-2 text-zinc-800">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

const Stat: React.FC<{ label: string; value: ReactNode }> = ({
  label,
  value,
}) => (
  <div>
    <dt className="text-zinc-500">{label}</dt>
    <dd className="font-medium text-zinc-900">{value}</dd>
  </div>
);

type WaitlistMetricsProps = { filter: WaitlistEntryFilterDto };

const WaitlistMetrics: React.FC<WaitlistMetricsProps> = ({ filter }) => {
  const metrics = useQuery({
    queryKey: queryKeys.waitlistEntryMetricsAdmin(filter),
    queryFn: () =>
      waitlistAdminFindEntryMetricsAdmin({
        body: { filter },
        throwOnError: true,
      }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  if (metrics.error) {
    return (
      <p className="text-sm text-red-500">
        {adminRefusalMessage(metrics.error, "Unable to load the metrics.")}
      </p>
    );
  }
  if (!metrics.data) {
    return <p className="text-sm text-zinc-500">Loading metrics…</p>;
  }
  const { status, inviteEmails, weeks, sources, conversions } = metrics.data;

  return (
    <section
      aria-label="Metrics"
      className={cn(
        "border border-zinc-200 rounded-lg bg-white p-4 space-y-4 text-sm",
        metrics.isPlaceholderData && "opacity-60",
      )}
    >
      <p className="text-zinc-500">
        For the {withCount(status.entries, "entry")} matching the filter. An
        invite claim is an account created through one of their invites,
        forwarded or replaced ones included; signups through other links
        aren&rsquo;t tracked.
      </p>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Waiting" value={status.waiting} />
        <Stat label="Mobilized" value={status.mobilized} />
        <Stat
          label="Invite claimed"
          value={share(status.inviteClaimed, status.entries)}
        />
        <Stat label="Invite claims" value={status.inviteClaims} />
        <Stat label="Emailed an invite" value={inviteEmails.emailed} />
        <Stat
          label="Emailed, then claimed"
          value={share(inviteEmails.claimed, inviteEmails.emailed)}
        />
        <Stat
          label="Median email to claim"
          value={
            inviteEmails.medianSecondsToClaim === null
              ? "—"
              : `${formatElapsed(inviteEmails.medianSecondsToClaim)} (of ${withCount(inviteEmails.timedClaims, "entry")})`
          }
        />
      </dl>

      <MetricsTable
        caption="By source"
        headers={["Organization", "Channel", "Published", "Entries", "Claims"]}
        rows={sources.map((source) => [
          nameOr(source.organization, "No organization"),
          source.link?.channel ?? "—",
          source.link?.publishedAt
            ? formatMediumDateEnUS(new Date(source.link.publishedAt))
            : "—",
          source.entries,
          source.claims,
        ])}
      />

      <MetricsTable
        caption="By week (UTC, from Monday)"
        headers={["Week of", "Entries", "Claims"]}
        rows={weeks.map((week) => [week.weekStart, week.entries, week.claims])}
      />

      <MetricsTable
        caption="Claimed invites, by destination group"
        headers={[
          "Organization",
          "Group",
          "Claims",
          "Contract signed",
          "First action",
        ]}
        rows={conversions.map((conversion) => [
          nameOr(conversion.organization, "No organization"),
          nameOr(conversion.group, "Unassigned"),
          conversion.claims,
          share(conversion.contractSigned, conversion.claims),
          share(conversion.firstAction, conversion.claims),
        ])}
      />
    </section>
  );
};

export default WaitlistMetrics;
