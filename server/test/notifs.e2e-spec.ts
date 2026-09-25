import { NOTIFS_LOADED_AT_HEADER } from "@alliance/common/notifs";
import { milliseconds } from "date-fns";
import {
  ActionUpdate,
  ActionUpdateNotifyType,
} from "src/actions/entities/action-update.entity";
import { Action } from "src/actions/entities/action.entity";
import {
  Comment,
  CommentParentObject,
} from "src/forum/entities/comment.entity";
import { EditableContent } from "src/forum/entities/editablecontent.entity";
import { NotifsModule } from "src/notifs/notifs.module";
import { FormSnapshot } from "src/tasks/entities/formsnapshot.entity";
import { User } from "src/user/entities/user.entity";
import type { Repository } from "typeorm";
import { NotificationSourceType } from "../src/notifs/dto/notification.dto";
import {
  Notification,
  NotificationCategory,
} from "../src/notifs/entities/notification.entity";
import {
  UnreadContent,
  UnreadContentType,
} from "../src/notifs/entities/unread-content.entity";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Notifications (e2e)", () => {
  let ctx: TestContext;
  let notifRepo: Repository<Notification>;
  let unreadContentRepo: Repository<UnreadContent>;
  let editableContentRepo: Repository<EditableContent>;
  let formSnapshotRepo: Repository<FormSnapshot>;
  let commentRepo: Repository<Comment>;
  let legacyNotifId: number;
  let unreadNotifId: number;
  let unreadCommentId: number;

  beforeAll(async () => {
    ctx = await createTestApp([NotifsModule]);
    notifRepo = ctx.dataSource.getRepository(Notification);
    unreadContentRepo = ctx.dataSource.getRepository(UnreadContent);
    editableContentRepo = ctx.dataSource.getRepository(EditableContent);
    formSnapshotRepo = ctx.dataSource.getRepository(FormSnapshot);
    commentRepo = ctx.dataSource.getRepository(Comment);
    const userRepo = ctx.dataSource.getRepository(User);

    const testUser = await userRepo.findOne({
      where: {
        id: ctx.testUserId,
      },
    });

    if (!testUser) {
      throw new Error("Test user not found");
    }

    const testNotif = notifRepo.create({
      user: testUser,
      message: "Test notification",
      category: NotificationCategory.FriendRequest,
      webAppLocation: "test",
      mobileAppLocation: "test",
    });
    await notifRepo.save(testNotif);
    legacyNotifId = testNotif.id;

    const editableContent = editableContentRepo.create({
      body: "Test unread reply body",
      attachments: [],
    });
    await editableContentRepo.save(editableContent);

    const comment = commentRepo.create({
      author: testUser,
      authorId: testUser.id,
      editableContent,
      parentObjectType: CommentParentObject.Post,
      parentObjectId: 1,
      deleted: false,
      pinned: false,
      likes: [],
      likesCount: 0,
      children: [],
    });
    await commentRepo.save(comment);
    unreadCommentId = comment.id;

    const unreadContent = unreadContentRepo.create({
      user: testUser,
      contentType: UnreadContentType.ForumReply,
      contentId: unreadCommentId,
      sendTime: new Date(),
      shouldPush: false,
    });
    await unreadContentRepo.save(unreadContent);
    unreadNotifId = unreadContent.id;
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it("user can list their notifications from both entities", async () => {
    const res = await ctx.agent.get("/notifs").expect(200);
    expect(res.body.length).toBe(2);
    expect(
      res.body.some(
        (notif: { id: number; category: string; sourceType: string }) =>
          notif.id === legacyNotifId &&
          notif.category === "friend_request" &&
          notif.sourceType === NotificationSourceType.Notification,
      ),
    ).toBe(true);
    expect(
      res.body.some(
        (notif: { id: number; category: string; sourceType: string }) =>
          notif.id === unreadNotifId &&
          notif.category === "forum_reply" &&
          notif.sourceType === NotificationSourceType.UnreadContent,
      ),
    ).toBe(true);
  });

  it("user can mark legacy notification as read", async () => {
    await ctx.agent
      .post(`/notifs/read/${legacyNotifId}`)
      .query({ sourceType: NotificationSourceType.Notification })
      .expect(201);

    const notifs = await ctx.agent.get("/notifs").expect(200);
    const notif = notifs.body.find(
      (item: { id: number; sourceType: string }) =>
        item.id === legacyNotifId &&
        item.sourceType === NotificationSourceType.Notification,
    );
    expect(notif?.readAt).toBeTruthy();
  });

  it("user can mark unread-content notification as read", async () => {
    await ctx.agent
      .post(`/notifs/read/${unreadNotifId}`)
      .query({ sourceType: NotificationSourceType.UnreadContent })
      .expect(201);

    const notifs = await ctx.agent.get("/notifs").expect(200);
    const notif = notifs.body.find(
      (item: { id: number; sourceType: string }) =>
        item.id === unreadNotifId &&
        item.sourceType === NotificationSourceType.UnreadContent,
    );
    expect(notif?.readAt).toBeTruthy();
  });

  it("user can mark all notifications read", async () => {
    await notifRepo.update(legacyNotifId, { readAt: null });
    await unreadContentRepo.update(unreadNotifId, { readAt: null });

    await ctx.agent.post("/notifs/read-all").expect(201);

    const notifs = await ctx.agent.get("/notifs").expect(200);
    expect(
      notifs.body.every((notif: { readAt?: string }) => notif.readAt),
    ).toBe(true);
  });

  it("mark all read leaves notifications that aren't due yet unread", async () => {
    const user = await ctx.dataSource
      .getRepository(User)
      .findOneByOrFail({ id: ctx.testUserId });
    const tomorrow = new Date(Date.now() + milliseconds({ days: 1 }));
    const futureNotif = await notifRepo.save(
      notifRepo.create({
        user,
        message: "Scheduled reminder",
        category: NotificationCategory.ActionEvent,
        webAppLocation: "test",
        mobileAppLocation: "test",
        sendTime: tomorrow,
      }),
    );
    const futureContent = await unreadContentRepo.save(
      unreadContentRepo.create({
        user,
        contentType: UnreadContentType.ForumReply,
        contentId: unreadCommentId,
        sendTime: tomorrow,
        shouldPush: false,
      }),
    );

    await ctx.agent.post("/notifs/read-all").expect(201);

    const [notif, content] = await Promise.all([
      notifRepo.findOneByOrFail({ id: futureNotif.id }),
      unreadContentRepo.findOneByOrFail({ id: futureContent.id }),
    ]);
    await notifRepo.delete(futureNotif.id);
    await unreadContentRepo.delete(futureContent.id);
    expect(notif.readAt).toBeNull();
    expect(content.readAt).toBeNull();
  });

  it("mark all read with loadedAt leaves notifications due after it unread", async () => {
    const user = await ctx.dataSource
      .getRepository(User)
      .findOneByOrFail({ id: ctx.testUserId });
    const loadedAt = new Date(Date.now() - milliseconds({ minutes: 10 }));
    const createdAt = new Date(Date.now() - milliseconds({ hours: 2 }));
    const shownSendTime = new Date(Date.now() - milliseconds({ hours: 1 }));
    const laterSendTime = new Date(Date.now() - milliseconds({ minutes: 1 }));
    const [shownNotif, laterNotif] = await notifRepo.save(
      [shownSendTime, laterSendTime].map((sendTime) =>
        notifRepo.create({
          user,
          message: "Reminder",
          category: NotificationCategory.ActionEvent,
          webAppLocation: "test",
          mobileAppLocation: "test",
          sendTime,
        }),
      ),
    );
    const laterContent = await unreadContentRepo.save(
      unreadContentRepo.create({
        user,
        contentType: UnreadContentType.ForumReply,
        contentId: unreadCommentId,
        sendTime: laterSendTime,
        shouldPush: false,
      }),
    );
    await notifRepo.update([shownNotif.id, laterNotif.id], { createdAt });
    await unreadContentRepo.update(laterContent.id, { createdAt });

    await ctx.agent
      .post("/notifs/read-all")
      .query({ loadedAt: loadedAt.toISOString() })
      .expect(201);

    const [shown, later, content] = await Promise.all([
      notifRepo.findOneByOrFail({ id: shownNotif.id }),
      notifRepo.findOneByOrFail({ id: laterNotif.id }),
      unreadContentRepo.findOneByOrFail({ id: laterContent.id }),
    ]);
    await notifRepo.delete([shownNotif.id, laterNotif.id]);
    await unreadContentRepo.delete(laterContent.id);
    expect(shown.readAt).not.toBeNull();
    expect(later.readAt).toBeNull();
    expect(content.readAt).toBeNull();
  });

  it("mark all read with loadedAt includes a notification due and created in its millisecond", async () => {
    const user = await ctx.dataSource
      .getRepository(User)
      .findOneByOrFail({ id: ctx.testUserId });
    const notif = await notifRepo.save(
      notifRepo.create({
        user,
        message: "Default sendTime",
        category: NotificationCategory.FriendRequest,
        webAppLocation: "test",
        mobileAppLocation: "test",
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
    const listed = (await ctx.agent.get("/notifs").expect(200)).body.find(
      (item: { id: number; sourceType: string }) =>
        item.id === notif.id &&
        item.sourceType === NotificationSourceType.Notification,
    );

    await ctx.agent
      .post("/notifs/read-all")
      .query({ loadedAt: listed.sendTime })
      .expect(201);

    const read = await notifRepo.findOneByOrFail({ id: notif.id });
    await notifRepo.delete(notif.id);
    expect(read.readAt).not.toBeNull();
  });

  it("mark all read with the list's loadedAt marks backdated notifications below the loaded page and leaves ones created after the load unread", async () => {
    const user = await ctx.dataSource
      .getRepository(User)
      .findOneByOrFail({ id: ctx.testUserId });
    const backdated = (): UnreadContent =>
      unreadContentRepo.create({
        user,
        contentType: UnreadContentType.ForumReply,
        contentId: unreadCommentId,
        sendTime: new Date(Date.now() - milliseconds({ days: 1 })),
        shouldPush: false,
      });
    const pageNotifs = await notifRepo.save(
      [1, 2].map(() =>
        notifRepo.create({
          user,
          message: "Fresh",
          category: NotificationCategory.FriendRequest,
          webAppLocation: "test",
          mobileAppLocation: "test",
        }),
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
    const belowPageContent = await unreadContentRepo.save(backdated());
    await new Promise((resolve) => setTimeout(resolve, 5));
    const listResponse = await ctx.agent
      .get("/notifs")
      .query({ limit: 2 })
      .expect(200);
    const page: { id: number }[] = listResponse.body;
    await new Promise((resolve) => setTimeout(resolve, 5));
    const lateContent = await unreadContentRepo.save(backdated());

    await ctx.agent
      .post("/notifs/read-all")
      .query({ loadedAt: listResponse.headers[NOTIFS_LOADED_AT_HEADER] })
      .expect(201);

    const [belowPage, late] = await Promise.all([
      unreadContentRepo.findOneByOrFail({ id: belowPageContent.id }),
      unreadContentRepo.findOneByOrFail({ id: lateContent.id }),
    ]);
    await notifRepo.delete(pageNotifs.map((n) => n.id));
    await unreadContentRepo.delete([belowPageContent.id, lateContent.id]);
    expect(new Set(page.map((n) => n.id))).toEqual(
      new Set(pageNotifs.map((n) => n.id)),
    );
    expect(belowPage.readAt).not.toBeNull();
    expect(late.readAt).toBeNull();
  });

  it("mark all read with a loadedAt in the future leaves notifications that aren't due yet unread", async () => {
    const user = await ctx.dataSource
      .getRepository(User)
      .findOneByOrFail({ id: ctx.testUserId });
    const futureNotif = await notifRepo.save(
      notifRepo.create({
        user,
        message: "Scheduled reminder",
        category: NotificationCategory.ActionEvent,
        webAppLocation: "test",
        mobileAppLocation: "test",
        sendTime: new Date(Date.now() + milliseconds({ hours: 1 })),
      }),
    );

    await ctx.agent
      .post("/notifs/read-all")
      .query({
        loadedAt: new Date(
          Date.now() + milliseconds({ hours: 2 }),
        ).toISOString(),
      })
      .expect(201);

    const notif = await notifRepo.findOneByOrFail({ id: futureNotif.id });
    await notifRepo.delete(futureNotif.id);
    expect(notif.readAt).toBeNull();
  });

  it.each([
    "2026-W39-3",
    "1",
    "2026-09-23T10:00",
    "2026-02-30T00:00:00.000Z",
    "March 7",
  ])(
    "mark all read rejects loadedAt=%s, which isn't an RFC 3339 date-time",
    async (loadedAt) => {
      await notifRepo.update(legacyNotifId, { readAt: null });

      await ctx.agent.post("/notifs/read-all").query({ loadedAt }).expect(400);

      const notif = await notifRepo.findOneByOrFail({ id: legacyNotifId });
      expect(notif.readAt).toBeNull();
    },
  );

  it("unread count leaves out a deleted reply that mark all read with loadedAt leaves unread", async () => {
    await ctx.agent.post("/notifs/read-all").expect(201);
    const user = await ctx.dataSource
      .getRepository(User)
      .findOneByOrFail({ id: ctx.testUserId });
    const shownNotif = await notifRepo.save(
      notifRepo.create({
        user,
        message: "Shown",
        category: NotificationCategory.FriendRequest,
        webAppLocation: "test",
        mobileAppLocation: "test",
        sendTime: new Date(Date.now() - milliseconds({ hours: 1 })),
      }),
    );
    const reply = await commentRepo.save(
      commentRepo.create({
        author: user,
        authorId: user.id,
        editableContent: await editableContentRepo.save(
          editableContentRepo.create({
            body: "Deleted reply",
            attachments: [],
          }),
        ),
        parentObjectType: CommentParentObject.Post,
        parentObjectId: 1,
        deleted: true,
        pinned: false,
        likes: [],
        likesCount: 0,
        children: [],
      }),
    );
    const listResponse = await ctx.agent.get("/notifs").expect(200);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const hiddenContent = await unreadContentRepo.save(
      unreadContentRepo.create({
        user,
        contentType: UnreadContentType.ForumReply,
        contentId: reply.id,
        sendTime: new Date(Date.now() - milliseconds({ minutes: 1 })),
        shouldPush: false,
      }),
    );

    const countBefore = (
      await ctx.agent.get("/notifs/unread-count").expect(200)
    ).body.unreadCount;
    await ctx.agent
      .post("/notifs/read-all")
      .query({ loadedAt: listResponse.headers[NOTIFS_LOADED_AT_HEADER] })
      .expect(201);
    const countAfter = (await ctx.agent.get("/notifs/unread-count").expect(200))
      .body.unreadCount;

    await notifRepo.delete(shownNotif.id);
    await unreadContentRepo.delete(hiddenContent.id);
    expect(countBefore).toBe(1);
    expect(countAfter).toBe(0);
  });

  it("user can mark unread content read by content id", async () => {
    await unreadContentRepo.update(unreadNotifId, {
      readAt: null,
      contentType: UnreadContentType.ForumReply,
      contentId: unreadCommentId,
      shouldPush: false,
    });

    await ctx.agent
      .post("/notifs/read-content")
      .send({
        contentType: UnreadContentType.ForumReply,
        contentIds: [unreadCommentId],
      })
      .expect(201);

    const updated = await unreadContentRepo.findOneByOrFail({
      id: unreadNotifId,
    });
    expect(updated.readAt).toBeTruthy();
  });

  it("markdown comment preview text is stripped of markdown syntax", async () => {
    const userRepo = ctx.dataSource.getRepository(User);
    const testUser = await userRepo.findOneOrFail({
      where: { id: ctx.testUserId },
    });

    const editableContent = await editableContentRepo.save(
      editableContentRepo.create({
        body: "**bold text** and a [link](https://example.com) with `inline code`",
        attachments: [],
      }),
    );

    const comment = await commentRepo.save(
      commentRepo.create({
        author: testUser,
        authorId: testUser.id,
        editableContent,
        parentObjectType: CommentParentObject.Post,
        parentObjectId: 1,
        deleted: false,
        pinned: false,
        likes: [],
        likesCount: 0,
        children: [],
      }),
    );

    const unreadContent = await unreadContentRepo.save(
      unreadContentRepo.create({
        user: testUser,
        contentType: UnreadContentType.ForumReply,
        contentId: comment.id,
        sendTime: new Date(Date.now() - milliseconds({ seconds: 1 })),
        shouldPush: false,
      }),
    );

    const res = await ctx.agent.get("/notifs").expect(200);
    const notif = res.body.find(
      (n: { id: number; sourceType: string }) =>
        n.id === unreadContent.id &&
        n.sourceType === NotificationSourceType.UnreadContent,
    );

    expect(notif).toBeDefined();
    expect(notif.message).not.toContain("**");
    expect(notif.message).not.toContain("[link]");
    expect(notif.message).not.toContain("(https://");
    expect(notif.message).not.toContain("`");
    expect(notif.message).toContain("bold text");
    expect(notif.message).toContain("link");
    expect(notif.message).toContain("inline code");
  });

  it("markdown action update preview text is stripped of markdown syntax", async () => {
    const userRepo = ctx.dataSource.getRepository(User);
    const actionRepo = ctx.dataSource.getRepository(Action);
    const actionUpdateRepo = ctx.dataSource.getRepository(ActionUpdate);

    const testUser = await userRepo.findOneOrFail({
      where: { id: ctx.testUserId },
    });

    const action = await actionRepo.save(
      actionRepo.create({
        name: "Markdown Test Action",
        category: [],
        body: "test body",
      }),
    );

    const snapshot = await formSnapshotRepo.save(
      formSnapshotRepo.create({
        schema: { blocks: [{ type: "display", kind: "text", text: "update" }] },
        hash: "notifs-e2e-action-update",
      }),
    );

    const actionUpdate = await actionUpdateRepo.save(
      actionUpdateRepo.create({
        action,
        title: "Test Update",
        date: new Date(),
        shortNotifString:
          "## Heading\n\nSome **bold** and *italic* text with a [link](https://example.com)",
        notifyType: ActionUpdateNotifyType.None,
        schemaSnapshotId: snapshot.id,
      }),
    );

    const unreadContent = await unreadContentRepo.save(
      unreadContentRepo.create({
        user: testUser,
        contentType: UnreadContentType.ActionUpdate,
        contentId: actionUpdate.id,
        sendTime: new Date(Date.now() - milliseconds({ seconds: 1 })),
        shouldPush: false,
      }),
    );

    const res = await ctx.agent.get("/notifs").expect(200);
    const notif = res.body.find(
      (n: { id: number; sourceType: string }) =>
        n.id === unreadContent.id &&
        n.sourceType === NotificationSourceType.UnreadContent,
    );

    expect(notif).toBeDefined();
    expect(notif.message).not.toContain("##");
    expect(notif.message).not.toContain("**");
    expect(notif.message).not.toContain("*italic*");
    expect(notif.message).not.toContain("[link]");
    expect(notif.message).not.toContain("(https://");
    expect(notif.message).toContain("Heading");
    expect(notif.message).toContain("bold");
    expect(notif.message).toContain("italic");
    expect(notif.message).toContain("link");
  });
});
