import {
  acceptsAutomatedMember,
  getMemberCount,
  isCommunityLedBy,
} from "src/community/community.utils";
import { Community } from "src/community/entities/community.entity";
import { NotificationCategory } from "src/notifs/entities/notification.entity";
import type { CreateNotifParams } from "src/notifs/notifs.service";
import { groupUrl, profileUrl } from "src/search/approutes";
import { ReferralSource, User } from "src/user/entities/user.entity";

/**
 * Ordering only: prefer the leader's roomiest group. An uncapped group sorts
 * last because its leader kept it private and closed to assignment, so it is
 * the least likely place they meant to grow.
 */
function headroomForOrdering(c: Community): number {
  if (c.maxCapacity === null) return -1;
  return c.maxCapacity - getMemberCount(c);
}

/**
 * A referral into a group the referrer leads is consensual — the leader brought
 * this person in themselves — so `maxCapacity` does not gate it.
 */
function selectCommunityForLinkReferral(referredBy: User): Community | null {
  const led = referredBy.communities?.filter((c) =>
    isCommunityLedBy(c, referredBy.id),
  );
  if (!led?.length) {
    return null;
  }
  return [...led].sort(
    (a, b) => headroomForOrdering(b) - headroomForOrdering(a),
  )[0];
}

/** Community selection strategy per referral source. Extensible for new ReferralSource values. */
export const REFERRAL_COMMUNITY_SELECTORS: Record<
  ReferralSource,
  (referredBy: User) => Community | null
> = {
  /**
   * Also the strategy for an "any open group" invite link. Nobody led by the
   * referrer is involved, so this is a non-consensual placement into someone
   * else's group and both the opt-in flag and the cap apply.
   */
  [ReferralSource.OnetimeInvite](referredBy) {
    return (
      referredBy.communities?.find(
        (c) => acceptsAutomatedMember(c) && !isCommunityLedBy(c, referredBy.id),
      ) ?? null
    );
  },
  [ReferralSource.ReferralLink]: selectCommunityForLinkReferral,
  [ReferralSource.ActionShareLink]: selectCommunityForLinkReferral,
  [ReferralSource.ExternalShareLink]: selectCommunityForLinkReferral,
  [ReferralSource.InviteShareLink]: selectCommunityForLinkReferral,
  [ReferralSource.Campaign]: () => null,
  [ReferralSource.None]: () => null,
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
    webAppLocation: groupUrl({ tab: "members", communityId: community.id }),
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
