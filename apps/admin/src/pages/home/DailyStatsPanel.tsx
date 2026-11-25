import { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatDate } from "../../lib/formatDate";
import { formatCount } from "../../lib/formatNumber";
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
  TableSkeleton,
} from "../../ui/templates/States";
import { countLabel, invalidRangeMessage, lastDays } from "./homeRules";

// Tasks completed and members signed are each day's running total, not that day's count.
const COLUMNS = [
  "Tasks completed (total)",
  "Anonymous forms",
  "Members signed (total)",
  "Invites created",
  "Invites accepted",
  "Suspended",
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
      description={daily.data ? countLabel(days.length, "day") : undefined}
      flush
      className={className}
    >
      <form
        noValidate
        className="border-b border-line p-card"
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
      </form>
      <ContentState
        loading={daily.isPending}
        skeleton={<TableSkeleton columns={COLUMNS.length + 1} rows={6} />}
        error={
          daily.isLoadingError
            ? adminRefusalMessage(daily.error, LOAD_FAILED_FALLBACK)
            : null
        }
        errorTitle="Couldn't load daily stats"
        onRetry={() => void daily.refetch()}
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
