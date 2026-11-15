import { isCanonicalE164 } from "@alliance/common/phone";
import type { Community } from "src/community/entities/community.entity";
import type { Relation } from "src/utils/Repository";
import type { Tag } from "./entities/tag.entity";
import { User } from "./entities/user.entity";

/** Whether a text can reach the member, whatever they prefer. */
export function textReachable(
  user: Pick<User, "phoneNumber" | "phoneNumberUnsubscribed">,
): user is typeof user & { phoneNumber: string } {
  return (
    user.phoneNumber !== null &&
    isCanonicalE164(user.phoneNumber) &&
    !user.phoneNumberUnsubscribed
  );
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

export function memberWithReferral(
  user: Pick<User, "name" | "referredBy" | "referredByCampaign">,
): string {
  return [user.name, referralLabel(user)].filter(Boolean).join(" ");
}

export function hasPassword(user: Pick<User, "password">): boolean {
  return Boolean(user.password);
}

export function loadedUserTags(
  user: Pick<User, "id" | "tags">,
): Relation<Tag>[] {
  if (!user.tags) {
    throw new Error(`tags of user ${user.id} not loaded`);
  }
  return user.tags;
}

export function loadedUserCommunities(user: User): Relation<Community>[] {
  if (!user.communities) {
    throw new Error(`communities of user ${user.id} not loaded`);
  }
  return user.communities;
}
