import { readGroupResults } from "@alliance/common/action-update-copy";
import type { Assert, Equal } from "@alliance/common/types";
import type {
  ActionUpdateDto,
  ActionUpdateNotifyType,
  AdminActionUpdateDto,
  CreateActionUpdateDto,
} from "@alliance/shared/client";
import { max } from "date-fns";
import { formatDateTime } from "../../../lib/formatDate";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import { BadgeTone } from "../../../ui/Badge";

export const UPDATE_COPY_GUIDELINES_URL =
  "https://docs.google.com/document/d/1vxeA31milcWRhpkGjGWHp1RQbpDFRjS541E9SzdKkFc/edit?tab=t.0#heading=h.l5nuu7lwqdm8";

export const NOTIFY_TYPES = [
  "none",
  "action_cohort",
  "all_members",
  "tag",
] as const satisfies readonly ActionUpdateNotifyType[];

type _typecheck = Assert<
  Equal<(typeof NOTIFY_TYPES)[number], ActionUpdateNotifyType>
>;

export const NOTIFY_TYPE_LABELS: Record<ActionUpdateNotifyType, string> = {
  none: "No notification",
  action_cohort: "Members in the task's cohort",
  all_members: "All members",
  tag: "Members with a tag",
};

/**
 * Who a send reaches, as the notify handler resolves the saved audience
 * (`server/src/actions/action-update-notify.service.ts`, `findActionUpdateAudience`).
 */
export const audienceOf = (update: {
  notifyType: ActionUpdateNotifyType;
  tag?: { name: string } | null;
}): string => {
  const { notifyType } = update;
  switch (notifyType) {
    case "none":
      return "nobody";
    case "action_cohort":
      return "the task's participants: its cohort, less anyone away or withdrawn, plus anyone who completed it";
    case "all_members":
      return "every member with an active contract";
    case "tag":
      return update.tag
        ? `every member tagged “${update.tag.name}”`
        : "the members of a tag";
    default:
      throw new Error(`unknown notifyType: ${notifyType satisfies never}`);
  }
};

/** Everything a new update still needs, as one sentence list, or null. */
export const missingForCreate = (draft: CreateActionUpdateDto) => {
  const groupResults = readGroupResults({
    completed: draft.shortNotifString ?? "",
    didNotComplete: draft.nonCompleterResult ?? "",
  });
  return (
    [
      !draft.title.trim() && "Add a title.",
      !draft.date && "Pick a date.",
      draft.notifyType !== "none" &&
        !groupResults.ok &&
        `${groupResults.error} Or set the audience to "${NOTIFY_TYPE_LABELS.none}".`,
      draft.notifyType === "tag" && !draft.tagId && "Pick the tag to notify.",
    ]
      .filter(Boolean)
      .join(" ") || null
  );
};

export enum VisibilityState {
  Unpublished = "unpublished",
  Scheduled = "scheduled",
  Published = "published",
}

export type Visibility =
  | { state: VisibilityState.Unpublished }
  | { state: VisibilityState.Scheduled; visibleAt: Date }
  | { state: VisibilityState.Published; visibleAt: Date };

/** Members see an update once `visibleAt` has passed (`action-update-visibility.ts`). */
export const visibilityOf = (
  update: Pick<AdminActionUpdateDto, "visibleAt">,
  now: Date,
): Visibility => {
  if (!update.visibleAt) return { state: VisibilityState.Unpublished };
  const visibleAt = new Date(update.visibleAt);
  return visibleAt > now
    ? { state: VisibilityState.Scheduled, visibleAt }
    : { state: VisibilityState.Published, visibleAt };
};

export const VISIBILITY_BADGE: Record<
  VisibilityState,
  { label: string; tone: BadgeTone }
> = {
  [VisibilityState.Unpublished]: { label: "Draft", tone: BadgeTone.Neutral },
  [VisibilityState.Scheduled]: { label: "Scheduled", tone: BadgeTone.Info },
  [VisibilityState.Published]: { label: "Published", tone: BadgeTone.Success },
};

export const pacific = (date: Date | string) =>
  formatDateTime(date, { timeZone: LAUNCH_TIME_ZONE });

/**
 * The standing fact on an update members can't see yet. The first content
 * save with blocks sets `visibleAt` to the later of now and the update's date
 * (`server/src/actions/action-updates.service.ts`, `updateActionUpdate`).
 */
export const hiddenNoticeOf = (visibility: Visibility): string | null => {
  switch (visibility.state) {
    case VisibilityState.Unpublished:
      return "Members can't see this update yet. The first save of its content on the Content tab publishes it to everyone who can see the task, at once, or at its date if that is later.";
    case VisibilityState.Scheduled:
      return `Members can't see this update yet. It publishes on its own at ${pacific(visibility.visibleAt)}.`;
    case VisibilityState.Published:
      return null;
    default:
      throw new Error(`unknown visibility: ${visibility satisfies never}`);
  }
};

