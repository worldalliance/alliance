import { milliseconds } from "date-fns";
import { completionTime, type LaunchSchedule } from "./launchSchedule";
import { MAX_MEMBER_MINUTES, type MemberLoad } from "./memberLoad";

const COMPLETION_PERIOD_MS = milliseconds({ days: 7 });

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
      `${overloaded.length} ${overloaded.length === 1 ? "member is" : "members are"} assigned more than ${MAX_MEMBER_MINUTES} minutes. The contract assigns tasks in ${MAX_MEMBER_MINUTES}-minute blocks.`,
    );
  }
  const period =
    schedule.officeActionAt.getTime() - schedule.memberActionAt.getTime();
  if (period > 0 && period < COMPLETION_PERIOD_MS) {
    violations.push(
      `Members get ${completionTime(schedule)} to finish. The contract promises a 7-day completion period.`,
    );
  }
  return violations;
}
