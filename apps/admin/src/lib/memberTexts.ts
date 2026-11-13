import type { MmsMessageDto } from "@alliance/shared/client/types.gen";

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
