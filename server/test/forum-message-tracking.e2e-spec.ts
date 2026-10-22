import { EventLog, EventType } from "src/eventlog/event-log.entity";
import { CreateCommentDto } from "src/forum/dto/comment.dto";
import { CreatePostDto } from "src/forum/dto/post.dto";
import { CommentParentObject } from "src/forum/entities/comment.entity";
import { Post } from "src/forum/entities/post.entity";
import {
  MessageSource,
  MessageTracking,
} from "src/link-tracking/message-tracking.entity";
import { Mail } from "src/mail/mail.entity";
import { Mms } from "src/mms/mms.entity";
import { NotificationKind } from "src/notification-settings/notification-kind";
import { NotificationChannel } from "src/notifs/notif-utils";
import { User } from "src/user/entities/user.entity";
import request from "supertest";
import { Raw } from "typeorm";
import {
  createTestApp,
  eventually,
  giveActiveContract,
  setPreference,
  signAccessToken,
  TestContext,
} from "./e2e-test-utils";

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

  const createTextableMember = async (params: {
    email: string;
    phoneNumber: string;
  }) => {
    const users = ctx.dataSource.getRepository(User);
    const user = await users.save(
      users.create({
        ...params,
        password: "pass",
        name: "Textable Member",
        tags: [ctx.defaultTag],
      }),
    );
    await giveActiveContract(ctx, user.id);
    return user;
  };

  const repliesSentTo = async (user: User) => ({
    mails: await ctx.dataSource.getRepository(Mail).countBy({ to: user.email }),
    texts: await ctx.dataSource
      .getRepository(Mms)
      .countBy({ to: user.phoneNumber ?? "" }),
  });

  beforeAll(async () => {
    ctx = await createTestApp([]);
    const users = ctx.dataSource.getRepository(User);
    member = await users.save(
      users.create({
        email: "replied@example.com",
        password: "pass",
        name: "Replied Member",
        tags: [ctx.defaultTag],
      }),
    );
    await giveActiveContract(ctx, member.id);
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

  it("texts and emails a reply when the member wants both", async () => {
    const textable = await createTextableMember({
      email: "both@example.com",
      phoneNumber: "+14155552671",
    });
    const parent = await comment(signAccessToken(ctx.jwtService, textable));
    await comment(ctx.accessToken, parent.id);

    expect(await repliesSentTo(textable)).toEqual({ mails: 1, texts: 1 });
  });

  it.each([
    [NotificationChannel.Email, "+14155552672", { mails: 0, texts: 1 }],
    [NotificationChannel.Text, "+14155552673", { mails: 1, texts: 0 }],
  ])(
    "skips %p when the member turned it off for comments and replies",
    async (channel, phoneNumber, sent) => {
      const textable = await createTextableMember({
        email: `${channel}-off@example.com`,
        phoneNumber,
      });
      await setPreference(ctx, {
        userId: textable.id,
        kind: NotificationKind.CommentsAndReplies,
        channel,
        enabled: false,
      });
      const parent = await comment(signAccessToken(ctx.jwtService, textable));
      await comment(ctx.accessToken, parent.id);

      expect(await repliesSentTo(textable)).toEqual(sent);
    },
  );

  it("logs a reply that goes by neither text nor email", async () => {
    const textable = await createTextableMember({
      email: "neither@example.com",
      phoneNumber: "+14155552674",
    });
    for (const channel of [
      NotificationChannel.Text,
      NotificationChannel.Email,
    ]) {
      await setPreference(ctx, {
        userId: textable.id,
        kind: NotificationKind.CommentsAndReplies,
        channel,
        enabled: false,
      });
    }
    const parent = await comment(signAccessToken(ctx.jwtService, textable));
    const reply = await comment(ctx.accessToken, parent.id);

    expect(await repliesSentTo(textable)).toEqual({ mails: 0, texts: 0 });
    await eventually(
      () =>
        ctx.dataSource.getRepository(EventLog).findBy({
          event: EventType.ForumReplyNotifFailure,
          blob: Raw((blob) => `${blob} @> :blob`, {
            blob: { commentId: reply.id },
          }),
        }),
      (rows) => rows.length === 1,
      "a reply-notification failure log",
    );
  });
});
