import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import { LikeNotificationService } from "src/notifs/like-notification.service";
import { commentUrl, postUrl } from "src/search/approutes";
import { isUniqueViolation } from "src/utils/db-errors";
import type { Repository } from "typeorm";
import { User } from "../user/entities/user.entity";
import { assertCommentParentNotInStaffPreview } from "./comment-staff-preview";
import {
  Comment,
  CommentParentObject,
  loadedCommentAuthor,
} from "./entities/comment.entity";
import { Post } from "./entities/post.entity";
import { ForumService } from "./forum.service";
import { isCommentHidden } from "./hidden-comments";

@Injectable()
export class ForumLikesService {
  constructor(
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(ActionActivity)
    private actionActivityRepository: Repository<ActionActivity>,
    private readonly likeNotificationService: LikeNotificationService,
    private readonly forumService: ForumService,
  ) {}

  private async refreshLikesCount(comment: Comment): Promise<void> {
    const result = await this.commentRepository
      .createQueryBuilder("comment")
      .innerJoin("comment.likes", "like")
      .where("comment.id = :id", { id: comment.id })
      .select("COUNT(*)", "count")
      .getRawOne<{ count: string }>();
    await this.commentRepository.update(comment.id, {
      likesCount: Number(result?.count ?? 0),
    });
  }

  async likePostOrComment(
    id: number,
    userId: number,
    unlike = false,
    type: "comment" | "post",
  ): Promise<void> {
    const object =
      type === "comment"
        ? await this.commentRepository.findOne({
            where: { id },
            relations: { likes: true, author: true, editableContent: true },
          })
        : await this.postRepository.findOne({
            where: { id },
            relations: { likes: true, author: true, authors: true },
          });

    if (
      !object ||
      !(await this.isLikeTargetVisible(object, userId)) ||
      ("parentObjectType" in object &&
        (await isCommentHidden(this.commentRepository.manager, object)))
    ) {
      throw new NotFoundException(`${type} with ID "${id}" not found`);
    }
    if ("parentObjectType" in object) {
      await assertCommentParentNotInStaffPreview(
        this.commentRepository.manager,
        object,
      );
    }

    const user = await this.userRepository.findOneOrFail({
      where: { id: userId },
    });

    const likes = object.likes ?? [];
    if (unlike) {
      if (!likes.some((like) => like.id === userId)) {
        throw new NotFoundException(`User has not liked this ${type}`);
      }
    } else if (likes.some((like) => like.id === userId)) {
      throw new NotFoundException(`User has already liked this ${type}`);
    }
    const likeRows = this.postRepository.manager
      .createQueryBuilder()
      .relation(type === "comment" ? Comment : Post, "likes")
      .of(id);
    try {
      await (unlike ? likeRows.remove(userId) : likeRows.add(userId));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      throw new NotFoundException(`User has already liked this ${type}`);
    }

    if (type === "comment") {
      await this.refreshLikesCount(object as Comment);
    }

    if (!unlike) {
      if (type === "comment") {
        await this.sendCommentLikeNotification(object as Comment, user);
      } else {
        await this.sendPostLikeNotification(object as Post, user);
      }
    } else {
      if (type === "comment") {
        await this.removeCommentLikeNotification(object as Comment, user);
      } else {
        await this.removePostLikeNotification(object as Post, user);
      }
    }
  }

  private async isLikeTargetVisible(
    target: Post | Comment,
    userId: number,
  ): Promise<boolean> {
    if (!("parentObjectType" in target)) {
      return this.forumService.isPostVisible(target.id, userId);
    }
    return (
      target.parentObjectType !== CommentParentObject.Post ||
      this.forumService.isPostVisible(target.parentObjectId, userId)
    );
  }

  private getUniquePostAuthors(post: Post): User[] {
    if (!post.author) {
      throw new Error(`Post ${post.id} was loaded without author`);
    }
    const allAuthors: User[] = [post.author];
    if (post.authors?.length) {
      allAuthors.push(...post.authors);
    }
    const seenIds = new Set<number>();
    return allAuthors.filter((u) => {
      if (seenIds.has(u.id)) return false;
      seenIds.add(u.id);
      return true;
    });
  }

  private async sendPostLikeNotification(post: Post, liker: User) {
    for (const owner of this.getUniquePostAuthors(post)) {
      if (owner.id === liker.id) {
        continue;
      }
      await this.likeNotificationService.createOrUpdate({
        owner,
        liker,
        targetType: "post",
        targetId: post.id,
        targetContent: post.title,
        webAppLocation: postUrl(post.id),
      });
    }
  }

  private async sendCommentLikeNotification(comment: Comment, liker: User) {
    if (comment.authorId === liker.id) {
      return;
    }
    let actionIdForActivity: number | undefined;
    if (comment.parentObjectType === CommentParentObject.Activity) {
      const activity = await this.actionActivityRepository.findOne({
        where: { id: comment.parentObjectId },
      });
      if (!activity) {
        return;
      }
      actionIdForActivity = activity.actionId;
    }
    const webAppLocation = commentUrl(comment, actionIdForActivity);
    if (!webAppLocation) {
      return;
    }
    await this.likeNotificationService.createOrUpdate({
      owner: loadedCommentAuthor(comment),
      liker,
      targetType: "comment",
      targetId: comment.id,
      targetContent: comment.editableContent?.body ?? null,
      webAppLocation,
    });
  }

  private async removePostLikeNotification(post: Post, unliker: User) {
    for (const owner of this.getUniquePostAuthors(post)) {
      if (owner.id === unliker.id) {
        continue;
      }
      await this.likeNotificationService.removeOnUnlike({
        ownerId: owner.id,
        unlikerId: unliker.id,
        targetType: "post",
        targetId: post.id,
      });
    }
  }

  private async removeCommentLikeNotification(comment: Comment, unliker: User) {
    if (comment.authorId === unliker.id) {
      return;
    }
    await this.likeNotificationService.removeOnUnlike({
      ownerId: comment.authorId,
      unlikerId: unliker.id,
      targetType: "comment",
      targetId: comment.id,
    });
  }
}
