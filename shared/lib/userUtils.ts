import type { UserDto } from "../client";

/**
 * Returns the set of community IDs the user leads. Use with bucketOnetimeInvitesByActionability.
 */
export function getLeaderCommunityIds(
  user: UserDto | null | undefined,
): Set<number> {
  if (!user?.leaderOfIds?.length) return new Set();
  return new Set(user.leaderOfIds);
}
