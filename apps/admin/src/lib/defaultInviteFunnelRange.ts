import { milliseconds, subDays } from "date-fns";
import { formatDateAsLocal } from "./formatDateAsLocal";

export const defaultInviteFunnelRange = (now: Date) => {
  const end = new Date(now.getTime() + milliseconds({ days: 1 }));
  const start = subDays(end, 14);
  return { start: formatDateAsLocal(start), end: formatDateAsLocal(end) };
};
