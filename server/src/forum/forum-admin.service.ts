import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { findWithDeletedRoot } from "src/datasources/find-with-deleted-root";
import { assertLive, softDeleteCascade } from "src/datasources/soft-delete";
import type { EntityManager, Repository } from "typeorm";
import { User } from "../user/entities/user.entity";
import { UpdatePostTagsDto } from "./dto/post-tag.dto";
import { UpdatePostSettingsDto } from "./dto/post.dto";
import { Comment } from "./entities/comment.entity";
import { PostTag } from "./entities/post-tag.entity";
import { parsePost, Post, type ParsedPost } from "./entities/post.entity";
import { isCommentHidden } from "./hidden-comments";

@Injectable()
export class ForumAdminService {
  constructor(
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
  ) {}

  /** Targets the join rows, so a concurrent write to the post's other half
   * cannot read this one into a stale snapshot and write it back. */
  private async replacePostUsers(params: {
    manager: EntityManager;
    postId: number;
    relation: "experts" | "authors";
    userIds: number[];
    currentIds: number[];
  }): Promise<void> {
    const { manager, postId, relation, userIds, currentIds } = params;
    const next = new Set(userIds);
    const current = new Set(currentIds);
    const added = [...next].filter((id) => !current.has(id));
    await assertLive(manager, {
      rows: added.map((id) => ({ target: User, id })),
      gone: () =>
        new BadRequestException(
          `Cannot set ${relation}: one of those users no longer exists`,
        ),
    });
    await manager
      .createQueryBuilder()
      .relation(Post, relation)
      .of(postId)
      .addAndRemove(
        added,
        [...current].filter((id) => !next.has(id)),
      );
  }

  /** Locked so two writers cannot both diff against the same pre-state and
   * insert the same join row twice. */
  private async lockPost(
    manager: EntityManager,
    postId: number,
  ): Promise<Post> {
    const post = await manager.findOne(Post, {
      where: { id: postId },
      lock: { mode: "pessimistic_write" },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID "${postId}" not found`);
    }

    return post;
  }

  async findPostForAdmin(postId: number): Promise<ParsedPost> {
    const post = await findWithDeletedRoot(this.postRepository.manager, {
      target: Post,
      options: {
        where: { id: postId },
        relations: {
          author: true,
          action: { reviewers: true },
          editableContent: true,
          experts: true,
          authors: true,
          tags: true,
        },
      },
    }).getOne();

    if (!post) {
      throw new NotFoundException(`Post with ID "${postId}" not found`);
    }

    return parsePost(post);
  }

  async updatePostSettings(
    postId: number,
    settings: UpdatePostSettingsDto,
  ): Promise<ParsedPost> {
    const { expertIds, authorIds, tags, ...columns } = settings;

    await this.postRepository.manager.transaction(async (manager) => {
      const post = await this.lockPost(manager, postId);
      await manager.update(Post, postId, columns);
      await this.replacePostUsers({
        manager,
        postId,
        relation: "experts",
        userIds: expertIds,
        currentIds: post.expertIds,
      });
      await this.replacePostUsers({
        manager,
        postId,
        relation: "authors",
        userIds: authorIds,
        currentIds: post.authorIds,
      });
      if (tags) {
        await this.replacePostTags({ manager, postId, tags });
      }
    });

    return this.findPostForAdmin(postId);
  }

  async getPostsForAdmin(): Promise<ParsedPost[]> {
    const posts = await this.postRepository.find({
      relations: {
        author: true,
        experts: true,
        authors: true,
        editableContent: true,
        tags: true,
      },
      order: { createdAt: "DESC" },
    });
    return posts.map(parsePost);
  }

  /** The caller holds the post row locked, so no other save can commit tags
   * between the knownTagIds check and the writes it guards. */
  private async replacePostTags(params: {
    manager: EntityManager;
    postId: number;
    tags: UpdatePostTagsDto;
  }): Promise<void> {
    const {
      manager,
      postId,
      tags: { tags: tagInputs, knownTagIds },
    } = params;
    const names = tagInputs.map((input) => input.name);
    if (new Set(names).size !== names.length) {
      throw new BadRequestException("Tag names must be unique within a post");
    }
    // A tag named twice collapses into one kept row, and every tag the save
    // left out of that row is deleted.
    const ids = tagInputs.map((input) => input.id).filter((id) => id != null);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException("Each tag can appear once in a save");
    }

    const tagRepository = manager.getRepository(PostTag);
    const existing = await tagRepository.find({ where: { postId } });
    const existingIds = new Set(existing.map((tag) => tag.id));
    const known = new Set(knownTagIds);
    if (
      known.size !== existingIds.size ||
      [...existingIds].some((id) => !known.has(id))
    ) {
      throw new ConflictException(
        "Another admin changed this post's tags. Reload and try again.",
      );
    }
    const existingById = new Map(existing.map((tag) => [tag.id, tag]));
    const kept = tagInputs.map((input, index) => {
      if (input.id === undefined) {
        return tagRepository.create({
          postId,
          name: input.name,
          sortOrder: index,
        });
      }
      const tag = existingById.get(input.id);
      if (!tag) {
        throw new BadRequestException(
          `Tag ${input.id} does not belong to post ${postId}`,
        );
      }
      tag.name = input.name;
      tag.sortOrder = index;
      return tag;
    });
    const keptIds = new Set(
      kept.map((tag) => tag.id).filter((id) => id !== undefined),
    );
    const removed = existing.filter((tag) => !keptIds.has(tag.id));

    await softDeleteCascade(manager, {
      target: PostTag,
      ids: removed.map((tag) => tag.id),
    });
    await tagRepository.save(kept);
  }

  async togglePinComment(commentId: number): Promise<Comment> {
    const comment = await this.commentRepository.findOneBy({ id: commentId });
    if (
      comment &&
      (await isCommentHidden(this.commentRepository.manager, comment))
    ) {
      throw new NotFoundException(`Comment with ID "${commentId}" not found`);
    }
    const { affected } = await this.commentRepository
      .createQueryBuilder()
      .update(Comment)
      .set({ pinned: () => `NOT "pinned"` })
      .where('id = :commentId AND "deletedAt" IS NULL', { commentId })
      .execute();
    if (!affected) {
      throw new NotFoundException(`Comment with ID "${commentId}" not found`);
    }

    return this.commentRepository.findOneOrFail({
      where: { id: commentId },
      relations: { author: true, editableContent: true, likes: true },
    });
  }
}
