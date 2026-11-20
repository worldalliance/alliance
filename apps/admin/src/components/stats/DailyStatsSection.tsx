import { dateToInputValue } from "@alliance/shared/lib/dateInput";
import React, { useMemo, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useDailyStatsAdmin } from "../../lib/useDailyStatsAdmin";
import { fullDateFormatter } from "../TimeSeriesChart";
import { secondaryButtonClass } from "../ui/controlStyles";
import DateRangeInputs, { type DateRange } from "../ui/DateRangeInputs";
import Section from "../ui/Section";

const lastDays = (days: number): DateRange => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { start: dateToInputValue(start), end: dateToInputValue(end) };
};

const invalidRangeMessage = (range: DateRange): string | null => {
  const parsedStart = new Date(range.start);
  const parsedEnd = new Date(range.end);
  if (
    Number.isNaN(parsedStart.getTime()) ||
    Number.isNaN(parsedEnd.getTime())
  ) {
    return "Please provide valid start and end dates.";
  }
  if (parsedStart > parsedEnd) {
    return "Start date must be before the end date.";
  }
  return null;
};

const th = "px-3 py-2 text-left font-medium";
const td = "px-3 py-2 tabular-nums";

const DailyStatsSection: React.FC = () => {
  const [input, setInput] = useState(() => lastDays(30));
  const [queryRange, setQueryRange] = useState(input);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const {
    data: stats = [],
    isPending: loading,
    error: statsError,
  } = useDailyStatsAdmin(queryRange);
  const error =
    rangeError ??
    (statsError &&
      adminRefusalMessage(
        statsError,
        "Unable to load analytics right now. Please try again soon.",
      ));

  const days = useMemo(
    () =>
      stats
        .map((record) => ({ ...record, parsedDate: new Date(record.date) }))
        .filter((record) => !Number.isNaN(record.parsedDate.getTime()))
        .reverse(),
    [stats],
  );

  const applyQuick = (count: number) => {
    const range = lastDays(count);
    setInput(range);
    setRangeError(null);
    setQueryRange(range);
  };

  return (
    <Section
      title="Daily stats"
      meta={loading || statsError ? undefined : `${days.length} days`}
      actions={
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const invalid = invalidRangeMessage(input);
            setRangeError(invalid);
            if (!invalid) setQueryRange(input);
          }}
        >
          <DateRangeInputs value={input} onChange={setInput} />
          <button type="submit" className={secondaryButtonClass}>
            Apply
          </button>
          <button
            type="button"
            onClick={() => applyQuick(7)}
            className={secondaryButtonClass}
          >
            Last 7 days
          </button>
          <button
            type="button"
            onClick={() => applyQuick(30)}
            className={secondaryButtonClass}
          >
            Last 30 days
          </button>
        </form>
      }
    >
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {error}
        </p>
      )}
      {loading ? (
        <p className="text-sm text-zinc-600">Loading daily stats…</p>
      ) : days.length === 0 ? (
        !statsError && (
          <p className="text-sm text-zinc-600">
            No daily stats for this range.
          </p>
        )
      ) : (
        <div
          role="region"
          aria-label="Daily stats table"
          tabIndex={0}
          className="max-h-96 overflow-auto outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="sticky top-0 bg-zinc-50 text-zinc-600">
              <tr>
                <th className={th}>Date</th>
                <th className={th}>Actions completed</th>
                <th className={th}>Anon forms</th>
                <th className={th}>Members signed</th>
                <th className={th}>Invites created</th>
                <th className={th}>Invites accepted</th>
                <th className={th}>Suspended</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {days.map((day) => (
                <tr key={day.dayId}>
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-zinc-900">
                    {fullDateFormatter.format(day.parsedDate)}
                  </td>
                  <td className={td}>{day.actionsCompleted}</td>
                  <td className={td}>{day.anonFormSubmissions}</td>
                  <td className={td}>{day.signedMembers}</td>
                  <td className={td}>{day.invitesCreated}</td>
                  <td className={td}>{day.invitesAccepted}</td>
                  <td className={td}>{day.suspendedMembers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
};

export default DailyStatsSection;
