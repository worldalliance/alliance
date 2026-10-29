import { withCount } from "@alliance/common/plural";
import { formatAwayReason } from "@alliance/shared/lib/awayRangesFormatters";
import DateTimePicker from "@alliance/sharedweb/ui/DateTimePicker";
import { TZDate } from "@date-fns/tz";
import { addDays, nextTuesday, set } from "date-fns";
import { useState } from "react";
import { href, Link } from "react-router";
import {
  inLaunchZone,
  LAUNCH_TIME_ZONE,
} from "../components/suite-launch/launchSchedule";
import { formatAwayRange } from "../components/UserAwayPeriodsSection";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { useAwayRangesInWindowAdmin } from "../lib/useAwayRangesInWindowAdmin";

/** Next Tuesday 7pm through the Tuesday after at 11:59pm, Pacific time. */
export const defaultAwayWindow = (now: Date) => {
  const tuesday = nextTuesday(new TZDate(now, LAUNCH_TIME_ZONE));
  const at = (day: Date, hours: number, minutes: number) =>
    new Date(
      set(day, { hours, minutes, seconds: 0, milliseconds: 0 }).getTime(),
    );
  return { from: at(tuesday, 19, 0), to: at(addDays(tuesday, 7), 23, 59) };
};

const AwayMembersPage = () => {
  const [awayWindow, setAwayWindow] = useState(() =>
    defaultAwayWindow(new Date()),
  );
  const validWindow = awayWindow.from < awayWindow.to;
  const ranges = useAwayRangesInWindowAdmin(awayWindow);
  const memberCount = new Set((ranges.data ?? []).map((r) => r.userId)).size;

  return (
    <div className="flex flex-col gap-4 p-5">
      <h1 className="text-xl font-semibold">Away members</h1>
      <div className="flex flex-wrap items-start gap-3 text-sm">
        {(["from", "to"] as const).map((end) => (
          <label key={end} className="flex flex-col gap-1">
            {end === "from" ? "From" : "Through"}
            <DateTimePicker
              value={awayWindow[end]}
              onChange={({ date }) =>
                date && setAwayWindow((prev) => ({ ...prev, [end]: date }))
              }
              inputClassName="rounded border border-zinc-300 px-2 py-1"
            />
            <span className="text-xs text-zinc-500">
              {inLaunchZone(awayWindow[end])}
            </span>
          </label>
        ))}
      </div>
      {!validWindow && (
        <p className="text-sm text-red-600">Pick a start before the end.</p>
      )}
      {ranges.isError && (
        <p role="alert" className="text-sm text-red-600">
          {adminRefusalMessage(ranges.error, "Couldn't load away periods.")}
        </p>
      )}
      {validWindow && ranges.data && (
        <>
          <p className="text-sm text-zinc-600">
            {withCount(memberCount, "member")} away at some point in this
            window.
          </p>
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="py-1 pr-4 font-medium">Member</th>
                <th className="py-1 pr-4 font-medium">Away</th>
                <th className="py-1 pr-4 font-medium">Reason</th>
                <th className="py-1 font-medium">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {ranges.data.map((range) => (
                <tr key={range.id}>
                  <td className="py-2 pr-4">
                    <Link
                      to={href("/member/:userId", {
                        userId: String(range.userId),
                      })}
                      className="text-blue-600 hover:underline"
                    >
                      {range.userName}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">{formatAwayRange(range)}</td>
                  <td className="py-2 pr-4">
                    {formatAwayReason(range.reason)}
                  </td>
                  <td className="py-2 text-zinc-600">{range.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

export default AwayMembersPage;
