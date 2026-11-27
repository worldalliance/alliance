import type {
  ActionEventNotifDto,
  EmailStatus,
  Push,
} from "@alliance/shared/client/types.gen";
import { format, formatDistanceStrict } from "date-fns";
import { BadgeTone } from "../../ui/Badge";
import { sentenceCase } from "./memberRules";

/** Clicks recorded before link tracking have no time. */
export const linkClickedLabel = ({
  clickedAt,
  sentAt,
}: {
  clickedAt: string | null | undefined;
  sentAt: string;
}) =>
  clickedAt
    ? `Link clicked ${format(new Date(clickedAt), "MMM d, h:mm a")}, ${formatDistanceStrict(new Date(clickedAt), new Date(sentAt))} after sending`
    : "Link clicked";

export const EMAIL_STATUS: Record<EmailStatus, BadgeTone> = {
  pending: BadgeTone.Info,
  sent: BadgeTone.Success,
  failed: BadgeTone.Danger,
};

const DONE = new Set(["sent", "delivered", "read", "ok"]);
const FAILED = new Set(["failed", "undelivered", "error", "canceled"]);

/** A text's Twilio status or a push's Expo status, which the server stores as given. */
export const deliveryBadge = (status: string) => {
  const key = status.toLowerCase();
  return {
    label: sentenceCase(key),
    tone: DONE.has(key)
      ? BadgeTone.Success
      : FAILED.has(key)
        ? BadgeTone.Danger
        : BadgeTone.Info,
  };
};

export const pushStatus = (push: Push) =>
  push.receiptStatus ||
  push.ticketStatus ||
  (push.errorCode ? "error" : "sent");

const newestFirst = <T>(items: T[], at: (item: T) => string) =>
  [...items].sort(
    (a, b) => new Date(at(b)).getTime() - new Date(at(a)).getTime(),
  );

type Sends = Pick<ActionEventNotifDto, "pushes"> & {
  mail?: { createdAt: string } | null;
  mms?: { createdAt: string } | null;
};

/** Each channel's sends, newest first, by that channel's own send time. One notification can go by several. */
export const byChannel = <N extends Sends>(notifs: N[]) => ({
  texts: newestFirst(
    notifs.filter((notif) => notif.mms),
    (notif) => notif.mms?.createdAt ?? "",
  ),
  emails: newestFirst(
    notifs.filter((notif) => notif.mail),
    (notif) => notif.mail?.createdAt ?? "",
  ),
  pushes: newestFirst(
    notifs.flatMap((notif) => notif.pushes ?? []),
    (push) => push.createdAt,
  ),
});

/** "40% click rate", or nothing when none were sent. */
export const rate = (params: { hits: number; of: number; noun: string }) =>
  params.of === 0
    ? null
    : `${Math.round((params.hits / params.of) * 100)}% ${params.noun}`;
