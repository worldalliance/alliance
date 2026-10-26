import { NotFoundException } from "@nestjs/common";
import { softDeleteCascade } from "src/datasources/soft-delete";
import {
  Comment,
  CommentParentObject,
} from "src/forum/entities/comment.entity";
import { Post } from "src/forum/entities/post.entity";
import { ForumCommentService } from "src/forum/forum-comment.service";
import { ForumService } from "src/forum/forum.service";
import { User } from "src/user/entities/user.entity";
import { createTestApp, TestContext, waitForLockWait } from "./e2e-test-utils";
import { createForumSoftDeleteFixtures } from "./forum-soft-delete-fixtures";

describe("Forum deletion concurrency (e2e)", () => {
  let ctx: TestContext;
  const { member, createPost, comment } = createForumSoftDeleteFixtures(
    () => ctx,
  );

  beforeAll(async () => {
    ctx = await createTestApp([]);
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it("takes concurrent comments on one post", async () => {
    const postId = await createPost(ctx.accessToken);
    const commenters = await Promise.all([1, 2, 3, 4, 5].map(() => member()));

    const responses = await Promise.all(
      commenters.map((commenter) => comment({ ...commenter, postId })),
    );

    expect(responses.map((response) => response.status)).toEqual(
      commenters.map(() => 201),
    );
  });

  it("refuses a post or comment by an account deleted while it waits", async () => {
    const author = await member();
    const postId = await createPost(ctx.accessToken);
    const forum = ctx.app.get(ForumService);
    const commentService = ctx.app.get(ForumCommentService);
    const deletion = ctx.dataSource.createQueryRunner();
    await deletion.startTransaction();
    try {
      await softDeleteCascade(deletion.manager, {
        target: User,
        ids: [author.user.id],
      });
      const settle = (write: Promise<unknown>) =>
        write.then(
          () => "written",
          (error: unknown) => error,
        );
      const posted = settle(
        forum.createPost(
          {
            title: "Raced",
            editableContent: { body: "Raced", attachments: [] },
          },
          author.user.id,
        ),
      );
      const commented = settle(
        commentService.createComment(
          {
            parentObjectType: CommentParentObject.Post,
            parentObjectId: postId,
            editableContent: { body: "Raced", attachments: [] },
          },
          author.user.id,
        ),
      );
      await waitForLockWait(ctx.dataSource, 2);
      await deletion.commitTransaction();
      expect(await posted).toBeInstanceOf(NotFoundException);
      expect(await commented).toBeInstanceOf(NotFoundException);
    } finally {
      await deletion.release();
    }

    expect(
      await ctx.dataSource
        .getRepository(Post)
        .countBy({ authorId: author.user.id }),
    ).toBe(0);
  });

  it("refuses a comment on a post removed while it waits", async () => {
    const commenter = await member();
    const postId = await createPost(ctx.accessToken);
    const removal = ctx.dataSource.createQueryRunner();
    await removal.startTransaction();
    try {
      await removal.manager.update(
        Post,
        { id: postId },
        { deletedAt: () => "CURRENT_TIMESTAMP", legacyDeleted: true },
      );
      const commented = ctx.app
        .get(ForumCommentService)
        .createComment(
          {
            parentObjectType: CommentParentObject.Post,
            parentObjectId: postId,
            editableContent: { body: "Raced", attachments: [] },
          },
          commenter.user.id,
        )
        .then(
          () => "written",
          (error: unknown) => error,
        );
      await waitForLockWait(ctx.dataSource);
      await removal.commitTransaction();
      expect(await commented).toBeInstanceOf(NotFoundException);
    } finally {
      await removal.release();
    }

    expect(
      await ctx.dataSource
        .getRepository(Comment)
        .countBy({ parentObjectId: postId }),
    ).toBe(0);
  });

  it("refuses a reply to a comment removed while it waits", async () => {
    const replier = await member();
    const postId = await createPost(ctx.accessToken);
    const parentId: number = (
      await comment({ token: ctx.accessToken, postId }).expect(201)
    ).body.id;
    const removal = ctx.dataSource.createQueryRunner();
    await removal.startTransaction();
    try {
      await removal.manager.update(
        Comment,
        { id: parentId },
        { deletedAt: () => "CURRENT_TIMESTAMP", legacyDeleted: true },
      );
      const replied = ctx.app
        .get(ForumCommentService)
        .createComment(
          {
            parentObjectType: CommentParentObject.Post,
            parentObjectId: postId,
            parentId,
            editableContent: { body: "Raced", attachments: [] },
          },
          replier.user.id,
        )
        .then(
          () => "written",
          (error: unknown) => error,
        );
      await waitForLockWait(ctx.dataSource);
      await removal.commitTransaction();
      expect(await replied).toBeInstanceOf(NotFoundException);
    } finally {
      await removal.release();
    }

    expect(
      await ctx.dataSource.getRepository(Comment).countBy({ parentId }),
    ).toBe(0);
  });
});
