import { updateLive, writeUnderLive } from "src/datasources/soft-delete";
import { User } from "src/user/entities/user.entity";
import type { EntityManager } from "typeorm";
import {
  CommunityInvite,
  loadedCommunityInviteCommunity,
  loadedCommunityInviteInvitedUser,
} from "./entities/community-invite.entity";
import { Community } from "./entities/community.entity";

export function saveInviteOfLiveParents(
  manager: EntityManager,
  invite: CommunityInvite,
): Promise<CommunityInvite> {
  return writeUnderLive(manager, {
    parents: [
      { target: User, id: loadedCommunityInviteInvitedUser(invite).id },
      ...(invite.invitingUser
        ? [{ target: User, id: invite.invitingUser.id }]
        : []),
      { target: Community, id: loadedCommunityInviteCommunity(invite).id },
    ],
    write: (em) => em.save(invite),
  });
}

export async function setLiveInviteStatus(
  manager: EntityManager,
  invite: CommunityInvite,
): Promise<void> {
  await updateLive(manager, {
    target: CommunityInvite,
    id: invite.id,
    changes: { status: invite.status },
    notFound: "Invite not found",
  });
}
