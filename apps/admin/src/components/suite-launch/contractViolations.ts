import { pickForCount } from "@alliance/common/plural";
import {
  COMPLETION_PERIOD_DAYS,
  completionDays,
  completionTime,
  type LaunchSchedule,
} from "./launchSchedule";
import { MAX_MEMBER_MINUTES, type MemberLoad } from "./memberLoad";

export const overloadedMembers = (loads: MemberLoad[]) =>
  loads.filter((load) => load.minutes > MAX_MEMBER_MINUTES);

/** Ways the launch would break the member contract's 15-minute blocks or 7-day completion period. */
export function contractViolations(params: {
  /** Null while unknown, which skips the 15-minute check. */
  loads: MemberLoad[] | null;
  schedule: LaunchSchedule;
}): string[] {
  const { loads, schedule } = params;
  const violations: string[] = [];
  const overloaded = loads ? overloadedMembers(loads) : [];
  if (overloaded.length > 0) {
    violations.push(
      `${overloaded.length} ${pickForCount(overloaded.length, "member is", "members are")} assigned more than ${MAX_MEMBER_MINUTES} minutes. The contract assigns tasks in ${MAX_MEMBER_MINUTES}-minute blocks.`,
    );
  }
  const { memberActionAt, officeActionAt } = schedule;
  if (
    officeActionAt > memberActionAt &&
    completionDays(schedule) < COMPLETION_PERIOD_DAYS
  ) {
    violations.push(
      `Members get ${completionTime(schedule)} to finish. The contract promises a ${COMPLETION_PERIOD_DAYS}-day completion period.`,
    );
  }
  return violations;
}
