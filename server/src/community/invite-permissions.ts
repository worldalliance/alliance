import { canManageCommunity, type User } from "src/user/entities/user.entity";

export function canModifyInvite(
  user: Pick<User, "id" | "admin" | "leaderOfIdSet">,
  invite: { invitingUserId: number | null; communityId: number | null },
): boolean {
  return (
    invite.invitingUserId === user.id ||
    canManageCommunity(user, invite.communityId)
  );
}
