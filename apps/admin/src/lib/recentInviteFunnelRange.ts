import { dateToInputValue } from "@alliance/shared/lib/dateInput";
import { addDays, subDays } from "date-fns";

export const recentInviteFunnelRange = (now: Date, days: number) => {
  const end = addDays(now, 1);
  const start = subDays(end, days);
  return { start: dateToInputValue(start), end: dateToInputValue(end) };
};
