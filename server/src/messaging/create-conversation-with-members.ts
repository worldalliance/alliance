import type { ParticipantRole } from "@alliance/common/participantRole";
import { lockLiveIds } from "src/datasources/soft-delete";
import { User } from "src/user/entities/user.entity";
import type { DeepPartial, EntityManager } from "typeorm";
import { Conversation } from "./entities/conversation.entity";
import {
  Participant,
  type ParticipantState,
} from "./entities/participant.entity";

/** Saves a new conversation and its members, refusing with `gone` when any
 * member's account is deleted. */
export function createConversationWithMembers(
  manager: EntityManager,
  params: {
    conversation: DeepPartial<Conversation>;
    members: Array<{
      user: User;
      role: ParticipantRole;
      state: ParticipantState;
    }>;
    gone: (missingUserIds: Set<number>) => Error;
  },
): Promise<Conversation> {
  const { members, gone } = params;
  return manager.transaction(async (manager) => {
    const ids = members.map((member) => member.user.id);
    const live = await lockLiveIds(manager, { target: User, ids });
    const missing = new Set(ids.filter((id) => !live.has(id)));
    if (missing.size) throw gone(missing);
    const created = await manager.save(
      manager.create(Conversation, params.conversation),
    );
    const joinedAt = new Date();
    await manager.save(
      members.map((member) =>
        manager.create(Participant, {
          ...member,
          conversation: created,
          joinedAt,
        }),
      ),
    );
    return created;
  });
}
