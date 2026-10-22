import { milliseconds } from "date-fns";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
import { CreateCommentDto } from "src/forum/dto/comment.dto";
import { CommentParentObject } from "src/forum/entities/comment.entity";
import { Post } from "src/forum/entities/post.entity";
import {
  UnreadContent,
  UnreadContentType,
} from "src/notifs/entities/unread-content.entity";
import { SegmentType, UserNameForm } from "src/notifs/notification-content";
import { User } from "src/user/entities/user.entity";
import request from "supertest";
import type { Repository } from "typeorm";
import { createTestApp, signAccessToken, TestContext } from "./e2e-test-utils";

type InboxEntry = {
  contentId: number;
  message: string;
  webAppLocation: string;
};

describe("Action comment author notifications (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let postRepo: Repository<Post>;
  let unreadContentRepo: Repository<UnreadContent>;
  let testUser: User;
  let userCount = 0;

  const createUser = async () => {
    userCount += 1;
    const user = await userRepo.save(
      userRepo.create({
        email: `action-author-${userCount}@example.com`,
        password: "pass",
        name: `Author Test ${userCount}`,
        tags: [ctx.defaultTag],
      }),
    );
    return { user, token: signAccessToken(ctx.jwtService, user) };
  };

  const createAction = async (authors: User[]) => {
    const action = await ctx.dataSource.getRepository(Action).save({
      name: `Authored Action ${userCount}`,
      category: [],
      body: "Body",
      visibilityMode: VisibilityMode.Public,
      authors,
    });
    await ctx.dataSource.getRepository(ActionEvent).save({
      title: "Members act",
      description: "Member phase",
      newStatus: ActionStatus.MemberAction,
      date: new Date(Date.now() - milliseconds({ days: 1 })),
      action,
    });
    return action;
  };

  const createLinkedPost = (params: {
    action: Action;
    author: User;
    authors?: User[];
    visibleAt?: Date | null;
    deletedAt?: Date | null;
  }) =>
    postRepo.save({
      title: "Linked post",
      author: params.author,
      authors: params.authors ?? [],
      actionId: params.action.id,
      editableContent: { body: "Body", attachments: [] },
      visibleAt: params.visibleAt ?? null,
      deletedAt: params.deletedAt ?? null,
    });

  const comment = async (params: {
    token: string;
    action: Action;
    body: string;
    parentId?: number;
  }): Promise<number> =>
    (
      await request(ctx.app.getHttpServer())
        .post("/forum/comments")
        .set("Authorization", `Bearer ${params.token}`)
        .send({
          editableContent: { body: params.body, attachments: [] },
          parentObjectId: params.action.id,
          parentObjectType: CommentParentObject.Action,
          ...(params.parentId && { parentId: params.parentId }),
        } satisfies CreateCommentDto)
        .expect(201)
    ).body.id;

  const notifiedUserIds = async (commentId: number) =>
    (
      await ctx.dataSource.query<{ userId: number }[]>(
        `select "userId" from unread_content
         where "contentType" = $1 and "contentId" = $2 order by "userId"`,
        [UnreadContentType.ForumReply, commentId],
      )
    ).map((row) => row.userId);

  const testUserInbox = async (): Promise<InboxEntry[]> =>
    (await ctx.agent.get("/notifs").expect(200)).body;

  const testUserInboxEntry = async (commentId: number) =>
    (await testUserInbox()).filter((entry) => entry.contentId === commentId);

  beforeAll(async () => {
    ctx = await createTestApp([]);
    userRepo = ctx.dataSource.getRepository(User);
    postRepo = ctx.dataSource.getRepository(Post);
    unreadContentRepo = ctx.dataSource.getRepository(UnreadContent);
    testUser = await userRepo.findOneByOrFail({ id: ctx.testUserId });
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it("notifies action authors and visible linked post authors, never the commenter", async () => {
    const postAuthor = await createUser();
    const coAuthor = await createUser();
    const commenter = await createUser();
    const action = await createAction([testUser, commenter.user]);
    await createLinkedPost({
      action,
      author: postAuthor.user,
      authors: [coAuthor.user],
      visibleAt: new Date(Date.now() - milliseconds({ hours: 1 })),
    });

    const commentId = await comment({
      token: commenter.token,
      action,
      body: "I called today",
    });

    expect(await notifiedUserIds(commentId)).toEqual(
      [testUser.id, postAuthor.user.id, coAuthor.user.id].sort((a, b) => a - b),
    );
    expect(await testUserInboxEntry(commentId)).toEqual([
      expect.objectContaining({
        message: `${commenter.user.name} commented on ${action.name}: I called today`,
        webAppLocation: `/actions/${action.id}?replyId=${commentId}`,
      }),
    ]);
  });

  it("skips authors of scheduled and deleted linked posts", async () => {
    const scheduledAuthor = await createUser();
    const deletedAuthor = await createUser();
    const commenter = await createUser();
    const action = await createAction([]);
    await createLinkedPost({
      action,
      author: scheduledAuthor.user,
      visibleAt: new Date(Date.now() + milliseconds({ days: 1 })),
    });
    await createLinkedPost({
      action,
      author: deletedAuthor.user,
      deletedAt: new Date(),
    });

    const commentId = await comment({
      token: commenter.token,
      action,
      body: "Anyone here?",
    });

    expect(await notifiedUserIds(commentId)).toEqual([]);
  });

  it("sends one notification to someone who authored both the action and a linked post", async () => {
    const commenter = await createUser();
    const action = await createAction([testUser]);
    await createLinkedPost({ action, author: testUser, authors: [testUser] });

    const commentId = await comment({
      token: commenter.token,
      action,
      body: "Just once",
    });

    expect(await notifiedUserIds(commentId)).toEqual([testUser.id]);
  });

  it("notifies authors of replies, and gives an author being replied to only the reply notification", async () => {
    const otherAuthor = await createUser();
    const replier = await createUser();
    const action = await createAction([testUser, otherAuthor.user]);
    const parentId = await comment({
      token: ctx.accessToken,
      action,
      body: "Parent comment",
    });

    const replyId = await comment({
      token: replier.token,
      action,
      body: "A reply",
      parentId,
    });

    expect(await notifiedUserIds(replyId)).toEqual(
      [testUser.id, otherAuthor.user.id].sort((a, b) => a - b),
    );
    expect(await testUserInboxEntry(replyId)).toEqual([
      expect.objectContaining({ message: `${replier.user.name}: A reply` }),
    ]);
    const otherAuthorRow = await unreadContentRepo.findOneByOrFail({
      contentId: replyId,
      user: { id: otherAuthor.user.id },
    });
    expect(otherAuthorRow.content).toEqual({
      message: [
        {
          type: SegmentType.User,
          id: replier.user.id,
          name: UserNameForm.Public,
        },
        " commented on ",
        { type: SegmentType.Action, id: action.id },
        ": ",
        { type: SegmentType.CommentExcerpt },
      ],
    });
  });
});
