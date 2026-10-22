import { NotificationCategory } from "src/notifs/entities/notification.entity";
import {
  communityDestination,
  group,
  member,
  type NotifMessage,
  notifMessage,
} from "src/notifs/notification-content";
import type { CreateNotifParams } from "src/notifs/notifs.service";
import { groupUrl } from "src/search/approutes";
import type { User } from "src/user/entities/user.entity";
import { Community, loadedCommunityUsers } from "./entities/community.entity";

/**
 * True when the given user is a leader of the community. Safe when leaders relation is unloaded.
 */
export function isCommunityLedBy(c: Community, userId: number): boolean {
  return c.leaders?.some((leader) => leader.id === userId) ?? false;
}

export function groupJoinAudience(community: Community): User[] {
  const { leaders } = community;
  if (!leaders) {
    throw new Error(`leaders of community ${community.id} not loaded`);
  }
  const leaderIds = new Set(leaders.map((leader) => leader.id));
  return loadedCommunityUsers(community).filter(
    (user) => !leaderIds.has(user.id),
  );
}

export function memberJoinedCommunityNotif({
  leader,
  joiner,
  community,
  message,
  associatedUsers = [joiner],
}: {
  leader: User;
  joiner: User;
  community: Community;
  message: NotifMessage;
  associatedUsers?: User[];
}): CreateNotifParams {
  return {
    user: leader,
    category: NotificationCategory.MemberJoinedCommunity,
    message,
    destination: communityDestination(community.id),
    webAppLocation: groupUrl({ tab: "members", communityId: community.id }),
    associatedUsers,
  };
}

export function staffAddedMemberNotif({
  leader,
  joiner,
  community,
}: {
  leader: User;
  joiner: User;
  community: Community;
}): CreateNotifParams {
  return memberJoinedCommunityNotif({
    leader,
    joiner,
    community,
    message: notifMessage`Staff added ${member(joiner)} to your group (${group(community)})`,
  });
}

export function memberLeftCommunityNotif({
  leader,
  leaver,
  community,
}: {
  leader: User;
  leaver: User;
  community: Community;
}): CreateNotifParams {
  return {
    user: leader,
    category: NotificationCategory.MemberLeftCommunity,
    message: notifMessage`${member(leaver)} left your group (${group(community)})`,
    destination: communityDestination(community.id),
    webAppLocation: groupUrl({ tab: "members", communityId: community.id }),
    associatedUsers: [leaver],
  };
}
