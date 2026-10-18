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

export type KindPolicy = {
  channels: readonly NotificationChannel[];
  /** Follows the channel defaults and takes no override. */
  required: boolean;
};

const { InApp, Push, Text, Email } = NotificationChannel;

const GROUP_NOTICE: KindPolicy = { channels: [InApp, Push], required: false };

export const KIND_POLICY: Record<NotificationKind, KindPolicy> = {
  [NotificationKind.ActionAnnounced]: {
    channels: [Push, Text, Email],
    required: false,
  },
  [NotificationKind.ActionReminders]: {
    channels: [Push, Text, Email],
    required: false,
  },
  [NotificationKind.MissedDeadline]: {
    channels: [InApp, Push, Text, Email],
    required: false,
  },
  [NotificationKind.ActionUpdates]: {
    channels: [InApp, Push, Text, Email],
    required: false,
  },
  [NotificationKind.GroupMembersWithUncompletedTasks]: {
    channels: [Push, Text, Email],
    required: false,
  },
  [NotificationKind.ContractSuspended]: {
    channels: [Push, Text, Email],
    required: true,
  },
  [NotificationKind.CommentsAndReplies]: {
    channels: [InApp, Push, Text, Email],
    required: false,
  },
  [NotificationKind.Messages]: {
    channels: [Push],
    required: false,
  },
  [NotificationKind.FriendRequests]: {
    channels: [InApp, Push],
    required: false,
  },
  [NotificationKind.FriendRequestAccepted]: {
    channels: [InApp, Push],
    required: false,
  },
  [NotificationKind.Likes]: {
    channels: [InApp, Push],
    required: false,
  },
  [NotificationKind.GroupMemberJoined]: {
    channels: [InApp, Push, Text],
    required: false,
  },
  [NotificationKind.MemberJoinedCommunity]: GROUP_NOTICE,
  [NotificationKind.CommunityAssigned]: GROUP_NOTICE,
  [NotificationKind.RemovedFromCommunity]: GROUP_NOTICE,
  [NotificationKind.RemovedFromCommunityForLeader]: GROUP_NOTICE,
  [NotificationKind.MemberLeftCommunity]: GROUP_NOTICE,
  [NotificationKind.MemberSuspendedRemovedFromCommunity]: GROUP_NOTICE,
  [NotificationKind.NewMemberReferred]: GROUP_NOTICE,
  [NotificationKind.RecruitingGoals]: GROUP_NOTICE,
  [NotificationKind.CommunityInviteCreated]: GROUP_NOTICE,
  [NotificationKind.CommunityInviteAccepted]: GROUP_NOTICE,
  [NotificationKind.CommunityInviteRejected]: GROUP_NOTICE,
  [NotificationKind.CommunityInviteRequestCreated]: GROUP_NOTICE,
  [NotificationKind.CommunityInviteRequestApproved]: GROUP_NOTICE,
  [NotificationKind.CommunityInviteRequestRejected]: GROUP_NOTICE,
  [NotificationKind.OnetimeInviteRequestCreated]: GROUP_NOTICE,
  [NotificationKind.OnetimeInviteRequestApproved]: GROUP_NOTICE,
  [NotificationKind.OnetimeInviteRequestRejected]: GROUP_NOTICE,
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
