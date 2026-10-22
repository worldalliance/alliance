import {
  Comment,
  CommentParentObject,
} from "src/forum/entities/comment.entity";
import { EditableContent } from "src/forum/entities/editablecontent.entity";
import { Post } from "src/forum/entities/post.entity";
import { NotificationKind } from "src/notification-settings/notification-kind";
import { NotificationPreference } from "src/notification-settings/notification-preference.entity";
import {
  Notification,
  NotificationCategory,
} from "src/notifs/entities/notification.entity";
import {
  UnreadContent,
  UnreadContentType,
} from "src/notifs/entities/unread-content.entity";
import { LikeNotificationService } from "src/notifs/like-notification.service";
import { NotificationChannel } from "src/notifs/notif-utils";
import { notifMessage } from "src/notifs/notification-content";
import { NotifsService } from "src/notifs/notifs.service";
import { User } from "src/user/entities/user.entity";
import type { Repository } from "typeorm";
import { createTestApp, setPreference, TestContext } from "./e2e-test-utils";

describe("In-app visibility (e2e)", () => {
  let ctx: TestContext;
  let notifsService: NotifsService;
  let userRepo: Repository<User>;
  let notifRepo: Repository<Notification>;
  let preferenceRepo: Repository<NotificationPreference>;
  let recipient: User;
  let other: User;

  const sendFriendRequest = () =>
    notifsService.sendNotif({
      user: recipient,
      category: NotificationCategory.FriendRequest,
      message: notifMessage`Someone wants to be friends`,
      destination: null,
      webAppLocation: "/",
      associatedUsers: [],
    });

  const inboxIds = async (): Promise<number[]> =>
    (await ctx.agent.get("/notifs").expect(200)).body.map(
      (entry: { id: number }) => entry.id,
    );

  const unreadCount = async (): Promise<number> =>
    (await ctx.agent.get("/notifs/unread-count").expect(200)).body.unreadCount;

  const setInApp = (kind: NotificationKind, enabled: boolean) =>
    setPreference(ctx, {
      userId: recipient.id,
      kind,
      channel: NotificationChannel.InApp,
      enabled,
    });

  beforeAll(async () => {
    ctx = await createTestApp([]);
    notifsService = ctx.app.get(NotifsService);
    userRepo = ctx.dataSource.getRepository(User);
    notifRepo = ctx.dataSource.getRepository(Notification);
    preferenceRepo = ctx.dataSource.getRepository(NotificationPreference);
    recipient = await userRepo.findOneByOrFail({ id: ctx.testUserId });
    other = await userRepo.save(
      userRepo.create({
        email: "visibility-other@example.com",
        password: "pass",
        name: "Robin Liker",
      }),
    );
  }, 50000);

  beforeEach(async () => {
    await notifRepo.delete({ user: { id: recipient.id } });
    await ctx.dataSource
      .getRepository(UnreadContent)
      .delete({ user: { id: recipient.id } });
    await preferenceRepo.delete({ userId: recipient.id });
    await userRepo.update(recipient.id, { inAppByDefault: true });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("keeps a kind with in-app off out of the inbox and the unread count", async () => {
    await setInApp(NotificationKind.FriendRequests, false);

    const hidden = await sendFriendRequest();
    const shown = await notifsService.sendNotif({
      user: recipient,
      category: NotificationCategory.Likes,
      message: notifMessage`Someone liked your post`,
      destination: null,
      webAppLocation: "/",
      associatedUsers: [],
    });

    expect(hidden.visible).toBe(false);
    expect(hidden.shouldPush).toBe(true);
    expect(await inboxIds()).toEqual([shown.id]);
    expect(await unreadCount()).toBe(1);
  });

  it("follows the in-app default when the kind has no override", async () => {
    await userRepo.update(recipient.id, { inAppByDefault: false });
    await setInApp(NotificationKind.Likes, true);

    expect((await sendFriendRequest()).visible).toBe(false);
  });

  it("sets each recipient's visibility from their own setting", async () => {
    await setInApp(NotificationKind.FriendRequests, false);

    const rows = await notifsService.sendNotifs(
      [recipient, other, recipient].map((user) => ({
        user,
        category: NotificationCategory.FriendRequest,
        message: notifMessage`Someone wants to be friends`,
        destination: null,
        webAppLocation: "/",
        associatedUsers: [],
      })),
    );

    expect(rows.map((row) => row.visible)).toEqual([false, true, false]);
  });

  it("leaves earlier entries in place and reveals no backlog", async () => {
    const before = await sendFriendRequest();
    await setInApp(NotificationKind.FriendRequests, false);
    const during = await sendFriendRequest();

    expect(await inboxIds()).toEqual([before.id]);

    await setInApp(NotificationKind.FriendRequests, true);
    const after = await sendFriendRequest();

    expect((await inboxIds()).sort()).toEqual([before.id, after.id].sort());
    expect(await notifRepo.findOneByOrFail({ id: during.id })).toMatchObject({
      visible: false,
    });
  });

  it("sets visibility on unread content from its kind", async () => {
    await setInApp(NotificationKind.CommentsAndReplies, false);

    const row = await notifsService.sendUnreadContent({
      user: recipient,
      contentType: UnreadContentType.ForumReply,
      contentId: 1,
      authorId: other.id,
    });

    expect(row.visible).toBe(false);
    expect(row.shouldPush).toBe(true);
  });

  it("keeps hidden unread content out of the inbox and the unread count", async () => {
    const post = await ctx.dataSource.getRepository(Post).save({
      title: "Visibility post",
      author: recipient,
      authors: [],
      editableContent: { body: "Body", attachments: [] },
      deletedAt: null,
      visibleAt: new Date(),
    });
    const reply = async (body: string) =>
      notifsService.sendUnreadContent({
        user: recipient,
        contentType: UnreadContentType.ForumReply,
        contentId: (
          await ctx.dataSource.getRepository(Comment).save({
            author: other,
            authorId: other.id,
            editableContent: await ctx.dataSource
              .getRepository(EditableContent)
              .save({ body, attachments: [] }),
            parentObjectType: CommentParentObject.Post,
            parentObjectId: post.id,
            deletedAt: null,
            pinned: false,
            likesCount: 0,
          })
        ).id,
        authorId: other.id,
      });
    const shown = await reply("Shown reply");
    await setInApp(NotificationKind.CommentsAndReplies, false);
    await reply("Hidden reply");

    expect(await inboxIds()).toEqual([shown.id]);
    expect(await unreadCount()).toBe(1);
  });

  it("starts a new like entry instead of joining one with the other visibility", async () => {
    const likes = ctx.app.get(LikeNotificationService);
    const like = (liker: User) =>
      likes.createOrUpdate({
        owner: recipient,
        liker,
        targetType: "post",
        targetId: 991,
        webAppLocation: "/",
        targetContent: null,
      });
    await setInApp(NotificationKind.Likes, false);
    await like(other);
    await setInApp(NotificationKind.Likes, true);
    await like(
      await userRepo.save(
        userRepo.create({
          email: "visibility-second@example.com",
          password: "pass",
          name: "Sam Liker",
        }),
      ),
    );

    const rows = await notifRepo.find({
      where: {
        user: { id: recipient.id },
        category: NotificationCategory.Likes,
      },
      order: { id: "ASC" },
    });
    expect(rows.map((row) => [row.visible, row.groupingCount])).toEqual([
      [false, 1],
      [true, 1],
    ]);
  });

  it("removes an unlike from the entry the unliker joined", async () => {
    const likes = ctx.app.get(LikeNotificationService);
    const target = { targetType: "post", targetId: 992 } as const;
    const like = (liker: User) =>
      likes.createOrUpdate({
        owner: recipient,
        liker,
        ...target,
        webAppLocation: "/",
        targetContent: null,
      });
    const second = await userRepo.save(
      userRepo.create({
        email: "visibility-unliker@example.com",
        password: "pass",
        name: "Sam Unliker",
      }),
    );
    await setInApp(NotificationKind.Likes, false);
    await like(other);
    await setInApp(NotificationKind.Likes, true);
    await like(second);

    await likes.removeOnUnlike({
      ownerId: recipient.id,
      unlikerId: second.id,
      ...target,
    });

    const rows = await notifRepo.find({
      where: {
        user: { id: recipient.id },
        category: NotificationCategory.Likes,
      },
      relations: { associatedUsers: true },
    });
    expect(
      rows.map((row) => [row.visible, row.associatedUsers?.map((u) => u.id)]),
    ).toEqual([[false, [other.id]]]);
  });
});
