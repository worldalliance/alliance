import type { EventType } from "@alliance/shared/client/types.gen";
import { differenceInMinutes } from "date-fns";
import { minutesInDay, minutesInHour } from "date-fns/constants";
import { formatDateTime } from "../../lib/formatDate";

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  account_created: "Account created",
  contract_signed: "Contract signed",
  contract_suspended: "Contract suspended",
  sms_unsubscribe: "Text opt-out",
  sms_resubscribe: "Text opt-in",
  sms_inbound: "Inbound text",
  sms_failure: "Text failure",
  forum_action_autocomplete: "Forum task auto-complete",
  action_comment: "Task comment",
  forum_reply_notif_failure: "Forum reply not notified",
  action_opt_out: "Task opt-out",
  account_deletion_requested: "Account deletion requested",
  account_deleted: "Account deleted",
  join_request: "Join request",
  admin_role_changed: "Admin role changed",
  waitlist_mail_cap_reached: "Waitlist mail cap reached",
  phone_number_moved: "Phone number moved",
};

export const isEventType = (value: string): value is EventType =>
  Object.hasOwn(EVENT_TYPE_LABELS, value);

/** Every event type, by label, so none leads the list for being listed first on the server. */
export const EVENT_TYPE_OPTIONS: readonly {
  value: EventType;
  label: string;
}[] = Object.keys(EVENT_TYPE_LABELS)
  .filter(isEventType)
  .map((value) => ({ value, label: EVENT_TYPE_LABELS[value] }))
  .sort((a, b) => a.label.localeCompare(b.label));

/** A streamed event may carry a type newer than this build: it shows as the server names it. */
export const eventTypeLabel = (event: string): string =>
  isEventType(event) ? EVENT_TYPE_LABELS[event] : event;

/** An event's time: relative within a day, where `exact` is its tooltip; the date and time after. */
export function eventTime(
  createdAt: string,
  now: Date,
): { text: string; exact: string } {
  const exact = formatDateTime(createdAt, { now });
  const minutes = differenceInMinutes(now, createdAt);
  if (minutes < 1) return { text: "Just now", exact };
  if (minutes < minutesInHour) return { text: `${minutes}m ago`, exact };
  if (minutes < minutesInDay) {
    return { text: `${Math.floor(minutes / minutesInHour)}h ago`, exact };
  }
  return { text: exact, exact };
}