/**
 * What a details save does to members. The save always sends the date, and on
 * an update still waiting to publish that moves `visibleAt` to the later of
 * now and the new date (`action-updates.service.ts`, `updateActionUpdate`).
 */
export const detailsSaveNoteOf = (params: {
  saved: Pick<AdminActionUpdateDto, "visibleAt" | "date" | "notifiedAt">;
  date: string;
  now: Date;
}): string =>
  [publicationNoteOf(params), notificationMoveOf(params)]
    .filter(Boolean)
    .join(" ");

const publicationNoteOf = (params: {
  saved: Pick<AdminActionUpdateDto, "visibleAt" | "date">;
  date: string;
  now: Date;
}): string => {
  const visibility = visibilityOf(params.saved, params.now);
  switch (visibility.state) {
    case VisibilityState.Unpublished:
      return "";
    case VisibilityState.Scheduled:
      if (params.date && new Date(params.date) <= params.now) {
        return "Saving publishes the update to members at once, since its date has passed.";
      }
      return params.date && params.date !== params.saved.date
        ? `Saving moves its publication to ${pacific(params.date)}.`
        : "";
    case VisibilityState.Published:
      return "Members who can see the task see the changes at once.";
    default:
      throw new Error(`unknown visibility: ${visibility satisfies never}`);
  }
};

/**
 * A new date moves a sent notification still on its way, since the save
 * retimes the entries not yet delivered to `actionUpdateEntrySendTime`
 * (`retimeActionUpdateEntries`).
 */
const notificationMoveOf = (params: {
  saved: Pick<AdminActionUpdateDto, "visibleAt" | "date" | "notifiedAt">;
  date: string;
  now: Date;
}): string => {
  const { saved, date, now } = params;
  const { notifiedAt } = saved;
  if (!notifiedAt || !date || date === saved.date) return "";
  if (notifiedArrivalOf({ ...saved, notifiedAt }) <= now) return "";
  const savedVisibleAt = saved.visibleAt ? new Date(saved.visibleAt) : null;
  const visibleAt =
    savedVisibleAt && savedVisibleAt > now
      ? max([now, new Date(date)])
      : savedVisibleAt;
  const sendTime = max([new Date(date), ...(visibleAt ? [visibleAt] : [])]);
  return sendTime <= now
    ? "Saving sends the notification to members at once."
    : `Saving moves the notification to ${pacific(sendTime)}.`;
};

/**
 * The latest a sent update's entries reach members: its date, or when it
 * publishes if that is later, and never before the send
 * (`actionUpdateEntrySendTime` in `server/src/actions/action-update-visibility.ts`).
 * Only the latest, because moving the date or visibility later retimes only
 * entries not yet delivered (`retimeActionUpdateEntries`).
 */
export const notifiedArrivalOf = (
  update: Pick<ActionUpdateDto, "date" | "visibleAt"> & { notifiedAt: string },
) =>
  max([
    new Date(update.notifiedAt),
    new Date(update.date),
    ...(update.visibleAt ? [new Date(update.visibleAt)] : []),
  ]);

export const notificationFactOf = (
  update: Pick<
    ActionUpdateDto,
    "date" | "visibleAt" | "notifiedAt" | "notifyType"
  >,
  now: Date,
) => {
  const { notifiedAt } = update;
  if (notifiedAt) {
    const arrival = notifiedArrivalOf({ ...update, notifiedAt });
    return arrival > now
      ? `Sent ${pacific(notifiedAt)}, members get it by ${pacific(arrival)}`
      : `Sent ${pacific(notifiedAt)}`;
  }
  if (update.notifyType === "none") return NOTIFY_TYPE_LABELS.none;
  return "Notification not sent";
};

/**
 * The Date field's help. A date moved later on a published update leaves it
 * visible; only moving `visibleAt` while it is still ahead hides it
 * (`action-updates.service.ts`, `updateActionUpdate`).
 */
export const dateHelpOf = (visibility: Visibility): string => {
  switch (visibility.state) {
    case VisibilityState.Unpublished:
      return "The date shown on the update. Members see it from this date, or from the first save of its content if that is later.";
    case VisibilityState.Scheduled:
      return "The date shown on the update. Members see it from this date.";
    case VisibilityState.Published:
      return "The date shown on the update. Members already see it, and changing the date doesn't hide it; Unpublish until displayed date, below, does.";
    default:
      throw new Error(`unknown visibility: ${visibility satisfies never}`);
  }
};
