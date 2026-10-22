import { dateToInputValue } from "@alliance/shared/lib/dateInput";
import { milliseconds, subDays } from "date-fns";

export const defaultInviteFunnelRange = (now: Date) => {
  const end = new Date(now.getTime() + milliseconds({ days: 1 }));
  const start = subDays(end, 14);
  return { start: dateToInputValue(start), end: dateToInputValue(end) };
};
