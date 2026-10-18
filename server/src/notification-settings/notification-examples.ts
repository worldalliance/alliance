import { ConversationType } from "@alliance/common/conversationType";
import {
  defaultAnnouncementPushMessage,
  defaultGroupLeadsTextMessage,
  defaultMissedDeadlineTextMessage,
  defaultPushMessage,
} from "@alliance/common/reminderPresetCopy";
import { addDays } from "date-fns";
import { memberLeftCommunityNotif } from "src/community/community.utils";
import { Community } from "src/community/entities/community.entity";
import { newMemberReferredNotif } from "src/contract/contract.utils";
import { processKeywordReplacements } from "src/mail/mail.service";
import { messagePushBody } from "src/messaging/message-push.listener";
import { likeMessage } from "src/notifs/like-notification.service";
import {
  assignedToGroupMessage,
  friendRequestAcceptedMessage,
  friendRequestMessage,
  groupInviteAcceptedMessage,
  groupInviteDeclinedMessage,
  groupInviteMessage,
  groupInviteRequestApprovedMessage,
  groupInviteRequestMessage,
  groupInviteRequestRejectedMessage,
  groupMemberJoinedMessage,
  memberJoinedYourGroupMessage,
  memberRemovedFromYourGroupMessage,
  memberSuspendedMessage,
  onetimeInviteRequestApprovedMessage,
  onetimeInviteRequestMessage,
  onetimeInviteRequestRejectedMessage,
  removedFromGroupMessage,
} from "src/notifs/notif-copy";
import {
  forumReplyContent,
  LIVE_ACTION_UPDATE_TEXT,
  NO_REFERENCES,
  renderNotificationContent,
} from "src/notifs/notification-content";
import { suspensionMessage } from "src/notifs/textnotifcontents";
import { getAmbassadorGoalHalfwayNotificationMessage } from "src/user/ambassador-invite-goal-notification.utils";
import { User } from "src/user/entities/user.entity";
import { NotificationKind } from "./notification-kind";

const maya = Object.assign(new User(), {
  id: 1,
  name: "Maya Rowan",
  anonymous: false,
});
const jordan = Object.assign(new User(), {
  id: 2,
  name: "Jordan Ellis",
  anonymous: false,
});
const climateHawks = Object.assign(new Community(), {
  id: 1,
  name: "Climate Hawks",
});
const now = new Date("2026-03-02T17:00:00Z");

const reminder = (template: string) =>
  processKeywordReplacements(template, {
    user: maya,
    action: { name: "Call your representative" },
    deadlineEvent: { date: addDays(now, 2) },
    uncompletedTasksCount: 1,
    uncompletedTasksTime: "15 minutes",
    uncompletedTasksNames: ["Call your representative"],
    dateNow: now,
    uncompletedMembersInGroupCount: 3,
  });

function rendered(input: Parameters<typeof renderNotificationContent>[0]) {
  const result = renderNotificationContent(input);
  if (!result) throw new Error("an example references a missing action");
  return result.message;
}

/** What each kind says, from the code that writes it, with sample names and groups. */
export const KIND_EXAMPLE: Record<NotificationKind, () => string> = {
  [NotificationKind.ActionAnnounced]: () =>
    reminder(defaultAnnouncementPushMessage),
  [NotificationKind.ActionReminders]: () => reminder(defaultPushMessage),
  [NotificationKind.MissedDeadline]: () =>
    reminder(defaultMissedDeadlineTextMessage),
  [NotificationKind.ActionUpdates]: () =>
    rendered({
      content: LIVE_ACTION_UPDATE_TEXT,
      references: NO_REFERENCES,
      count: null,
      actionUpdateText: "Our letters reached every senator on the committee.",
    }),
  [NotificationKind.GroupMembersWithUncompletedTasks]: () =>
    reminder(defaultGroupLeadsTextMessage),
  [NotificationKind.ContractSuspended]: () => suspensionMessage.trim(),
  [NotificationKind.CommentsAndReplies]: () =>
    rendered({
      content: forumReplyContent(jordan.id),
      references: { ...NO_REFERENCES, users: new Map([[jordan.id, jordan]]) },
      count: null,
      commentExcerpt: "Count me in for Saturday!",
    }),
  [NotificationKind.Messages]: () =>
    messagePushBody({
      senderName: jordan.name,
      body: "Are you coming to the meetup on Saturday?",
      hasAttachments: false,
      conversation: { type: ConversationType.Direct, title: "" },
    }),
  [NotificationKind.FriendRequests]: () => friendRequestMessage(jordan).text,
  [NotificationKind.FriendRequestAccepted]: () =>
    friendRequestAcceptedMessage(jordan).text,
  [NotificationKind.Likes]: () =>
    likeMessage({
      targetType: "post",
      count: 1,
      targetContent: "Photos from the beach cleanup",
      likerName: jordan.name,
    }),
  [NotificationKind.GroupMemberJoined]: () =>
    groupMemberJoinedMessage(jordan, climateHawks).text,
  [NotificationKind.MemberJoinedCommunity]: () =>
    memberJoinedYourGroupMessage(jordan, climateHawks).text,
  [NotificationKind.CommunityAssigned]: () =>
    assignedToGroupMessage(climateHawks).text,
  [NotificationKind.RemovedFromCommunity]: () =>
    removedFromGroupMessage(jordan, climateHawks).text,
  [NotificationKind.RemovedFromCommunityForLeader]: () =>
    memberRemovedFromYourGroupMessage({
      remover: jordan,
      removee: maya,
      community: climateHawks,
    }).text,
  [NotificationKind.MemberLeftCommunity]: () =>
    memberLeftCommunityNotif({
      leader: maya,
      leaver: jordan,
      community: climateHawks,
    }).message.text,
  [NotificationKind.MemberSuspendedRemovedFromCommunity]: () =>
    memberSuspendedMessage({
      suspended: jordan,
      automatic: true,
      community: climateHawks,
    }).text,
  [NotificationKind.NewMemberReferred]: () =>
    newMemberReferredNotif(jordan, maya).message.text,
  [NotificationKind.RecruitingGoals]: () =>
    getAmbassadorGoalHalfwayNotificationMessage(
      { dueAt: addDays(now, 10), targetSuccessfulRecruits: 4 },
      2,
      now,
    ),
  [NotificationKind.CommunityInviteCreated]: () =>
    groupInviteMessage(jordan, climateHawks).text,
  [NotificationKind.CommunityInviteAccepted]: () =>
    groupInviteAcceptedMessage(jordan, climateHawks).text,
  [NotificationKind.CommunityInviteRejected]: () =>
    groupInviteDeclinedMessage(jordan, climateHawks).text,
  [NotificationKind.CommunityInviteRequestCreated]: () =>
    groupInviteRequestMessage({
      requester: jordan,
      invitee: maya,
      community: climateHawks,
    }).text,
  [NotificationKind.CommunityInviteRequestApproved]: () =>
    groupInviteRequestApprovedMessage(jordan).text,
  [NotificationKind.CommunityInviteRequestRejected]: () =>
    groupInviteRequestRejectedMessage(jordan).text,
  [NotificationKind.OnetimeInviteRequestCreated]: () =>
    onetimeInviteRequestMessage({
      requester: jordan,
      invitee: maya.name,
      community: climateHawks,
    }).text,
  [NotificationKind.OnetimeInviteRequestApproved]: () =>
    onetimeInviteRequestApprovedMessage(maya.name).text,
  [NotificationKind.OnetimeInviteRequestRejected]: () =>
    onetimeInviteRequestRejectedMessage(maya.name).text,
};
