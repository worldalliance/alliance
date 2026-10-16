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

export function membersAndLeaders(community: Community): User[] {
  return Array.from(
    new Map(
      [...loadedCommunityUsers(community), ...(community.leaders ?? [])].map(
        (user) => [user.id, user],
      ),
    ).values(),
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
