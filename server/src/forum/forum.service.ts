import { isPostAuthor } from "@alliance/common/postAuthors";
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository as TypedRepository } from "src/utils/Repository";
import {
  In,
  IsNull,
  type ObjectLiteral,
  type Repository,
  type SelectQueryBuilder,
} from "typeorm";
import { User } from "../user/entities/user.entity";
import { CreatePostDto, PostDtoArgs, UpdatePostDto } from "./dto/post.dto";
import { Comment, CommentParentObject } from "./entities/comment.entity";
import { EditableContent } from "./entities/editablecontent.entity";
import { parsePost, Post, type ParsedPost } from "./entities/post.entity";
import { byForumListOrder } from "./forum-list-order";
import { lockLiveAction, lockLiveAuthor } from "./forum-locks";
import { countThreadComments, hiddenCommentIds } from "./hidden-comments";
import { filterVisiblePosts } from "./post-visibility";

@Injectable()
export class ForumService {
  constructor(
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(EditableContent)
    private editableContentRepository: TypedRepository<EditableContent>,
  ) {}

  async createPost(
    createPostDto: CreatePostDto,
    userId: number,
  ): Promise<ParsedPost> {
    const user = await this.userRepository.findOneOrFail({
      where: { id: userId },
    });
    let visibleAt = new Date();
    if (
      createPostDto.visibleAt &&
      new Date(createPostDto.visibleAt) > visibleAt
    ) {
      visibleAt = new Date(createPostDto.visibleAt);
    }
    return this.postRepository.manager.transaction(async (manager) => {
      await lockLiveAuthor(manager, userId);
      if (createPostDto.actionId != null) {
        await lockLiveAction(manager, createPostDto.actionId);
      }
      const content = await manager.save(
        manager.create(EditableContent, {
          body: createPostDto.editableContent.body,
          attachments: createPostDto.editableContent.attachments ?? [],
        }),
      );
      const post = manager.create(Post, {
        title: createPostDto.title,
        actionId: createPostDto.actionId,
        author: user,
        authorId: user.id,
        editableContent: content,
        visibleAt,
        likes: [],
      });
      return parsePost(await manager.save(post));
    });
  }

