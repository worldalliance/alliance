import { ReferralSource, User } from 'src/user/entities/user.entity';
import { Community } from 'src/community/entities/community.entity';
import {
  communityHasCapacity,
  getCommunityFreeSlots,
  isCommunityLedBy,
} from 'src/community/community.utils';
import type { CreateNotifParams } from 'src/notifs/notifs.service';
import { NotificationCategory } from 'src/notifs/entities/notification.entity';
import { groupUrl, profileUrl } from 'src/search/approutes';

/** Community selection strategy per referral source. Extensible for new ReferralSource values. */
function selectCommunityForLinkReferral(referredBy: User): Community | null {
  const led = referredBy.communities?.filter((c) =>
    isCommunityLedBy(c, referredBy.id),
  );
  if (!led?.length) {
    return null;
  }
  const byFreeSlots = [...led].sort(
    (a, b) => getCommunityFreeSlots(b) - getCommunityFreeSlots(a),
  );
  return (
    byFreeSlots[0] ??
    referredBy.communities?.find(
      (c) => communityHasCapacity(c) && !isCommunityLedBy(c, referredBy.id),
    ) ??
    null
  );
}

export const REFERRAL_COMMUNITY_SELECTORS: Record<
  ReferralSource,
  (referredBy: User) => Community | null
> = {
  [ReferralSource.OnetimeInvite](referredBy) {
    return (
      referredBy.communities?.find(
        (c) => communityHasCapacity(c) && !isCommunityLedBy(c, referredBy.id),
      ) ?? null
    );
  },
  [ReferralSource.ReferralLink]: selectCommunityForLinkReferral,
  [ReferralSource.ActionShareLink]: selectCommunityForLinkReferral,
};

export function memberJoinedCommunityNotif(
  leader: User,
  user: User,
  community: Community,
  message: string,
  associatedUsers: User[] = [user],
): CreateNotifParams {
  return {
    user: leader,
    category: NotificationCategory.MemberJoinedCommunity,
    message,
    webAppLocation: groupUrl({ tab: 'members', communityId: community.id }),
    associatedUsers,
  };
}

export function buildNotifForLeaderWithReferrer(
  user: User,
  community: Community,
  referredBy: User,
  setReferrerNotified: (value: boolean) => void,
): (params: { leader: User }) => CreateNotifParams {
  return ({ leader }) => {
    if (leader.id === referredBy.id) {
      setReferrerNotified(true);
      return memberJoinedCommunityNotif(
        leader,
        user,
        community,
        `${user.name} joined the Alliance and your group (${community.name})`,
      );
    }
    return memberJoinedCommunityNotif(
      leader,
      user,
      community,
      `${user.name} (invited by ${referredBy.name}) joined the Alliance and your group (${community.name})`,
      [user, referredBy],
    );
  };
}

export function newMemberReferredNotif(
  user: User,
  referredBy: User,
): CreateNotifParams {
  return {
    user: referredBy,
    category: NotificationCategory.NewMemberReferred,
    message: `${user.name} joined the Alliance`,
    webAppLocation: profileUrl(user.id),
    associatedUsers: [user],
  };
}
