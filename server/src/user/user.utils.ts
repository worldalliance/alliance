import { isCanonicalE164, normalizePhoneNumber } from "@alliance/common/phone";
import type { Community } from "src/community/entities/community.entity";
import { lockUntilCommit, type Queryable } from "src/datasources/advisory-lock";
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

/**
 * Makes writers that set this number, or update the members holding it, wait
 * for each other until the transaction ends. A member leaving the number takes
 * only their row lock. Take it before any account row lock.
 */
export const lockPhoneNumber = (manager: Queryable, phoneNumber: string) =>
  lockUntilCommit(manager, `phone-number:${normalizePhoneNumber(phoneNumber)}`);
