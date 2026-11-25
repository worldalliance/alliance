import type { MemberAwayRangeDto } from "@alliance/shared/client/types.gen";
import { formatAwayReason } from "@alliance/shared/lib/awayRangesFormatters";
import { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { countOf } from "../../lib/formatNumber";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import { useAwayRangesInWindowAdmin } from "../../lib/useAwayRangesInWindowAdmin";
import { cn } from "../../ui/cn";
import DateTimePicker, { timeZoneLabel } from "../../ui/DateTimePicker";
import InlineError from "../../ui/InlineError";
import { PersonCell } from "../../ui/PersonCell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { FilterBar, ListContent } from "../../ui/templates/List";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../ui/templates/States";
import { formatAwayRange } from "./awayRange";
import { type AwayWindow, useAwayWindow } from "./awayWindow";

const ZONE = timeZoneLabel(LAUNCH_TIME_ZONE);
const END_LABELS: Record<keyof AwayWindow, string> = {
  from: "From",
  to: "Through",
};

/** Members away at any point in a window, each of their periods a row. */
export function AwayTab() {
  const [now] = useState(() => new Date());
  const { window, setEnd } = useAwayWindow(now);
  const valid = window.from < window.to;
  const ranges = useAwayRangesInWindowAdmin(window, { keepPrevious: true });
  // The previous window's rows stay in place, dimmed, until the new window's land.
  const stale = ranges.isPlaceholderData;
  const members = new Set((ranges.data ?? []).map((range) => range.userId))
    .size;
  return (
    <>
      <RefreshFailedBanner things="away periods" query={ranges} />
      <FilterBar
        count={
          valid && ranges.data && !ranges.isLoadingError && !stale
            ? `${countOf(members, "member")} away at some point`
            : undefined
        }
      >
        {(["from", "to"] as const).map((end) => (
          <label key={end} className="flex items-center gap-2">
            <span className="text-fg-muted">{END_LABELS[end]}</span>
            <DateTimePicker
              aria-label={`${END_LABELS[end]} (${ZONE})`}
              timeZone={LAUNCH_TIME_ZONE}
              value={window[end]}
              aria-invalid={!valid || undefined}
              onChange={({ date }) => date && setEnd(end, date)}
              inputClassName="h-control-sm w-52"
            />
          </label>
        ))}
        <span className="text-caption text-fg-muted">{ZONE}</span>
        <InlineError message={valid ? null : "Pick a start before the end"} />
      </FilterBar>
      <ListContent>
        {valid && (
          <ContentState
            loading={ranges.isPending || (stale && ranges.data?.length === 0)}
            skeleton={<TableSkeleton bleed columns={4} />}
            error={
              ranges.isLoadingError
                ? adminRefusalMessage(ranges.error, LOAD_FAILED_FALLBACK)
                : null
            }
            errorTitle="Couldn't load away periods"
            onRetry={() => void ranges.refetch()}
            retrying={ranges.isFetching}
            empty={ranges.data?.length === 0}
            emptyTitle="Nobody is away in this window"
          >
            <div
              aria-busy={stale || undefined}
              className={cn(
                "transition-opacity duration-base",
                stale && "opacity-40",
              )}
            >
              <AwayTable ranges={ranges.data ?? []} />
            </div>
          </ContentState>
        )}
      </ListContent>
    </>
  );
}

function AwayTable({ ranges }: { ranges: readonly MemberAwayRangeDto[] }) {
  return (
    <Table bleed>
      <TableHeader>
        <TableRow>
          <TableHead>Member</TableHead>
          <TableHead>Away</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Note</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ranges.map((range) => (
          <TableRow key={range.id}>
            <PersonCell
              userId={range.userId}
              name={range.userName}
              profilePicture={null}
              firstColumn
            />
            <TableCell className="whitespace-nowrap">
              {formatAwayRange(range)}
            </TableCell>
            <TableCell>{formatAwayReason(range.reason)}</TableCell>
            <TableCell truncate className="text-fg-muted">
              {range.note || "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
