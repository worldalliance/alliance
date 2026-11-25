import type {
  WaitlistEntryFilterDto,
  WaitlistNamedRefDto,
} from "@alliance/shared/client/types.gen";
import { useId, type ReactNode } from "react";
import { formatDate } from "../../lib/formatDate";
import { countOf, formatCount } from "../../lib/formatNumber";
import { useWaitlistEntryMetricsAdmin } from "../../lib/useWaitlistEntriesAdmin";
import { cn } from "../../ui/cn";
import { Skeleton } from "../../ui/Skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { Panel, PanelNote, PanelStat } from "../../ui/templates/Overview";
import { ContentState, RefreshFailedBanner } from "../../ui/templates/States";

const share = (part: number, whole: number) =>
  `${formatCount(part)} of ${formatCount(whole)}${whole ? ` (${Math.round((part / whole) * 100)}%)` : ""}`;

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

type Column = { label: string; numeric?: boolean };

function MetricsTable({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: Column[];
  rows: ReactNode[][];
}) {
  const titleId = useId();
  return (
    <div className="flex flex-col gap-2">
      <h3 id={titleId} className="font-semibold">
        {title}
      </h3>
      {rows.length === 0 ? (
        <PanelNote>None for these filters.</PanelNote>
      ) : (
        <div className="overflow-x-auto rounded-md border border-line">
          <Table aria-labelledby={titleId}>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead
                    key={column.label}
                    className={cn(column.numeric && "text-right")}
                  >
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((cells, row) => (
                <TableRow key={row}>
                  {cells.map((cell, index) => (
                    <TableCell
                      key={index}
                      className={cn(
                        columns[index].numeric && "text-right tabular-nums",
                      )}
                    >
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/** Counts and rates for the entries the filters match. */
export function MetricsPanel({ filter }: { filter: WaitlistEntryFilterDto }) {
  const metrics = useWaitlistEntryMetricsAdmin(filter);
  const data = metrics.data;

  return (
    <Panel
      title="Metrics"
      description={
        data
          ? `For the ${countOf(data.status.entries, "entry")} the filters match`
          : undefined
      }
    >
      <ContentState
        things="the metrics"
        query={metrics}
        refreshBanner={false}
        skeleton={
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        }
      >
        {data && (
          <div
            aria-busy={metrics.isPlaceholderData || undefined}
            className={cn(
              "flex flex-col gap-5 transition-opacity duration-base",
              metrics.isPlaceholderData && "opacity-60",
            )}
          >
            <RefreshFailedBanner things="the metrics" query={metrics} inline />
            <p className="text-fg-muted">
              An invite claim is an account created through one of their
              invites, forwarded or replaced ones included; signups through
              other links aren't tracked.
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 @3xl:grid-cols-4">
              <PanelStat
                label="Waiting"
                value={formatCount(data.status.waiting)}
              />
              <PanelStat
                label="Mobilized"
                value={formatCount(data.status.mobilized)}
              />
              <PanelStat
                label="Invite claimed"
                value={share(data.status.inviteClaimed, data.status.entries)}
              />
              <PanelStat
                label="Invite claims"
                value={formatCount(data.status.inviteClaims)}
              />
              <PanelStat
                label="Emailed an invite"
                value={formatCount(data.inviteEmails.emailed)}
              />
              <PanelStat
                label="Emailed, then claimed"
                value={share(
                  data.inviteEmails.claimed,
                  data.inviteEmails.emailed,
                )}
              />
              <PanelStat
                label="Median email to claim"
                value={
                  data.inviteEmails.medianSecondsToClaim === null
                    ? "—"
                    : `${formatElapsed(data.inviteEmails.medianSecondsToClaim)} (of ${countOf(data.inviteEmails.timedClaims, "entry")})`
                }
              />
            </div>
            <MetricsTable
              title="By source"
              columns={[
                { label: "Organization" },
                { label: "Channel" },
                { label: "Published" },
                { label: "Entries", numeric: true },
                { label: "Claims", numeric: true },
              ]}
              rows={data.sources.map((source) => [
                nameOr(source.organization, "No organization"),
                source.link?.channel ?? "—",
                source.link?.publishedAt
                  ? formatDate(source.link.publishedAt)
                  : "—",
                formatCount(source.entries),
                formatCount(source.claims),
              ])}
            />
            <MetricsTable
              title="By week (UTC, from Monday)"
              columns={[
                { label: "Week of" },
                { label: "Entries", numeric: true },
                { label: "Claims", numeric: true },
              ]}
              rows={data.weeks.map((week) => [
                formatDate(week.weekStart, { timeZone: "UTC" }),
                formatCount(week.entries),
                formatCount(week.claims),
              ])}
            />
            <MetricsTable
              title="Claimed invites, by destination group"
              columns={[
                { label: "Organization" },
                { label: "Group" },
                { label: "Claims", numeric: true },
                { label: "Contract signed", numeric: true },
                { label: "First task", numeric: true },
              ]}
              rows={data.conversions.map((conversion) => [
                nameOr(conversion.organization, "No organization"),
                nameOr(conversion.group, "Unassigned"),
                formatCount(conversion.claims),
                share(conversion.contractSigned, conversion.claims),
                share(conversion.firstAction, conversion.claims),
              ])}
            />
          </div>
        )}
      </ContentState>
    </Panel>
  );
}
