import { pickForCount } from "@alliance/common/plural";
import { TZDate } from "@date-fns/tz";
import { addDays, formatDistanceStrict } from "date-fns";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import { COMPLETION_PERIOD_DAYS, type LaunchSchedule } from "./launchSchedule";
import { MAX_MEMBER_MINUTES, type MemberLoad } from "./memberLoad";

export const overloadedMembers = (loads: MemberLoad[]) =>
  loads.filter((load) => load.minutes > MAX_MEMBER_MINUTES);

/** Ways the launch would break the member contract's 15-minute blocks or 7-day completion period. */
export function contractViolations(params: {
  loads: MemberLoad[];
  schedule: LaunchSchedule;
}): string[] {
  const { loads, schedule } = params;
  const violations: string[] = [];
  const overloaded = overloadedMembers(loads);
  if (overloaded.length > 0) {
    violations.push(
      `${overloaded.length} ${pickForCount(overloaded.length, "member is", "members are")} assigned more than ${MAX_MEMBER_MINUTES} minutes. The contract assigns tasks in ${MAX_MEMBER_MINUTES}-minute blocks.`,
    );
  }
  const { memberActionAt, officeActionAt } = schedule;
  // Days by Pacific wall-clock time, so the default 11:59pm deadline a period
  // out holds across a daylight saving change.
  const periodEnd = addDays(
    new TZDate(memberActionAt, LAUNCH_TIME_ZONE),
    COMPLETION_PERIOD_DAYS,
  );
  if (officeActionAt > memberActionAt && officeActionAt < periodEnd) {
    violations.push(
      `Members get ${formatDistanceStrict(schedule.memberActionAt, schedule.officeActionAt)} to finish. The contract promises a ${COMPLETION_PERIOD_DAYS}-day completion period.`,
    );
  }
  return violations;
}
