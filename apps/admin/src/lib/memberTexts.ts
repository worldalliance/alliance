import { R, type Result } from "@alliance/common/result";
import type { MmsMessageDto } from "@alliance/shared/client/types.gen";
import { format } from "date-fns";

const DELIVERY: Record<string, { label: string; failed: boolean }> = {
  accepted: { label: "Sending", failed: false },
  scheduled: { label: "Scheduled", failed: false },
  queued: { label: "Sending", failed: false },
  sending: { label: "Sending", failed: false },
  sent: { label: "Sent", failed: false },
  delivered: { label: "Delivered", failed: false },
  read: { label: "Read", failed: false },
  partially_delivered: { label: "Partly delivered", failed: true },
  undelivered: { label: "Not delivered", failed: true },
  failed: { label: "Failed", failed: true },
  canceled: { label: "Canceled", failed: true },
};

/** Twilio's status set grows; an unknown one shows as-is rather than hidden. */
export const deliveryStatus = (
  message: Pick<MmsMessageDto, "status" | "errorCode" | "errorMessage">,
): { label: string; failed: boolean; reason: string | null } => {
  const known = DELIVERY[message.status] ?? {
    label: message.status,
    failed: false,
  };
  const reason =
    message.errorMessage ??
    (message.errorCode === null ? null : `Twilio error ${message.errorCode}`);
  return { ...known, reason };
};

/** The thread's order: by `createdAt`, then id. */
export const compareTexts = (
  a: Pick<MmsMessageDto, "createdAt" | "id">,
  b: Pick<MmsMessageDto, "createdAt" | "id">,
): number =>
  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
  a.id - b.id;

/** Oldest first; a text in both lists takes its copy from `newer`. */
export const mergeTexts = ({
  older,
  newer,
}: {
  older: MmsMessageDto[];
  newer: MmsMessageDto[];
}): MmsMessageDto[] =>
  [
    ...new Map([...older, ...newer].map((text) => [text.id, text])).values(),
  ].sort(compareTexts);

const QUIET_HOURS = { start: 20, end: 8 } as const;

const hourLabel = (hour: number) => format(new Date(2000, 0, 1, hour), "h a");

export const QUIET_HOURS_LABEL = `${hourLabel(QUIET_HOURS.start)} and ${hourLabel(QUIET_HOURS.end)}`;

export enum LocalTimeUnknown {
  NoTimeZone = "no_time_zone",
  InvalidTimeZone = "invalid_time_zone",
}

export const memberLocalTime = (
  timeZone: string | null,
  now: Date,
): Result<{ label: string; quiet: boolean }, LocalTimeUnknown> => {
  if (!timeZone) return R.failure(LocalTimeUnknown.NoTimeZone);
  return R.fromThrowable(
    () => {
      const hour = Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone,
          hour: "numeric",
          hourCycle: "h23",
        }).format(now),
      );
      const label = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "numeric",
        minute: "2-digit",
      }).format(now);
      return {
        label,
        quiet: hour >= QUIET_HOURS.start || hour < QUIET_HOURS.end,
      };
    },
    () => LocalTimeUnknown.InvalidTimeZone,
  );
};
