import { isCanonicalE164 } from "@alliance/common/phone";
import { NotificationCategory } from "src/notifs/entities/notification.entity";
import { User } from "./entities/user.entity";

export function userActionNotifsEnabled_email(
  user: Pick<
    User,
    "emailNotifsForActions" | "turnedOffAllNotifs" | "hasActiveContract"
  >,
): boolean {
  return (
    user.emailNotifsForActions &&
    !user.turnedOffAllNotifs &&
    user.hasActiveContract
  );
}

function textable(
  user: Pick<
    User,
    "turnedOffAllNotifs" | "phoneNumber" | "phoneNumberUnsubscribed"
  >,
): boolean {
  return (
    !user.turnedOffAllNotifs &&
    user.phoneNumber !== null &&
    isCanonicalE164(user.phoneNumber) &&
    !user.phoneNumberUnsubscribed
  );
}

export function userActionNotifsEnabled_text(
  user: Pick<
    User,
    | "textNotifsForActions"
    | "turnedOffAllNotifs"
    | "phoneNumber"
    | "hasActiveContract"
    | "phoneNumberUnsubscribed"
  >,
): boolean {
  return Boolean(
    user.textNotifsForActions && user.hasActiveContract && textable(user),
  );
}

export function newGroupMemberTextsEnabled(
  user: Pick<
    User,
    | "textsForNewGroupMembers"
    | "turnedOffAllNotifs"
    | "phoneNumber"
    | "phoneNumberUnsubscribed"
  >,
): boolean {
  return user.textsForNewGroupMembers && textable(user);
}

export function userActionNotifsEnabled_push(
  user: Pick<User, "turnedOffAllNotifs" | "pushNotifsForActions">,
): boolean {
  return !user.turnedOffAllNotifs && user.pushNotifsForActions;
}

export function notificationPushesEnabled(
  user: Pick<
    User,
    | "turnedOffAllNotifs"
    | "pushesForActionUpdates"
    | "pushesForComments"
    | "pushesForFriendRequests"
    | "pushesForLikes"
    | "pushesForNewGroupMembers"
  >,
  category: NotificationCategory,
): boolean {
  if (user.turnedOffAllNotifs) return false;
  const enabled: Record<NotificationCategory, boolean> = {
    [NotificationCategory.ActionEvent]: true,
    [NotificationCategory.ActionUpdate]: user.pushesForActionUpdates,
    [NotificationCategory.ForumReply]: user.pushesForComments,
    [NotificationCategory.FriendRequest]: user.pushesForFriendRequests,
    [NotificationCategory.FriendRequestAccepted]: user.pushesForFriendRequests,
    [NotificationCategory.Likes]: user.pushesForLikes,
    [NotificationCategory.CommunityInviteCreated]: true,
    [NotificationCategory.CommunityInviteRejected]: true,
    [NotificationCategory.CommunityInviteAccepted]: true,
    [NotificationCategory.RemovedFromCommunity]: true,
    [NotificationCategory.RemovedFromCommunityForLeader]: true,
    [NotificationCategory.MemberLeftCommunity]: true,
    [NotificationCategory.MemberJoinedCommunity]: true,
    [NotificationCategory.MemberSuspendedRemovedFromCommunity]: true,
    [NotificationCategory.CommunityAssigned]: true,
    [NotificationCategory.NewMemberReferred]: true,
    [NotificationCategory.GroupMemberJoined]: user.pushesForNewGroupMembers,
    [NotificationCategory.OnetimeInviteRequestCreated]: true,
    [NotificationCategory.OnetimeInviteRequestApproved]: true,
    [NotificationCategory.OnetimeInviteRequestRejected]: true,
    [NotificationCategory.CommunityInviteRequestCreated]: true,
    [NotificationCategory.CommunityInviteRequestApproved]: true,
    [NotificationCategory.CommunityInviteRequestRejected]: true,
  };
  return enabled[category];
}

export function referralLabel(
  user: Pick<User, "referredBy" | "referredByCampaign">,
): string {
  if (user.referredBy?.name) {
    return `(invited by ${user.referredBy.name})`;
  }
  if (user.referredByCampaign?.name) {
    return `(via campaign ${user.referredByCampaign.name})`;
  }
  return "";
}
