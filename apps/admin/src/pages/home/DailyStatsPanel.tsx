import { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatDate } from "../../lib/formatDate";
import { countOf, formatCount } from "../../lib/formatNumber";
import { useDailyStatsAdmin } from "../../lib/useDailyStatsAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import {
  DateRangeFields,
  Panel,
  PanelControls,
} from "../../ui/templates/Overview";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../ui/templates/States";
import { invalidRangeMessage, lastDays } from "./homeRules";

// Each day's row is a snapshot taken that morning: the four totals count
// everything up to then, the two member columns count members in that state then.
const COLUMNS = [
  "Tasks completed (total)",
  "Anonymous form responses (total)",
  "Active members",
  "Invites created (total)",
  "Invites accepted (total)",
  "Suspended members",
] as const;
const NUMBER = "text-right tabular-nums";

/**
 * Each day's snapshot, newest first. Its range drives this table only, so the
 * range sits inside the panel.
 */
export function DailyStatsPanel({ className }: { className?: string }) {
  const [input, setInput] = useState(() => lastDays(30));
  const [applied, setApplied] = useState(input);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const daily = useDailyStatsAdmin(applied);
  const days = (daily.data ?? []).filter(
    (day) => !Number.isNaN(new Date(day.date).getTime()),
  );

  const apply = () => {
    const invalid = invalidRangeMessage(input);
    setRangeError(invalid);
    if (!invalid) setApplied(input);
  };
  const applyLast = (count: number) => {
    const range = lastDays(count);
    setInput(range);
    setRangeError(null);
    setApplied(range);
  };

  return (
    <Panel
      title="Daily stats"
      description={daily.data ? countOf(days.length, "day") : undefined}
      flush
      className={className}
    >
      <form
        noValidate
        className="flex flex-col gap-4 border-b border-line p-card"
        onSubmit={(event) => {
          event.preventDefault();
          apply();
        }}
      >
        <PanelControls
          actions={
            <>
              <Button
                type="submit"
                variant={ButtonVariant.Default}
                size="small"
              >
                Update
              </Button>
              <Button
                variant={ButtonVariant.Default}
                size="small"
                onClick={() => applyLast(7)}
              >
                Last 7 days
              </Button>
              <Button
                variant={ButtonVariant.Default}
                size="small"
                onClick={() => applyLast(30)}
              >
                Last 30 days
              </Button>
            </>
          }
        >
          <DateRangeFields
            range={input}
            onChange={setInput}
            startLabel="Start date"
            endLabel="End date"
            error={rangeError}
          />
        </PanelControls>
        <RefreshFailedBanner inline things="daily stats" query={daily} />
      </form>
      <ContentState
        loading={daily.isPending}
        skeleton={
          <div className="h-96 overflow-hidden">
            <TableSkeleton columns={COLUMNS.length + 1} />
          </div>
        }
        error={
          daily.isLoadingError
            ? adminRefusalMessage(daily.error, LOAD_FAILED_FALLBACK)
            : null
        }
        errorTitle="Couldn't load daily stats"
        onRetry={() => void daily.refetch()}
        retrying={daily.isFetching}
        empty={days.length === 0}
        emptyTitle="No daily stats for this range"
      >
        <div className="max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                {COLUMNS.map((column) => (
                  <TableHead key={column} className="text-right">
                    {column}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...days].reverse().map((day) => (
                <TableRow key={day.dayId}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {formatDate(day.date)}
                  </TableCell>
                  <TableCell className={NUMBER}>
                    {formatCount(day.actionsCompleted)}
                  </TableCell>
                  <TableCell className={NUMBER}>
                    {formatCount(day.anonFormSubmissions)}
                  </TableCell>
                  <TableCell className={NUMBER}>
                    {formatCount(day.signedMembers)}
                  </TableCell>
                  <TableCell className={NUMBER}>
                    {formatCount(day.invitesCreated)}
                  </TableCell>
                  <TableCell className={NUMBER}>
                    {formatCount(day.invitesAccepted)}
                  </TableCell>
                  <TableCell className={NUMBER}>
                    {formatCount(day.suspendedMembers)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ContentState>
    </Panel>
  );
}
