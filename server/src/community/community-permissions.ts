import { BadRequestException } from "@nestjs/common";
import type { User } from "src/user/entities/user.entity";

export function canManageCommunity(
  user: Pick<User, "admin" | "leaderOfIdSet">,
  communityId: number | null,
): boolean {
  return (
    user.admin || (communityId !== null && user.leaderOfIdSet.has(communityId))
  );
}

export function assertCanManageCommunity(
  user: Pick<User, "admin" | "leaderOfIdSet">,
  communityId: number,
): void {
  if (!canManageCommunity(user, communityId)) {
    throw new BadRequestException(
      `User is not a leader of community ${communityId}`,
    );
  }
}
