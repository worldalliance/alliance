import { NotificationCategory } from "src/notifs/entities/notification.entity";
import { UnreadContentType } from "src/notifs/entities/unread-content.entity";
import { NotificationChannel } from "src/notifs/notif-utils";

export enum NotificationKind {
  ActionAnnounced = "action_announced",
  ActionReminders = "action_reminders",
  MissedDeadline = "missed_deadline",
  ActionUpdates = "action_updates",
  GroupMembersWithUncompletedTasks = "group_members_with_uncompleted_tasks",
  ContractSuspended = "contract_suspended",
  CommentsAndReplies = "comments_and_replies",
  Messages = "messages",
  FriendRequests = "friend_requests",
  FriendRequestAccepted = "friend_request_accepted",
  Likes = "likes",
  GroupMemberJoined = "group_member_joined",
  MemberJoinedCommunity = "member_joined_community",
  CommunityAssigned = "community_assigned",
  RemovedFromCommunity = "removed_from_community",
  RemovedFromCommunityForLeader = "removed_from_community_for_leader",
  MemberLeftCommunity = "member_left_community",
  MemberSuspendedRemovedFromCommunity = "member_suspended_removed_from_community",
  NewMemberReferred = "new_member_referred",
  RecruitingGoals = "recruiting_goals",
  CommunityInviteCreated = "community_invite_created",
  CommunityInviteAccepted = "community_invite_accepted",
  CommunityInviteRejected = "community_invite_rejected",
  CommunityInviteRequestCreated = "community_invite_request_created",
  CommunityInviteRequestApproved = "community_invite_request_approved",
  CommunityInviteRequestRejected = "community_invite_request_rejected",
  OnetimeInviteRequestCreated = "onetime_invite_request_created",
  OnetimeInviteRequestApproved = "onetime_invite_request_approved",
  OnetimeInviteRequestRejected = "onetime_invite_request_rejected",
}

export enum NotificationSection {
  Actions = "actions",
  Groups = "groups",
  ForumAndMessages = "forum_and_messages",
  FriendsAndLikes = "friends_and_likes",
}

export type KindPolicy = {
  label: string;
  section: NotificationSection;
  channels: readonly NotificationChannel[];
  /** Follows the channel defaults and takes no override. */
  required: boolean;
  leaderOnly: boolean;
  /** Something sends this kind. A kind nothing sends is left off the settings screens. */
  sent: boolean;
};

const { InApp, Push, Text, Email } = NotificationChannel;

const groupNotice = (
  label: string,
  { leaderOnly }: { leaderOnly: boolean },
): KindPolicy => ({
  label,
  section: NotificationSection.Groups,
  channels: [InApp, Push],
  required: false,
  leaderOnly,
  sent: true,
});

export const KIND_POLICY: Record<NotificationKind, KindPolicy> = {
  [NotificationKind.ActionAnnounced]: {
    label: "New action announced",
    section: NotificationSection.Actions,
    channels: [Push, Text, Email],
    required: false,
    leaderOnly: false,
    sent: false,
  },
  [NotificationKind.ActionReminders]: {
    label: "Action reminders",
    section: NotificationSection.Actions,
    channels: [Push, Text, Email],
    required: false,
    leaderOnly: false,
    sent: true,
  },
  [NotificationKind.MissedDeadline]: {
    label: "Missed deadline",
    section: NotificationSection.Actions,
    channels: [InApp, Push, Text, Email],
    required: false,
    leaderOnly: false,
    sent: true,
  },
  [NotificationKind.ActionUpdates]: {
    label: "Action updates",
    section: NotificationSection.Actions,
    channels: [InApp, Push, Text, Email],
    required: false,
    leaderOnly: false,
    sent: true,
  },
  [NotificationKind.GroupMembersWithUncompletedTasks]: {
    label: "Group members with uncompleted tasks",
    section: NotificationSection.Actions,
    channels: [Push, Text, Email],
    required: false,
    leaderOnly: true,
    sent: true,
  },
  [NotificationKind.ContractSuspended]: {
    label: "Contract suspended",
    section: NotificationSection.Actions,
    channels: [Push, Text, Email],
    required: true,
    leaderOnly: false,
    sent: true,
  },
  [NotificationKind.CommentsAndReplies]: {
    label: "Comments and replies",
    section: NotificationSection.ForumAndMessages,
    channels: [InApp, Push, Text, Email],
    required: false,
    leaderOnly: false,
    sent: true,
  },
  [NotificationKind.Messages]: {
    label: "Messages",
    section: NotificationSection.ForumAndMessages,
    channels: [Push],
    required: false,
    leaderOnly: false,
    sent: true,
  },
  [NotificationKind.FriendRequests]: {
    label: "Friend requests",
    section: NotificationSection.FriendsAndLikes,
    channels: [InApp, Push],
    required: false,
    leaderOnly: false,
    sent: true,
  },
  [NotificationKind.FriendRequestAccepted]: {
    label: "Accepted friend requests",
    section: NotificationSection.FriendsAndLikes,
    channels: [InApp, Push],
    required: false,
    leaderOnly: false,
    sent: true,
  },
  [NotificationKind.Likes]: {
    label: "Likes",
    section: NotificationSection.FriendsAndLikes,
    channels: [InApp, Push],
    required: false,
    leaderOnly: false,
    sent: true,
  },
  [NotificationKind.GroupMemberJoined]: {
    label: "Someone joined your group",
    section: NotificationSection.Groups,
    channels: [InApp, Push, Text],
    required: false,
    leaderOnly: false,
    sent: true,
  },
  [NotificationKind.MemberJoinedCommunity]: groupNotice(
    "A member joined a group you lead",
    { leaderOnly: true },
  ),
  [NotificationKind.CommunityAssigned]: groupNotice("Assigned to a group", {
    leaderOnly: false,
  }),
  [NotificationKind.RemovedFromCommunity]: groupNotice("Removed from a group", {
    leaderOnly: false,
  }),
  [NotificationKind.RemovedFromCommunityForLeader]: groupNotice(
    "A member was removed from a group you lead",
    { leaderOnly: true },
  ),
  [NotificationKind.MemberLeftCommunity]: groupNotice(
    "A member left a group you lead",
    { leaderOnly: true },
  ),
  [NotificationKind.MemberSuspendedRemovedFromCommunity]: groupNotice(
    "A member of a group you lead was suspended",
    { leaderOnly: true },
  ),
  [NotificationKind.NewMemberReferred]: groupNotice(
    "Someone you invited joined",
    { leaderOnly: false },
  ),
  [NotificationKind.RecruitingGoals]: groupNotice("Recruiting goal updates", {
    leaderOnly: false,
  }),
  [NotificationKind.CommunityInviteCreated]: groupNotice(
    "Invited to join a group",
    { leaderOnly: false },
  ),
  [NotificationKind.CommunityInviteAccepted]: groupNotice(
    "Your invitation was accepted",
    { leaderOnly: false },
  ),
  [NotificationKind.CommunityInviteRejected]: groupNotice(
    "Your invitation was declined",
    { leaderOnly: false },
  ),
  [NotificationKind.CommunityInviteRequestCreated]: groupNotice(
    "Requests to invite someone to a group you lead",
    { leaderOnly: true },
  ),
  [NotificationKind.CommunityInviteRequestApproved]: groupNotice(
    "Your request to invite someone was approved",
    { leaderOnly: false },
  ),
  [NotificationKind.CommunityInviteRequestRejected]: groupNotice(
    "Your request to invite someone was rejected",
    { leaderOnly: false },
  ),
  [NotificationKind.OnetimeInviteRequestCreated]: groupNotice(
    "Requests for a one-time invite to a group you lead",
    { leaderOnly: true },
  ),
  [NotificationKind.OnetimeInviteRequestApproved]: groupNotice(
    "Your one-time invite request was approved",
    { leaderOnly: false },
  ),
  [NotificationKind.OnetimeInviteRequestRejected]: groupNotice(
    "Your one-time invite request was rejected",
    { leaderOnly: false },
  ),
};

