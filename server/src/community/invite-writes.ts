import { writeUnderLive } from "src/datasources/soft-delete";
import { User } from "src/user/entities/user.entity";
import type { EntityManager } from "typeorm";
import { CommunityInvite } from "./entities/community-invite.entity";
import { Community } from "./entities/community.entity";

export function saveInviteOfLiveParents(
  manager: EntityManager,
  invite: CommunityInvite,
): Promise<CommunityInvite> {
  return writeUnderLive(manager, {
    parents: [
      { target: User, id: invite.invitedUser.id },
      ...(invite.invitingUser
        ? [{ target: User, id: invite.invitingUser.id }]
        : []),
      { target: Community, id: invite.community.id },
    ],
    write: (em) => em.save(invite),
  });
}
