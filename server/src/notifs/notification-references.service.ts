import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { isActionUpdatePublished } from "src/actions/action-update-visibility";
import { ActionVisibilityService } from "src/actions/action-visibility.service";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import { ActionUpdate } from "src/actions/entities/action-update.entity";
import { Action } from "src/actions/entities/action.entity";
import { Community } from "src/community/entities/community.entity";
import {
  Comment,
  CommentParentObject,
} from "src/forum/entities/comment.entity";
import { Post } from "src/forum/entities/post.entity";
import { filterVisiblePosts } from "src/forum/post-visibility";
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

export type RecipientAccess = {
  /** Only comments the recipient can still open. */
  comments: ReadonlyMap<number, Comment>;
  /** Only published action updates the recipient can still open. */
  actionUpdates: ReadonlyMap<number, ActionUpdate>;
  isAvailable: (target: ContentTarget) => boolean;
};

export type NotificationReferences = ResolvedReferences & {
  activityActionIds: ReadonlyMap<number, number>;
  accessFor: (recipientId: number) => RecipientAccess;
  /** Legacy rows keep their old check: the content still exists. */
  legacyAccess: Pick<RecipientAccess, "comments" | "actionUpdates">;
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
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(ActionActivity)
    private readonly activityRepository: Repository<ActionActivity>,
    @InjectRepository(ActionUpdate)
    private readonly actionUpdateRepository: Repository<ActionUpdate>,
    private readonly actionVisibility: ActionVisibilityService,
  ) {}

  async resolve(params: {
    contents: NotificationContent[];
    /** `accessFor` checks a recipient's actions only among its own targets. */
    targetsByRecipient: ReadonlyMap<number, ContentTarget[]>;
    /** Loaded into `legacyAccess` with no access check. */
    legacyTargets?: ContentTarget[];
    /**
     * The caller's transaction, so the lookups don't wait on a second pool
     * connection. Action visibility for the recipients still reads outside it.
     */
    manager?: EntityManager;
  }): Promise<NotificationReferences> {
    const {
      contents,
      targetsByRecipient,
      legacyTargets = [],
      manager,
    } = params;
    const recipientIds = [...targetsByRecipient.keys()];
    const gatedTargets = [...targetsByRecipient.values()].flat();
    const targets = [...gatedTargets, ...legacyTargets];
    const refIds = collectReferenceIds(contents);
    const repo = <T extends ObjectLiteral>(fallback: Repository<T>) =>
      manager ? manager.getRepository(fallback.target) : fallback;

    // The database's clock, which decides when a row comes due, so an entry
    // due when its post is scheduled, its update publishes, or its action
    // launches also reads that content as visible. Live cohort membership
    // still reads the server's clock.
    const [{ now }] = targets.length
      ? await repo(this.actionUpdateRepository).query<{ now: Date }[]>(
          "SELECT now() AS now",
        )
      : [{ now: new Date() }];

    const [comments, actionUpdates] = await Promise.all([
      findIn(idsOf(targets, ContentTargetType.Comment), (id) =>
        repo(this.commentRepository).find({
          where: { id },
          relations: { author: true, editableContent: true },
        }),
      ),
      findIn(idsOf(targets, ContentTargetType.ActionUpdate), (id) =>
        repo(this.actionUpdateRepository).find({ where: { id } }),
      ),
    ]);

    const gatedCommentIds = new Set(
      idsOf(gatedTargets, ContentTargetType.Comment),
    );
    const postIds = [
      ...new Set([
        ...idsOf(gatedTargets, ContentTargetType.Post),
        ...parentIdsOf(
          comments.filter((comment) => gatedCommentIds.has(comment.id)),
          CommentParentObject.Post,
        ),
      ]),
    ];
    const [visiblePosts, activities, users, communities, actions] =
      await Promise.all([
        postIds.length && recipientIds.length
          ? filterVisiblePosts({
              qb: repo(this.postRepository)
                .createQueryBuilder("post")
                .innerJoin(User, "viewer", "viewer.id IN (:...recipientIds)", {
                  recipientIds,
                })
                .select("post.id", "postId")
                .addSelect("viewer.id", "viewerId")
                .where("post.id IN (:...postIds)", { postIds }),
              postAlias: "post",
              viewerIdSql: "viewer.id",
              now,
            }).getRawMany<{ postId: number; viewerId: number }>()
          : [],
        findIn(
          [
            ...idsOf(targets, ContentTargetType.Activity),
            ...parentIdsOf(comments, CommentParentObject.Activity),
          ],
          (id) => repo(this.activityRepository).find({ where: { id } }),
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

    const activityActionIds = new Map(
      activities.map((activity) => [activity.id, activity.actionId]),
    );
    const commentById = new Map(
      comments.map((comment) => [comment.id, comment]),
    );
    const actionUpdateById = new Map(
      actionUpdates.map((update) => [update.id, update]),
    );
    // The post or action whose visibility decides whether a target opens.
    const gateOf = (
      target: ContentTarget,
    ): { postId: number } | { actionId: number } | undefined => {
      const onAction = (actionId: number | undefined) =>
        actionId === undefined ? undefined : { actionId };
      switch (target.type) {
        case ContentTargetType.Post:
          return { postId: target.id };
        case ContentTargetType.Activity:
          return onAction(activityActionIds.get(target.id));
        case ContentTargetType.ActionUpdate:
          return onAction(actionUpdateById.get(target.id)?.actionId);
        case ContentTargetType.Comment: {
          const comment = commentById.get(target.id);
          if (!comment) return undefined;
          switch (comment.parentObjectType) {
            case CommentParentObject.Post:
              return { postId: comment.parentObjectId };
            case CommentParentObject.Action:
              return { actionId: comment.parentObjectId };
            case CommentParentObject.Activity:
              return onAction(activityActionIds.get(comment.parentObjectId));
            default:
              throw new Error(
                `unknown comment parent: ${comment.parentObjectType satisfies never}`,
              );
          }
        }
        default:
          throw new Error(
            `unknown content target: ${target.type satisfies never}`,
          );
      }
    };

    const visibleByRecipient =
      await this.actionVisibility.openableActionIdsForUsers({
        actionIdsByUser: new Map(
          [...targetsByRecipient].map(([recipientId, recipientTargets]) => [
            recipientId,
            recipientTargets.flatMap((target) => {
              const gate = gateOf(target);
              return gate && "actionId" in gate ? [gate.actionId] : [];
            }),
          ]),
        ),
        now,
      });

    const visiblePostsByViewer = Map.groupBy(
      visiblePosts,
      (row) => row.viewerId,
    );
    const publishedUpdates = actionUpdates.filter((update) =>
      isActionUpdatePublished(update, now),
    );

    const recipientAccess = (
      recipientId: number,
      visibleActionIds: ReadonlySet<number>,
    ): RecipientAccess => {
      const visiblePostIds = new Set(
        (visiblePostsByViewer.get(recipientId) ?? []).map((row) => row.postId),
      );
      const gateOpen = (target: ContentTarget) => {
        const gate = gateOf(target);
        if (!gate) return false;
        return "postId" in gate
          ? visiblePostIds.has(gate.postId)
          : visibleActionIds.has(gate.actionId);
      };

      const availableComments = new Map(
        comments
          .filter(
            (comment) =>
              comment.editableContent &&
              gateOpen({ type: ContentTargetType.Comment, id: comment.id }),
          )
          .map((comment) => [comment.id, comment]),
      );
      const availableActionUpdates = new Map(
        publishedUpdates
          .filter((update) =>
            gateOpen({ type: ContentTargetType.ActionUpdate, id: update.id }),
          )
          .map((update) => [update.id, update]),
      );

      return {
        comments: availableComments,
        actionUpdates: availableActionUpdates,
        isAvailable: (target) => {
          switch (target.type) {
            case ContentTargetType.Post:
            case ContentTargetType.Activity:
              return gateOpen(target);
            case ContentTargetType.Comment:
              return availableComments.has(target.id);
            case ContentTargetType.ActionUpdate:
              return availableActionUpdates.has(target.id);
            default:
              throw new Error(
                `unknown content target: ${target.type satisfies never}`,
              );
          }
        },
      };
    };

    const accessByRecipient = new Map(
      [...visibleByRecipient].map(([recipientId, visibleActionIds]) => [
        recipientId,
        recipientAccess(recipientId, visibleActionIds),
      ]),
    );

    return {
      users: new Map(users.map((user) => [user.id, user])),
      communities: new Map(communities.map((c) => [c.id, c])),
      actions: new Map(actions.map((a) => [a.id, a])),
      activityActionIds,
      legacyAccess: {
        comments: commentById,
        actionUpdates: actionUpdateById,
      },
      accessFor: (recipientId) => {
        const access = accessByRecipient.get(recipientId);
        if (!access) {
          throw new Error(`recipient ${recipientId} was not resolved`);
        }
        return access;
      },
    };
  }
}
