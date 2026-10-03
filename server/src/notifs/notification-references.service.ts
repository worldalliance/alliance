import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import { ActionUpdate } from "src/actions/entities/action-update.entity";
import { Action } from "src/actions/entities/action.entity";
import { Community } from "src/community/entities/community.entity";
import {
  Comment,
  CommentParentObject,
} from "src/forum/entities/comment.entity";
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
  type ContentTarget,
  ContentTargetType,
  type NotificationContent,
  type ResolvedReferences,
} from "./notification-content";

export type NotificationReferences = ResolvedReferences & {
  comments: ReadonlyMap<number, Comment>;
  actionUpdates: ReadonlyMap<number, ActionUpdate>;
  activityActionIds: ReadonlyMap<number, number>;
};

const idsOf = (targets: ContentTarget[], type: ContentTargetType) =>
  targets.filter((target) => target.type === type).map((target) => target.id);

function findIn<T>(
  ids: number[],
  find: (id: FindOperator<number>) => Promise<T[]>,
): Promise<T[]> {
  return ids.length ? find(In([...new Set(ids)])) : Promise.resolve([]);
}

const parentIdsOf = (comments: Comment[], type: CommentParentObject) =>
  comments
    .filter((comment) => comment.parentObjectType === type)
    .map((comment) => comment.parentObjectId);

@Injectable()
export class NotificationReferencesService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(ActionActivity)
    private readonly activityRepository: Repository<ActionActivity>,
    @InjectRepository(ActionUpdate)
    private readonly actionUpdateRepository: Repository<ActionUpdate>,
  ) {}

  async resolve(params: {
    contents: NotificationContent[];
    targets: ContentTarget[];
    /** The caller's transaction, so the lookups don't wait on a second pool connection. */
    manager?: EntityManager;
  }): Promise<NotificationReferences> {
    const { contents, targets, manager } = params;
    const refIds = collectReferenceIds(contents);
    const repo = <T extends ObjectLiteral>(fallback: Repository<T>) =>
      manager ? manager.getRepository(fallback.target) : fallback;

    const [comments, actionUpdates] = await Promise.all([
      findIn(idsOf(targets, ContentTargetType.Comment), (id) =>
        repo(this.commentRepository).find({
          where: { id, deleted: false },
          relations: { author: true, editableContent: true },
        }),
      ),
      findIn(idsOf(targets, ContentTargetType.ActionUpdate), (id) =>
        repo(this.actionUpdateRepository).find({ where: { id } }),
      ),
    ]);

    const [activities, users, communities, actions] = await Promise.all([
      findIn(parentIdsOf(comments, CommentParentObject.Activity), (id) =>
        repo(this.activityRepository).find({ where: { id } }),
      ),
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
      comments: new Map(comments.map((comment) => [comment.id, comment])),
      actionUpdates: new Map(
        actionUpdates.map((update) => [update.id, update]),
      ),
      activityActionIds: new Map(
        activities.map((activity) => [activity.id, activity.actionId]),
      ),
    };
  }
}
