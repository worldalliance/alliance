import { CreateCommentDto } from "src/forum/dto/comment.dto";
import { CreatePostDto } from "src/forum/dto/post.dto";
import { CommentParentObject } from "src/forum/entities/comment.entity";
import { Post } from "src/forum/entities/post.entity";
import {
  MessageSource,
  MessageTracking,
} from "src/link-tracking/message-tracking.entity";
import { Mail } from "src/mail/mail.entity";
import {
  ContractEvent,
  ContractEventType,
} from "src/user/entities/contract-event.entity";
import { User } from "src/user/entities/user.entity";
import request from "supertest";
import { createTestApp, signAccessToken, TestContext } from "./e2e-test-utils";

describe("forum message tracking (e2e)", () => {
  let ctx: TestContext;
  let member: User;
  let memberToken: string;
  let postId: number;

  const comment = (token: string, parentId?: number) =>
    request(ctx.app.getHttpServer())
      .post("/forum/comments")
      .set("Authorization", `Bearer ${token}`)
      .send({
        editableContent: { body: "A reply", attachments: [] },
        parentObjectId: postId,
        parentId,
        parentObjectType: CommentParentObject.Post,
      } satisfies CreateCommentDto)
      .expect(201)
      .then((res) => res.body as { id: number });

  beforeAll(async () => {
    ctx = await createTestApp([]);
    const users = ctx.dataSource.getRepository(User);
    member = await users.save(
      users.create({
        email: "replied@example.com",
        password: "pass",
        name: "Replied Member",
        tags: [ctx.defaultTag],
        emailNotifsForActions: true,
        receiveReplyNotifications: true,
      }),
    );
    await ctx.dataSource.getRepository(ContractEvent).save({
      user: { id: member.id },
      type: ContractEventType.SIGNED,
      date: new Date(0),
      automatic: false,
      contractId: ctx.defaultContractId,
    });
    memberToken = signAccessToken(ctx.jwtService, member);
    const post = await request(ctx.app.getHttpServer())
      .post("/forum/posts")
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send({
        title: "Tracked post",
        editableContent: { body: "Body", attachments: [] },
        visibleAt: new Date(),
      } satisfies CreatePostDto)
      .expect(201);
    postId = post.body.id;
    await ctx.dataSource
      .getRepository(Post)
      .update(postId, { notifyForReplies: true });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("attributes a reply's email to the member replied to", async () => {
    const parent = await comment(memberToken);
    const reply = await comment(ctx.accessToken, parent.id);

    const mail = await ctx.dataSource
      .getRepository(Mail)
      .findOneByOrFail({ to: member.email });
    expect(
      await ctx.dataSource
        .getRepository(MessageTracking)
        .findOneByOrFail({ trackingId: mail.cid ?? "" }),
    ).toMatchObject({
      source: MessageSource.ForumReply,
      userId: member.id,
      waitlistEntryId: null,
      context: { postId, commentId: reply.id },
    });
  });
});
