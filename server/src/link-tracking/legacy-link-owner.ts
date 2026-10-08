import { ActionUpdateExposure } from "src/actions/entities/action-update-exposure.entity";
import {
  ActionEventNotif,
  type ActionEventNotifType,
  type MissedSuiteNoticeCopy,
} from "src/notifs/entities/action-event-notif.entity";
import {
  type Notification,
  NotificationCategory,
} from "src/notifs/entities/notification.entity";
import { Brackets, type EntityManager } from "typeorm";
import {
  type MessageContext,
  MessageSource,
  NOTIF_SOURCE,
  reminderContext,
} from "./message-tracking.entity";

type LegacyNotifRow = {
  id: number;
  userId: number;
  mailId: number | null;
  mmsId: number | null;
  type: ActionEventNotifType;
  reminderGroupId: number | null;
  reminderGroupName: string | null;
  actionId: number | null;
  actionName: string | null;
  notifiedActionIds: number[] | null;
  actionSuiteId: number | null;
  missNumber: number | null;
  missedSuiteCopy: MissedSuiteNoticeCopy | null;
};

type LegacyExposureRow = {
  userId: number;
  mailId: number | null;
  mmsId: number | null;
  actionUpdateId: number;
  actionId: number;
};

export type LegacyMessages = { mailIds: number[]; mmsIds: number[] };

export type LegacyOwner = {
  userId: number;
  source: MessageSource;
  actionEventNotifId: number | null;
  context: MessageContext;
};

const sentAnyOf = (messages: LegacyMessages, alias: string) =>
  new Brackets((qb) => {
    if (messages.mailIds.length) {
      qb.orWhere(`${alias}."mailId" IN (:...mailIds)`, messages);
    }
    if (messages.mmsIds.length) {
      qb.orWhere(`${alias}."mmsId" IN (:...mmsIds)`, messages);
    }
  });

// A text that landed after its send timed out kept the ID without being
// linked to its sender, so one unlinked message on a channel the sender has
// none on is the sender's own.
const sentAll = (
  sender: { mailId: number | null; mmsId: number | null },
  messages: LegacyMessages,
) => {
  const owns = (ids: number[], own: number | null) =>
    own === null ? ids.length <= 1 : ids.every((id) => id === own);
  return (
    owns(messages.mailIds, sender.mailId) && owns(messages.mmsIds, sender.mmsId)
  );
};

const reminderOwner = (notif: LegacyNotifRow): LegacyOwner => ({
  userId: notif.userId,
  source: NOTIF_SOURCE[notif.type],
  actionEventNotifId: notif.id,
  context: reminderContext({
    group:
      notif.reminderGroupId !== null && notif.reminderGroupName !== null
        ? { id: notif.reminderGroupId, name: notif.reminderGroupName }
        : null,
    action:
      notif.actionId !== null && notif.actionName !== null
        ? { id: notif.actionId, name: notif.actionName }
        : null,
    notifiedActionIds: notif.notifiedActionIds,
    actionSuiteId: notif.actionSuiteId,
    missNumber: notif.missNumber,
    missedSuiteCopy: notif.missedSuiteCopy,
  }),
});

const recognitionOwner = (exposure: LegacyExposureRow): LegacyOwner => ({
  userId: exposure.userId,
  source: MessageSource.ActionUpdate,
  actionEventNotifId: null,
  context: {
    actionId: exposure.actionId,
    actionUpdateId: exposure.actionUpdateId,
  },
});

/**
 * A forum reply's sole in-app entry names its recipient when one message
 * carried the ID, since a reply went out by email or by text, never both.
 * Only replies sent before 2026-03-10 have an entry with the ID.
 */
const forumReplyOwner = (
  entry: Notification | null,
  messages: LegacyMessages,
): LegacyOwner | null =>
  entry?.user &&
  entry.category === NotificationCategory.ForumReply &&
  messages.mailIds.length + messages.mmsIds.length === 1
    ? {
        userId: entry.user.id,
        source: MessageSource.ForumReply,
        actionEventNotifId: null,
        context: { notificationIds: [entry.id] },
      }
    : null;

const legacyNotifs = (manager: EntityManager, messages: LegacyMessages) =>
  manager
    .createQueryBuilder(ActionEventNotif, "notif")
    .leftJoin("notif.reminderGroup", "group")
    .leftJoin("group.memberActionEvent", "event")
    .leftJoin("event.action", "action")
    // A personal reminder keeps its own event when its group is deleted.
    .leftJoin("notif.memberActionEvent", "ownEvent")
    .leftJoin("ownEvent.action", "ownAction")
    .select([
      'notif.id AS "id"',
      'notif."userId" AS "userId"',
      'notif."mailId" AS "mailId"',
      'notif."mmsId" AS "mmsId"',
      'notif.type AS "type"',
      'notif."reminderGroupId" AS "reminderGroupId"',
      'group.name AS "reminderGroupName"',
      'COALESCE(action.id, ownAction.id) AS "actionId"',
      'COALESCE(action.name, ownAction.name) AS "actionName"',
      'notif."notifiedActionIds" AS "notifiedActionIds"',
      'notif."actionSuiteId" AS "actionSuiteId"',
      'notif."missNumber" AS "missNumber"',
      'notif."missedSuiteCopy" AS "missedSuiteCopy"',
    ])
    .where(sentAnyOf(messages, "notif"))
    .getRawMany<LegacyNotifRow>();

// A recognition also kept the ID it sent, which names its recipient when its
// text landed after the send timed out and was never linked to it.
const legacyExposures = (params: {
  manager: EntityManager;
  cid: string;
  messages: LegacyMessages;
}) =>
  params.manager
    .createQueryBuilder(ActionUpdateExposure, "exposure")
    .innerJoin("exposure.actionUpdate", "update")
    .select([
      'exposure."userId" AS "userId"',
      'exposure."mailId" AS "mailId"',
      'exposure."mmsId" AS "mmsId"',
      'exposure."actionUpdateId" AS "actionUpdateId"',
      'update."actionId" AS "actionId"',
    ])
    .where("exposure.cid = :cid", { cid: params.cid })
    .orWhere(sentAnyOf(params.messages, "exposure"))
    .getRawMany<LegacyExposureRow>();

/**
 * The recipient of the reminder, recognition, or forum reply that sent every
 * message carrying a legacy ID. A legacy ID is 40 random bits, so two
 * recipients' messages can share one; such an ID has no owner.
 */
export async function legacyOwner(params: {
  manager: EntityManager;
  cid: string;
  messages: LegacyMessages;
  entry: Notification | null;
}): Promise<LegacyOwner | null> {
  const { manager, cid, messages, entry } = params;
  const notifs = await legacyNotifs(manager, messages);
  const exposures = await legacyExposures({ manager, cid, messages });

  if (notifs.length + exposures.length > 1) return null;
  const [notif] = notifs;
  if (notif) return sentAll(notif, messages) ? reminderOwner(notif) : null;
  const [exposure] = exposures;
  if (exposure) {
    return sentAll(exposure, messages) ? recognitionOwner(exposure) : null;
  }
  return forumReplyOwner(entry, messages);
}