export const CATEGORY_KIND: Record<NotificationCategory, NotificationKind> = {
  [NotificationCategory.ActionEvent]: NotificationKind.MissedDeadline,
  [NotificationCategory.ForumReply]: NotificationKind.CommentsAndReplies,
  [NotificationCategory.FriendRequest]: NotificationKind.FriendRequests,
  [NotificationCategory.FriendRequestAccepted]:
    NotificationKind.FriendRequestAccepted,
  [NotificationCategory.ActionUpdate]: NotificationKind.ActionUpdates,
  [NotificationCategory.Likes]: NotificationKind.Likes,
  [NotificationCategory.RemovedFromCommunity]:
    NotificationKind.RemovedFromCommunity,
  [NotificationCategory.RemovedFromCommunityForLeader]:
    NotificationKind.RemovedFromCommunityForLeader,
  [NotificationCategory.MemberLeftCommunity]:
    NotificationKind.MemberLeftCommunity,
  [NotificationCategory.MemberSuspendedRemovedFromCommunity]:
    NotificationKind.MemberSuspendedRemovedFromCommunity,
  [NotificationCategory.MemberJoinedCommunity]:
    NotificationKind.MemberJoinedCommunity,
  [NotificationCategory.CommunityAssigned]: NotificationKind.CommunityAssigned,
  [NotificationCategory.NewMemberReferred]: NotificationKind.NewMemberReferred,
  [NotificationCategory.AmbassadorInviteGoal]: NotificationKind.RecruitingGoals,
  [NotificationCategory.GroupMemberJoined]: NotificationKind.GroupMemberJoined,
  [NotificationCategory.ActionBranchMoved]: NotificationKind.ActionUpdates,
  [NotificationCategory.CommunityInviteCreated]:
    NotificationKind.CommunityInviteCreated,
  [NotificationCategory.CommunityInviteRejected]:
    NotificationKind.CommunityInviteRejected,
  [NotificationCategory.CommunityInviteAccepted]:
    NotificationKind.CommunityInviteAccepted,
  [NotificationCategory.OnetimeInviteRequestCreated]:
    NotificationKind.OnetimeInviteRequestCreated,
  [NotificationCategory.OnetimeInviteRequestApproved]:
    NotificationKind.OnetimeInviteRequestApproved,
  [NotificationCategory.OnetimeInviteRequestRejected]:
    NotificationKind.OnetimeInviteRequestRejected,
  [NotificationCategory.CommunityInviteRequestCreated]:
    NotificationKind.CommunityInviteRequestCreated,
  [NotificationCategory.CommunityInviteRequestApproved]:
    NotificationKind.CommunityInviteRequestApproved,
  [NotificationCategory.CommunityInviteRequestRejected]:
    NotificationKind.CommunityInviteRequestRejected,
};

export const UNREAD_CONTENT_KIND: Record<UnreadContentType, NotificationKind> =
  {
    [UnreadContentType.ActionEvent]: NotificationKind.MissedDeadline,
    [UnreadContentType.ForumReply]: NotificationKind.CommentsAndReplies,
    [UnreadContentType.ActionUpdate]: NotificationKind.ActionUpdates,
  };
