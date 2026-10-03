import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Action } from "src/actions/entities/action.entity";
import { Community } from "src/community/entities/community.entity";
import { User } from "src/user/entities/user.entity";
import {
  type EntityManager,
  type FindOperator,
  In,
  type ObjectLiteral,
  type Repository,
} from "typeorm";
import {
  collectReferenceIds,
  type NotificationContent,
  type ResolvedReferences,
} from "./notification-content";

function findIn<T>(
  ids: number[],
  find: (id: FindOperator<number>) => Promise<T[]>,
): Promise<T[]> {
  return ids.length ? find(In([...new Set(ids)])) : Promise.resolve([]);
}

@Injectable()
export class NotificationReferencesService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
  ) {}

  /** Pass the caller's transaction `manager` so the lookups don't wait on a second pool connection. */
  async resolve(
    contents: NotificationContent[],
    manager?: EntityManager,
  ): Promise<ResolvedReferences> {
    const refIds = collectReferenceIds(contents);
    const repo = <T extends ObjectLiteral>(fallback: Repository<T>) =>
      manager ? manager.getRepository(fallback.target) : fallback;

    const [users, communities, actions] = await Promise.all([
      findIn([...refIds.userIds], (id) =>
        repo(this.userRepository).find({
          where: { id },
          select: { id: true, name: true, anonymous: true },
        }),
      ),
      findIn([...refIds.communityIds], (id) =>
        repo(this.communityRepository).find({
          where: { id },
          select: { id: true, name: true },
        }),
      ),
      findIn([...refIds.actionIds], (id) =>
        repo(this.actionRepository).find({
          where: { id },
          select: { id: true, name: true },
        }),
      ),
    ]);

    return {
      users: new Map(users.map((user) => [user.id, user])),
      communities: new Map(communities.map((c) => [c.id, c])),
      actions: new Map(actions.map((a) => [a.id, a])),
    };
  }
}