  addPostVisibilityFilter<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    postAlias: string,
    userId?: number,
  ): SelectQueryBuilder<T> {
    if (userId === undefined) {
      return filterVisiblePosts({ qb, postAlias });
    }
    qb.setParameter("postVisibility_userId", userId);
    return filterVisiblePosts({
      qb,
      postAlias,
      viewerIdSql: ":postVisibility_userId",
    });
  }

  async findAllPosts(userId?: number): Promise<PostDtoArgs[]> {
    const qb = this.postRepository
      .createQueryBuilder("post")
      .leftJoinAndSelect("post.author", "author")
      .leftJoinAndSelect("post.action", "action")
      .leftJoinAndSelect("post.editableContent", "editableContent")
      .orderBy("post.updatedAt", "DESC");
    this.addPostVisibilityFilter(qb, "post", userId);

    const posts = await qb.getMany();

    if (!posts.length) {
      return [];
    }

    const postIds = posts.map((p) => p.id);
    const hiddenIds = await hiddenCommentIds(
      this.commentRepository.manager,
      postIds,
    );
    const commentCounts = await countThreadComments(
      this.commentRepository.manager,
      {
        postIds,
        hiddenIds,
      },
    );

    const postsWithAuthors = await this.postRepository.find({
      where: { id: In(postIds) },
      relations: { authors: true, likes: true, action: { reviewers: true } },
      relationLoadStrategy: "query",
    });
    const relationsByPostId = new Map(postsWithAuthors.map((p) => [p.id, p]));
    for (const post of posts) {
      const loaded = relationsByPostId.get(post.id);
      post.authors = loaded?.authors ?? [];
      post.likes = loaded?.likes ?? [];
      post.likesIds = loaded?.likesIds ?? [];
      if (post.action) {
        post.action.reviewers = loaded?.action?.reviewers;
      }
    }

    // 3) Fetch last comment per post in one query using DISTINCT ON (Postgres)
    const lastComments = await this.commentRepository
      .createQueryBuilder("comment")
      .innerJoinAndSelect("comment.author", "author")
      .leftJoinAndSelect("comment.editableContent", "editableContent")
      .where("comment.parentObjectType = :parentType", {
        parentType: CommentParentObject.Post,
      })
      .andWhere("NOT (comment.id = ANY(:hiddenIds))", { hiddenIds })
      .andWhere("comment.parentObjectId IN (:...postIds)", { postIds })
      .distinctOn(["comment.parentObjectId"])
      .orderBy("comment.parentObjectId", "ASC")
      .addOrderBy("comment.createdAt", "DESC") // latest for each post
      .getMany();

    const lastCommentByPostId = new Map<number, Comment>(
      lastComments.map((c) => [c.parentObjectId, c]),
    );

    return posts
      .map((post) => ({
        post: parsePost(post),
        commentCount: commentCounts.get(post.id) ?? 0,
        lastComment: lastCommentByPostId.get(post.id) ?? undefined,
      }))
      .sort(byForumListOrder);
  }

  async findPostsByAction(params: {
    actionId: number;
    requestingUserId?: number;
  }): Promise<ParsedPost[]> {
    const { actionId, requestingUserId } = params;
    const qb = this.postRepository
      .createQueryBuilder("post")
      .leftJoinAndSelect("post.author", "author")
      .leftJoinAndSelect("post.action", "action")
      .leftJoinAndSelect("action.reviewers", "actionReviewer")
      .leftJoinAndSelect("post.editableContent", "editableContent")
      .leftJoinAndSelect("post.authors", "authors")
      .leftJoinAndSelect("post.likes", "likes")
      .where("post.actionId = :actionId", { actionId })
      .orderBy("post.updatedAt", "DESC");
    this.addPostVisibilityFilter(qb, "post", requestingUserId);
    return (await qb.getMany()).map(parsePost);
  }

  private visiblePostQuery(id: number, userId?: number) {
    return this.addPostVisibilityFilter(
      this.postRepository
        .createQueryBuilder("post")
        .where("post.id = :id", { id }),
      "post",
      userId,
    );
  }

  private async findOneVisiblePost(
    id: number,
    userId?: number,
  ): Promise<ParsedPost> {
    const post = await this.visiblePostQuery(id, userId)
      .leftJoinAndSelect("post.author", "author")
      .leftJoinAndSelect("post.action", "action")
      .leftJoinAndSelect("action.reviewers", "actionReviewer")
      .leftJoinAndSelect("post.editableContent", "editableContent")
      .leftJoinAndSelect("post.authors", "authors")
      .leftJoinAndSelect("post.likes", "likes")
      .leftJoinAndSelect("post.tags", "tags")
      .getOne();
    if (!post) {
      throw new NotFoundException(`Post with ID "${id}" not found`);
    }
    return parsePost(post);
  }

  async isPostVisible(id: number, userId?: number): Promise<boolean> {
    return this.visiblePostQuery(id, userId).getExists();
  }

  async assertPostVisible(id: number, userId?: number): Promise<void> {
    if (!(await this.isPostVisible(id, userId))) {
      throw new NotFoundException(`Post with ID "${id}" not found`);
    }
  }

  async findOnePostFull(id: number, userId?: number): Promise<ParsedPost> {
    return this.findOneVisiblePost(id, userId);
  }

  async findOnePost(id: number, userId?: number): Promise<ParsedPost> {
    return this.findOneVisiblePost(id, userId);
  }

  async updatePost(
    id: number,
    updatePostDto: UpdatePostDto,
    userId: number,
  ): Promise<ParsedPost> {
    const post = await this.findOnePost(id, userId);

    if (!isPostAuthor(post, userId)) {
      throw new NotFoundException("You can only edit your own posts");
    }

    await this.postRepository.manager.transaction(async (manager) => {
      if (
        updatePostDto.actionId != null &&
        updatePostDto.actionId !== post.actionId
      ) {
        await lockLiveAction(manager, updatePostDto.actionId);
      }
      await manager.update(Post, id, {
        title: updatePostDto.title ?? post.title,
        ...(updatePostDto.actionId != null && {
          actionId: updatePostDto.actionId,
        }),
        visibleAt: updatePostDto.visibleAt ?? post.visibleAt,
      });
    });
    if (updatePostDto.editableContent && post.editableContent) {
      const ec = await this.editableContentRepository.findOneBy({
        id: post.editableContent.id,
      });
      if (ec) {
        ec.body = updatePostDto.editableContent.body ?? ec.body;
        ec.attachments =
          updatePostDto.editableContent.attachments ?? ec.attachments;
        await this.editableContentRepository.save(ec);
      }
    }
    return this.findOnePost(id, userId);
  }

  async removePost(id: number, userId: number): Promise<void> {
    const post = await this.findOnePost(id, userId);

    if (!isPostAuthor(post, userId)) {
      throw new NotFoundException("You can only delete your own posts");
    }

    await this.postRepository.update(
      { id, deletedAt: IsNull() },
      { deletedAt: () => "CURRENT_TIMESTAMP", legacyDeleted: true },
    );
  }

  async findPostsByUser(params: {
    authorId: number;
    requestingUserId?: number;
  }): Promise<ParsedPost[]> {
    const { authorId, requestingUserId } = params;
    const qb = this.postRepository
      .createQueryBuilder("post")
      .leftJoinAndSelect("post.author", "author")
      .leftJoinAndSelect("post.action", "action")
      .leftJoinAndSelect("action.reviewers", "actionReviewer")
      .leftJoinAndSelect("post.editableContent", "editableContent")
      .leftJoinAndSelect("post.authors", "authors")
      .leftJoin("post.authors", "coAuthor")
      .andWhere("(post.authorId = :authorId OR coAuthor.id = :authorId)", {
        authorId,
      });
    this.addPostVisibilityFilter(qb, "post", requestingUserId);
    return (await qb.getMany()).map(parsePost);
  }

  async findPostsByTitle(params: {
    title: string;
    requestingUserId: number;
  }): Promise<Post[]> {
    const { title, requestingUserId } = params;
    const qb = this.postRepository
      .createQueryBuilder("post")
      .where("post.title ILIKE :title", { title: `%${title}%` });
    this.addPostVisibilityFilter(qb, "post", requestingUserId);
    return qb.getMany();
  }
}
