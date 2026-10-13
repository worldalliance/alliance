import { ActionActivityType } from "@alliance/common/actionActivity";
import { milliseconds } from "date-fns";
import { ActionsService } from "src/actions/actions.service";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import {
  ActionUpdate,
  ActionUpdateNotificationMode,
  ActionUpdateNotifyType,
} from "src/actions/entities/action-update.entity";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
import { Community } from "src/community/entities/community.entity";
import {
  Comment,
  CommentParentObject,
} from "src/forum/entities/comment.entity";
import { EditableContent } from "src/forum/entities/editablecontent.entity";
import { Post } from "src/forum/entities/post.entity";
import { NotificationSourceType } from "src/notifs/dto/notification.dto";
import {
  Notification,
  NotificationCategory,
} from "src/notifs/entities/notification.entity";
import {
  UnreadContent,
  UnreadContentType,
} from "src/notifs/entities/unread-content.entity";
import { LikeNotificationService } from "src/notifs/like-notification.service";
import {
  action as actionRef,
  communityDestination,
  ContentTargetType,
  DELETED_GROUP_LABEL,
  DELETED_MEMBER_LABEL,
  group,
  member,
  NotificationFormat,
  notifMessage,
  SegmentType,
  UserNameForm,
} from "src/notifs/notification-content";
import { NotificationRenderService } from "src/notifs/notification-render.service";
import { NotifsService } from "src/notifs/notifs.service";
import { FormSnapshot } from "src/tasks/entities/formsnapshot.entity";
import { User } from "src/user/entities/user.entity";
import { UserService } from "src/user/user.service";
import type { Repository } from "typeorm";
import { createTestApp, TestContext } from "./e2e-test-utils";

type InboxEntry = {
  id: number;
  sourceType: NotificationSourceType;
  message: string;
  webAppLocation: string;
  mobileAppLocation: string | null;
  readAt: string | null;
};

describe("Notification content stability (e2e)", () => {
  let ctx: TestContext;
  let notifsService: NotifsService;
  let likes: LikeNotificationService;
  let actionsService: ActionsService;
  let userRepo: Repository<User>;
  let communityRepo: Repository<Community>;
  let notifRepo: Repository<Notification>;
  let recipient: User;
  let userCount = 0;

  const createUser = (name: string) =>
    userRepo.save(
      userRepo.create({
        email: `content-${++userCount}@example.com`,
        password: "pass",
        name,
      }),
    );

  const inbox = async (): Promise<InboxEntry[]> =>
    (await ctx.agent.get("/notifs").expect(200)).body;

  const entry = async (id: number, sourceType: NotificationSourceType) =>
    (await inbox()).find((n) => n.id === id && n.sourceType === sourceType);

  const unreadCount = async (): Promise<number> =>
    (await ctx.agent.get("/notifs/unread-count").expect(200)).body.unreadCount;

  const markRead = (id: number, sourceType: NotificationSourceType) =>
    ctx.agent.post(`/notifs/read/${id}`).query({ sourceType }).expect(201);

  const createVisibleAction = async (name: string) => {
    const action = await ctx.dataSource.getRepository(Action).save({
      name,
      category: [],
      body: "Body",
      visibilityMode: VisibilityMode.Public,
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

  const createPost = (title: string, author = recipient) =>
    ctx.dataSource.getRepository(Post).save({
      title,
      author,
      authors: [],
      editableContent: { body: "Body", attachments: [] },
      deletedAt: null,
      visibleAt: new Date(),
    });

  const createReply = async (params: {
    parentObjectType: CommentParentObject;
    parentObjectId: number;
    authorName?: string;
    body?: string;
  }) => {
    const {
      authorName = "Rowan Reply",
      body = "Reply body",
      ...parent
    } = params;
    const replier = await createUser(authorName);
    const editableContent = await ctx.dataSource
      .getRepository(EditableContent)
      .save({ body, attachments: [] });
    return ctx.dataSource.getRepository(Comment).save({
      author: replier,
      authorId: replier.id,
      editableContent,
      ...parent,
      deletedAt: null,
      pinned: false,
      likesCount: 0,
    });
  };

  let snapshotCount = 0;
  const createActionUpdate = async (params: {
    action: Action;
    date: Date;
    shortNotifString: string;
  }) => {
    const snapshot = await ctx.dataSource.getRepository(FormSnapshot).save({
      schema: { blocks: [{ type: "display", kind: "text", text: "update" }] },
      hash: `notification-content-${++snapshotCount}`,
    });
    return ctx.dataSource.getRepository(ActionUpdate).save({
      ...params,
      title: "Update",
      visibleAt: new Date(Date.now() - milliseconds({ minutes: 1 })),
      notifyType: ActionUpdateNotifyType.None,
      notificationMode: ActionUpdateNotificationMode.Legacy,
      schemaSnapshotId: snapshot.id,
    });
  };

  beforeAll(async () => {
    ctx = await createTestApp([]);
    notifsService = ctx.app.get(NotifsService);
    likes = ctx.app.get(LikeNotificationService);
    actionsService = ctx.app.get(ActionsService);
    userRepo = ctx.dataSource.getRepository(User);
    communityRepo = ctx.dataSource.getRepository(Community);
    notifRepo = ctx.dataSource.getRepository(Notification);
    recipient = await userRepo.findOneByOrFail({ id: ctx.testUserId });
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it("names the current member and group around the wording it was sent with, read or not", async () => {
    const leaver = await createUser("Pat Original");
    const community = await communityRepo.save({ name: "Group A" });
    const notif = await notifsService.sendNotif({
      user: recipient,
      category: NotificationCategory.MemberLeftCommunity,
      message: notifMessage`${member(leaver)} left your group (${group(community)})`,
      destination: communityDestination(community.id),
      webAppLocation: `/groups/${community.id}`,
      associatedUsers: [leaver],
    });

    await userRepo.update(leaver.id, { name: "Pat Renamed" });
    await communityRepo.update(community.id, { name: "Group A Renamed" });
    const groupB = await communityRepo.save({ name: "Group B" });
    await communityRepo.save({ id: groupB.id, users: [leaver] });

    expect(
      (await entry(notif.id, NotificationSourceType.Notification))?.message,
    ).toBe("Pat Renamed left your group (Group A Renamed)");

    await markRead(notif.id, NotificationSourceType.Notification);
    await userRepo.update(leaver.id, { name: "Pat Again" });
    const read = await entry(notif.id, NotificationSourceType.Notification);
    expect(read?.readAt).toBeTruthy();
    expect(read?.message).toBe("Pat Again left your group (Group A Renamed)");
    expect(read?.webAppLocation).toBe(`/groups/${community.id}`);
  });

  it("labels a deleted member and group and drops the group link", async () => {
    const leaver = await createUser("Sam Gone");
    const community = await communityRepo.save({ name: "Short-lived" });
    const notif = await notifsService.sendNotif({
      user: recipient,
      category: NotificationCategory.MemberLeftCommunity,
      message: notifMessage`${member(leaver)} left your group (${group(community)})`,
      destination: communityDestination(community.id),
      webAppLocation: `/groups/${community.id}`,
      mobileAppLocation: `/groups/${community.id}`,
      associatedUsers: [leaver],
    });

    await communityRepo.delete(community.id);
    await userRepo.delete(leaver.id);

    const shown = await entry(notif.id, NotificationSourceType.Notification);
    expect(shown?.message).toBe(
      `${DELETED_MEMBER_LABEL} left your group (${DELETED_GROUP_LABEL})`,
    );
    expect(shown?.webAppLocation).toBe("");
    expect(shown?.mobileAppLocation).toBeNull();
  });

  it("names the current action in a reminder, and hides it once the action is deleted", async () => {
    const reminderAction = await createVisibleAction("Spring Push");
    const notif = await notifsService.sendNotif({
      user: recipient,
      category: NotificationCategory.ActionEvent,
      message: notifMessage`You missed tasks in ${actionRef(reminderAction)}`,
      destination: null,
      webAppLocation: "/tasks",
      associatedUsers: [],
    });

    await ctx.dataSource
      .getRepository(Action)
      .update(reminderAction.id, { name: "Autumn Push" });
    expect(
      (await entry(notif.id, NotificationSourceType.Notification))?.message,
    ).toBe("You missed tasks in Autumn Push");
    const before = await unreadCount();

    await ctx.dataSource.getRepository(Action).delete(reminderAction.id);

    expect(
      await entry(notif.id, NotificationSourceType.Notification),
    ).toBeUndefined();
    expect(await unreadCount()).toBe(before - 1);
  });

  describe("action update copy", () => {
    let action: Action;

    const createUpdate = (
      date: Date,
      shortNotifString: string,
      forAction = action,
    ) => createActionUpdate({ action: forAction, date, shortNotifString });

    const send = async (actionUpdate: ActionUpdate) => {
      const [row] = await notifsService.createActionUpdateNotifs({
        actionUpdate,
        users: [recipient],
      });
      return row;
    };

    const reachShowDate = async (update: ActionUpdate, row: UnreadContent) => {
      const past = new Date(Date.now() - 1000);
      await ctx.dataSource
        .getRepository(ActionUpdate)
        .update(update.id, { visibleAt: past });
      await ctx.dataSource
        .getRepository(UnreadContent)
        .update(row.id, { sendTime: past });
    };

    const shownText = async (row: UnreadContent) =>
      (await entry(row.id, NotificationSourceType.UnreadContent))?.message;

    beforeAll(async () => {
      action = await createVisibleAction("Copy Action");
    });

    it("keeps the copy an immediate send delivered", async () => {
      const update = await createUpdate(new Date(), "Original copy");
      const row = await send(update);

      await actionsService.updateActionUpdate(update.id, {
        shortNotifString: "Edited copy",
      });

      expect(await shownText(row)).toBe("Original copy");
    });

    it("keeps the copy a push carried", async () => {
      const update = await createUpdate(new Date(), "Pushed copy");
      const row = await send(update);
      const [pushed] = await notifsService.getUnreadContentsForPush([row.id]);

      await actionsService.updateActionUpdate(update.id, {
        shortNotifString: "Edited copy",
      });

      expect(await shownText(row)).toBe(pushed.dto.message);
    });

    it("takes more concurrent edits than the pool has connections", async () => {
      const sent = await Promise.all(
        Array.from({ length: 12 }, async (_, i) => {
          const update = await createUpdate(new Date(), `Busy copy ${i}`);
          return { update, row: await send(update) };
        }),
      );

      await Promise.all(
        sent.map(({ update }) =>
          actionsService.updateActionUpdate(update.id, {
            shortNotifString: "Edited copy",
          }),
        ),
      );

      for (const [i, { row }] of sent.entries()) {
        expect(await shownText(row)).toBe(`Busy copy ${i}`);
      }
    }, 20000);

    it("lets a scheduled entry pick up edits until it reaches the inbox", async () => {
      const sendTime = new Date(Date.now() + milliseconds({ hours: 1 }));
      const update = await createUpdate(sendTime, "Draft copy");
      const row = await send(update);

      await actionsService.updateActionUpdate(update.id, {
        shortNotifString: "Copy at availability",
      });
      await ctx.dataSource
        .getRepository(UnreadContent)
        .update(row.id, { sendTime: new Date(Date.now() - 1000) });
      expect(await shownText(row)).toBe("Copy at availability");

      await actionsService.updateActionUpdate(update.id, {
        shortNotifString: "Copy after availability",
      });
      await actionsService.updateActionUpdate(update.id, {
        shortNotifString: "Copy edited twice",
      });
      expect(await shownText(row)).toBe("Copy at availability");
    });

    it("lets an unpublished update's entries pick up edits until it is published", async () => {
      const update = await createUpdate(new Date(), "Seen by nobody");
      const row = await send(update);
      const updates = ctx.dataSource.getRepository(ActionUpdate);
      await updates.update(update.id, {
        visibleAt: new Date(Date.now() + milliseconds({ hours: 1 })),
      });

      await actionsService.updateActionUpdate(update.id, {
        shortNotifString: "Final copy",
      });
      await updates.update(update.id, {
        visibleAt: new Date(Date.now() - 1000),
      });

      expect(await shownText(row)).toBe("Final copy");
    });

    it("keeps the copy members saw through edits made while the update is hidden", async () => {
      const update = await createUpdate(new Date(), "Seen copy");
      const row = await send(update);
      expect(await shownText(row)).toBe("Seen copy");

      await actionsService.updateActionUpdate(update.id, {
        date: new Date(Date.now() + milliseconds({ hours: 1 })),
      });
      await actionsService.unpublishActionUpdateUntilDate(update.id);
      await actionsService.updateActionUpdate(update.id, {
        shortNotifString: "Edited while hidden",
      });
      await reachShowDate(update, row);

      expect(await shownText(row)).toBe("Seen copy");
    });

    it("does not freeze copy when unpublishing an update that is already hidden", async () => {
      const update = await createUpdate(
        new Date(Date.now() + milliseconds({ hours: 1 })),
        "Scheduled copy",
      );
      const row = await send(update);
      await actionsService.unpublishActionUpdateUntilDate(update.id);
      await ctx.dataSource
        .getRepository(UnreadContent)
        .update(row.id, { sendTime: new Date(Date.now() - 1000) });

      await actionsService.updateActionUpdate(update.id, {
        shortNotifString: "Hidden A",
      });
      await actionsService.unpublishActionUpdateUntilDate(update.id);
      await actionsService.updateActionUpdate(update.id, {
        shortNotifString: "Hidden B",
      });
      await reachShowDate(update, row);

      expect(await shownText(row)).toBe("Hidden B");
    });

    it("keeps the copy a member saw through edits made while they can't see the action", async () => {
      const gapAction = await createVisibleAction("Gap Action");
      const update = await createUpdate(new Date(), "Seen copy", gapAction);
      const row = await send(update);
      expect(await shownText(row)).toBe("Seen copy");
      const actions = ctx.dataSource.getRepository(Action);

      await actions.update(gapAction.id, {
        visibilityMode: VisibilityMode.ParticipatingGroups,
      });
      expect(await shownText(row)).toBeUndefined();
      await actionsService.updateActionUpdate(update.id, {
        shortNotifString: "Edited during gap",
      });
      await actions.update(gapAction.id, {
        visibilityMode: VisibilityMode.Public,
      });

      expect(await shownText(row)).toBe("Seen copy");
    });

    it("freezes an available entry when unpublishing, even if it never rendered", async () => {
      const update = await createUpdate(new Date(), "Available copy");
      const row = await send(update);

      await actionsService.updateActionUpdate(update.id, {
        date: new Date(Date.now() + milliseconds({ hours: 1 })),
      });
      await actionsService.unpublishActionUpdateUntilDate(update.id);
      await actionsService.updateActionUpdate(update.id, {
        shortNotifString: "Edited while hidden",
      });
      await reachShowDate(update, row);

      expect(await shownText(row)).toBe("Available copy");
    });

    it("lets an entry that never rendered follow edits made while its recipient can't see the action", async () => {
      const gapAction = await createVisibleAction("Unrendered Gap Action");
      const update = await createUpdate(
        new Date(),
        "Available copy",
        gapAction,
      );
      const row = await send(update);
      const actions = ctx.dataSource.getRepository(Action);

      await actions.update(gapAction.id, {
        visibilityMode: VisibilityMode.ParticipatingGroups,
      });
      await actionsService.updateActionUpdate(update.id, {
        shortNotifString: "Edited during gap",
      });
      await actions.update(gapAction.id, {
        visibilityMode: VisibilityMode.Public,
      });

      expect(await shownText(row)).toBe("Edited during gap");
    });

    describe("a row loaded before the copy changed", () => {
      const loaded = async (row: UnreadContent) =>
        ctx.dataSource
          .getRepository(UnreadContent)
          .findOneOrFail({ where: { id: row.id }, relations: { user: true } });

      const render = (row: UnreadContent) =>
        ctx.app
          .get(NotificationRenderService)
          .renderUnreadContents(new Map([[recipient.id, [row]]]));

      it("shows the copy an edit froze first", async () => {
        const update = await createUpdate(new Date(), "Old copy");
        const stale = await loaded(await send(update));

        await actionsService.updateActionUpdate(update.id, {
          shortNotifString: "New copy",
        });

        expect((await render(stale)).map((dto) => dto.message)).toEqual([
          "Old copy",
        ]);
      });

      it("drops it once the row is gone", async () => {
        const update = await createUpdate(new Date(), "Gone copy");
        const row = await send(update);
        const stale = await loaded(row);

        await ctx.dataSource.getRepository(UnreadContent).delete(row.id);

        expect(await render(stale)).toEqual([]);
      });
    });

    it("lets entries of an action members can't see yet pick up edits", async () => {
      const draft = await ctx.dataSource.getRepository(Action).save({
        name: "Not Launched",
        category: [],
        body: "Body",
        visibilityMode: VisibilityMode.Public,
      });
      const update = await createUpdate(new Date(), "Never seen", draft);
      const row = await send(update);
      expect(await shownText(row)).toBeUndefined();

      await actionsService.updateActionUpdate(update.id, {
        shortNotifString: "Launch copy",
      });
      await ctx.dataSource.getRepository(ActionEvent).save({
        title: "Members act",
        description: "Member phase",
        newStatus: ActionStatus.MemberAction,
        date: new Date(Date.now() - 1000),
        action: draft,
      });

      expect(await shownText(row)).toBe("Launch copy");
    });

    it("gives entries the final copy when one edit publishes the update and changes its text", async () => {
      const update = await createUpdate(new Date(), "Hidden draft");
      const row = await send(update);
      await ctx.dataSource
        .getRepository(ActionUpdate)
        .update(update.id, { visibleAt: null });

      await actionsService.updateActionUpdate(update.id, {
        shortNotifString: "Final copy",
        schema: { blocks: [{ type: "display", kind: "text", text: "Body" }] },
        expectedSchemaSnapshotId: update.schemaSnapshotId,
      });

      expect(await shownText(row)).toBe("Final copy");
    });

    it("keeps a name written into the copy as written", async () => {
      const named = await createUser("Jordan Literal");
      const update = await createUpdate(
        new Date(),
        "Jordan Literal will host the call",
      );
      const row = await send(update);

      await userRepo.update(named.id, { name: "Jordan Changed" });

      expect(await shownText(row)).toBe("Jordan Literal will host the call");
    });

    it("hides the entry once the member can no longer see the action", async () => {
      const archived = await createVisibleAction("Soon Archived");
      const update = await createUpdate(
        new Date(),
        "About an archived action",
        archived,
      );
      const row = await send(update);
      expect(await shownText(row)).toBe("About an archived action");
      const before = await unreadCount();

      await ctx.dataSource
        .getRepository(Action)
        .update(archived.id, { archived: true });

      expect(await shownText(row)).toBeUndefined();
      expect(await unreadCount()).toBe(before - 1);
    });

    it("hides the entry while the update is unpublished", async () => {
      const update = await createUpdate(new Date(), "Held back");
      const row = await send(update);
      const updates = ctx.dataSource.getRepository(ActionUpdate);

      await updates.update(update.id, {
        visibleAt: new Date(Date.now() + milliseconds({ hours: 1 })),
      });
      expect(await shownText(row)).toBeUndefined();

      await updates.update(update.id, {
        visibleAt: new Date(Date.now() - 1000),
      });
      expect(await shownText(row)).toBe("Held back");
    });

    it("moves a scheduled entry to the date an unpublished update shows", async () => {
      const update = await createUpdate(
        new Date(Date.now() + milliseconds({ hours: 1 })),
        "Moved later",
      );
      const row = await send(update);
      const shows = new Date(Date.now() + milliseconds({ hours: 2 }));
      const actions = ctx.app.get(ActionsService);

      await actions.updateActionUpdate(update.id, { date: shows });
      await actions.unpublishActionUpdateUntilDate(update.id);

      expect(
        (
          await ctx.dataSource
            .getRepository(UnreadContent)
            .findOneByOrFail({ id: row.id })
        ).sendTime,
      ).toEqual(shows);
    });

    it("leaves an entry already claimed for push where it is when unpublishing", async () => {
      const update = await createUpdate(
        new Date(Date.now() + milliseconds({ hours: 1 })),
        "Already pushed",
      );
      const row = await send(update);
      const rows = ctx.dataSource.getRepository(UnreadContent);
      await rows.update(row.id, { pushClaimedBy: "dispatch" });
      const actions = ctx.app.get(ActionsService);

      await actions.updateActionUpdate(update.id, {
        date: new Date(Date.now() + milliseconds({ hours: 2 })),
      });
      await actions.unpublishActionUpdateUntilDate(update.id);

      expect((await rows.findOneByOrFail({ id: row.id })).sendTime).toEqual(
        row.sendTime,
      );
    });

    it("leaves an entry already due where it is when unpublishing", async () => {
      const update = await createUpdate(
        new Date(Date.now() + milliseconds({ hours: 1 })),
        "Already due",
      );
      const row = await send(update);
      const rows = ctx.dataSource.getRepository(UnreadContent);
      const due = new Date(Date.now() - milliseconds({ minutes: 1 }));
      await rows.update(row.id, { sendTime: due, readAt: new Date() });

      await ctx.app
        .get(ActionsService)
        .unpublishActionUpdateUntilDate(update.id);

      expect((await rows.findOneByOrFail({ id: row.id })).sendTime).toEqual(
        due,
      );
    });

    it("dates entries by an edit and unpublish that land while notify loads its audience", async () => {
      const update = await createUpdate(
        new Date(Date.now() + milliseconds({ hours: 1 })),
        "Raced",
      );
      await ctx.dataSource
        .getRepository(ActionUpdate)
        .update(update.id, { notifyType: ActionUpdateNotifyType.AllMembers });
      const actions = ctx.app.get(ActionsService);
      const users = ctx.app.get(UserService);
      const findAllUsers = users.findAllUsers.bind(users);
      const shows = new Date(Date.now() + milliseconds({ hours: 2 }));
      const audience = jest
        .spyOn(users, "findAllUsers")
        .mockImplementation(async () => {
          await actions.updateActionUpdate(update.id, { date: shows });
          await actions.unpublishActionUpdateUntilDate(update.id);
          return findAllUsers();
        });

      try {
        await actions.notifyActionUpdate(update.id);
      } finally {
        audience.mockRestore();
      }

      const row = await ctx.dataSource
        .getRepository(UnreadContent)
        .findOneByOrFail({
          contentType: UnreadContentType.ActionUpdate,
          contentId: update.id,
          user: { id: recipient.id },
        });
      expect(row.sendTime).toEqual(shows);
    });

    it("starts an entry sent while its update is hidden when the update shows", async () => {
      const shows = new Date(Date.now() + milliseconds({ hours: 3 }));
      const update = await createUpdate(shows, "Sent while hidden");
      const actions = ctx.app.get(ActionsService);
      await actions.unpublishActionUpdateUntilDate(update.id);
      await actions.updateActionUpdate(update.id, { date: new Date() });

      const row = await send(
        await ctx.dataSource
          .getRepository(ActionUpdate)
          .findOneByOrFail({ id: update.id }),
      );

      expect(row.sendTime).toEqual(shows);
    });

    it("hides the entry once the update is deleted", async () => {
      const update = await createUpdate(new Date(), "Soon deleted");
      const row = await send(update);
      const before = await unreadCount();

      await ctx.dataSource.getRepository(ActionUpdate).delete(update.id);

      expect(await shownText(row)).toBeUndefined();
      expect(await unreadCount()).toBe(before - 1);
    });
  });

  it("renders a legacy reply and update with the wording they had before formats", async () => {
    const post = await createPost("Legacy Reply Target");
    const comment = await createReply({
      parentObjectType: CommentParentObject.Post,
      parentObjectId: post.id,
      authorName: "Lea Legacy",
      body: "**Legacy** body",
    });
    const update = await createActionUpdate({
      action: await createVisibleAction("Legacy Update Action"),
      date: new Date(),
      shortNotifString: "Legacy _update_ text",
    });
    const [reply, actionUpdate] = await ctx.dataSource
      .getRepository(UnreadContent)
      .save(
        (
          [
            [UnreadContentType.ForumReply, comment.id],
            [UnreadContentType.ActionUpdate, update.id],
          ] as const
        ).map(([contentType, contentId]) => ({
          user: recipient,
          format: NotificationFormat.Legacy,
          contentType,
          contentId,
          sendTime: new Date(Date.now() - 1000),
        })),
      );

    expect(
      (await entry(reply.id, NotificationSourceType.UnreadContent))?.message,
    ).toBe("Lea Legacy: Legacy body");
    expect(
      (await entry(actionUpdate.id, NotificationSourceType.UnreadContent))
        ?.message,
    ).toBe("Legacy update text");
  });

  it("shows a reply's current excerpt and author inside its pinned wording, and hides it with its post", async () => {
    const post = await createPost("Reply Target");
    const comment = await createReply({
      parentObjectType: CommentParentObject.Post,
      parentObjectId: post.id,
      authorName: "Riley Reply",
      body: "First body",
    });
    const row = await notifsService.createForumReplyNotif(comment, recipient);
    expect(row.format).toBe(NotificationFormat.Referenced);

    await ctx.dataSource
      .getRepository(EditableContent)
      .update(comment.editableContent.id, { body: "Edited body" });
    await userRepo.update(comment.authorId, { name: "Riley Renamed" });
    await markRead(row.id, NotificationSourceType.UnreadContent);

    expect(
      (await entry(row.id, NotificationSourceType.UnreadContent))?.message,
    ).toBe("Riley Renamed: Edited body");

    await ctx.dataSource.getRepository(UnreadContent).update(row.id, {
      content: {
        message: [
          {
            type: SegmentType.User,
            id: comment.authorId,
            name: UserNameForm.Public,
          },
          " replied: ",
          { type: SegmentType.CommentExcerpt },
        ],
      },
    });
    expect(
      (await entry(row.id, NotificationSourceType.UnreadContent))?.message,
    ).toBe("Riley Renamed replied: Edited body");

    await ctx.dataSource
      .getRepository(Post)
      .update(post.id, { deletedAt: new Date() });
    expect(
      await entry(row.id, NotificationSourceType.UnreadContent),
    ).toBeUndefined();
  });

  it("hides a reply while its post is rescheduled, unless the recipient can see it early", async () => {
    const post = await createPost(
      "Rescheduled Reply Target",
      await createUser("Pat Poster"),
    );
    const comment = await createReply({
      parentObjectType: CommentParentObject.Post,
      parentObjectId: post.id,
    });
    const row = await notifsService.createForumReplyNotif(comment, recipient);
    const postRepo = ctx.dataSource.getRepository(Post);

    await postRepo.update(post.id, {
      visibleAt: new Date(Date.now() + milliseconds({ days: 1 })),
    });
    expect(
      await entry(row.id, NotificationSourceType.UnreadContent),
    ).toBeUndefined();

    await postRepo.save({ id: post.id, authors: [recipient] });
    expect(
      await entry(row.id, NotificationSourceType.UnreadContent),
    ).toBeDefined();
  });

  it("hides a reply and its unread count once the comment is deleted", async () => {
    const post = await createPost("Deleted Reply Target");
    const comment = await createReply({
      parentObjectType: CommentParentObject.Post,
      parentObjectId: post.id,
    });
    const row = await notifsService.createForumReplyNotif(comment, recipient);
    const before = await unreadCount();

    await ctx.dataSource
      .getRepository(Comment)
      .update(comment.id, { deletedAt: new Date() });

    expect(
      await entry(row.id, NotificationSourceType.UnreadContent),
    ).toBeUndefined();
    expect(await unreadCount()).toBe(before - 1);
  });

  it("shows a reply on a public-only action anyone can open, even as a draft", async () => {
    const publicOnly = await ctx.dataSource.getRepository(Action).save({
      name: "Public Only Draft",
      category: [],
      body: "Body",
      visibilityMode: VisibilityMode.Public,
      publicOnly: true,
    });
    const comment = await createReply({
      parentObjectType: CommentParentObject.Action,
      parentObjectId: publicOnly.id,
    });

    const row = await notifsService.createForumReplyNotif(comment, recipient);

    expect(
      await entry(row.id, NotificationSourceType.UnreadContent),
    ).toBeDefined();
  });

  it("links a reply on an activity to the activity under its action", async () => {
    const action = await createVisibleAction("Reply Activity Action");
    const activity = await ctx.dataSource.getRepository(ActionActivity).save({
      userId: recipient.id,
      actionId: action.id,
      type: ActionActivityType.USER_COMPLETED,
    });
    const comment = await createReply({
      parentObjectType: CommentParentObject.Activity,
      parentObjectId: activity.id,
    });
    const row = await notifsService.createForumReplyNotif(comment, recipient);

    expect(
      (await entry(row.id, NotificationSourceType.UnreadContent))
        ?.webAppLocation,
    ).toBe(
      `/actions/${action.id}/activity/${activity.id}?replyId=${comment.id}`,
    );
  });

  describe("like groups", () => {
    const likeGroup = async (postId: number) =>
      notifRepo.find({
        where: {
          user: { id: recipient.id },
          groupingKey: `like:post:${postId}`,
        },
        order: { id: "ASC" },
      });

    const like = (post: Post, liker: User) =>
      likes.createOrUpdate({
        owner: recipient,
        liker,
        targetType: "post",
        targetId: post.id,
        webAppLocation: `/forum/post/${post.id}`,
        targetContent: post.title,
      });

    const unlike = (post: Post, unliker: User) =>
      likes.removeOnUnlike({
        ownerId: recipient.id,
        unlikerId: unliker.id,
        targetType: "post",
        targetId: post.id,
      });

    const shown = async (id: number) =>
      (await entry(id, NotificationSourceType.Notification))?.message;

    it("follows likes and unlikes while unread, with current names", async () => {
      const post = await createPost("Liked Post");
      const first = await createUser("Lee First");
      const second = await createUser("Kim Second");

      await like(post, first);
      const [row] = await likeGroup(post.id);
      expect(row.format).toBe(NotificationFormat.Referenced);
      expect(row.content).toMatchObject({
        target: { type: ContentTargetType.Post, id: post.id },
      });

      await userRepo.update(first.id, { name: "Lee Renamed" });
      expect(await shown(row.id)).toBe(
        "Lee Renamed liked your post: Liked Post",
      );

      await like(post, second);
      expect(await shown(row.id)).toBe("2 people liked your post: Liked Post");

      await unlike(post, first);
      expect(await shown(row.id)).toBe(
        "Kim Second liked your post: Liked Post",
      );

      await unlike(post, second);
      expect(await likeGroup(post.id)).toHaveLength(0);
    });

    it("leaves a read group alone and starts a new one", async () => {
      const post = await createPost("Read Post");
      const first = await createUser("Ari First");
      const second = await createUser("Bo Second");

      await like(post, first);
      const [read] = await likeGroup(post.id);
      await markRead(read.id, NotificationSourceType.Notification);

      await like(post, second);
      await unlike(post, first);

      const groups = await likeGroup(post.id);
      expect(groups).toHaveLength(2);
      expect(await shown(read.id)).toBe("Ari First liked your post: Read Post");
      expect(await shown(groups[1].id)).toBe(
        "Bo Second liked your post: Read Post",
      );
    });

    it("records a liked comment as the group's target", async () => {
      const post = await createPost("Comment Like Target");
      const comment = await createReply({
        parentObjectType: CommentParentObject.Post,
        parentObjectId: post.id,
      });

      await likes.createOrUpdate({
        owner: recipient,
        liker: await createUser("Cam Liker"),
        targetType: "comment",
        targetId: comment.id,
        webAppLocation: `/forum/post/${post.id}`,
        targetContent: "Reply body",
      });

      const [row] = await notifRepo.find({
        where: {
          user: { id: recipient.id },
          groupingKey: `like:comment:${comment.id}`,
        },
      });
      expect(row.content).toMatchObject({
        target: { type: ContentTargetType.Comment, id: comment.id },
      });
    });

    it("hides the group and its unread count once the post is deleted", async () => {
      const post = await createPost("Deleted Post");
      await like(post, await createUser("Cy Liker"));
      const [row] = await likeGroup(post.id);
      const before = await unreadCount();

      await ctx.dataSource
        .getRepository(Post)
        .update(post.id, { deletedAt: new Date() });

      expect(await shown(row.id)).toBeUndefined();
      expect(await unreadCount()).toBe(before - 1);
    });

    it("hides an activity's group once the member can no longer see its action", async () => {
      const action = await createVisibleAction("Activity Action");
      const activity = await ctx.dataSource.getRepository(ActionActivity).save({
        userId: recipient.id,
        actionId: action.id,
        type: ActionActivityType.USER_COMPLETED,
      });
      await likes.createOrUpdate({
        owner: recipient,
        liker: await createUser("Fay Liker"),
        targetType: "activity:user_completed",
        targetId: activity.id,
        webAppLocation: `/action/${action.id}`,
        targetContent: action.name,
        targetAction: action,
      });
      const [row] = await notifRepo.find({
        where: {
          user: { id: recipient.id },
          groupingKey: `like:activity:user_completed:${activity.id}`,
        },
      });
      expect(await shown(row.id)).toBe(
        "Fay Liker liked your completion of: Activity Action",
      );
      const before = await unreadCount();

      await ctx.dataSource
        .getRepository(Action)
        .update(action.id, { archived: true });

      expect(await shown(row.id)).toBeUndefined();
      expect(await unreadCount()).toBe(before - 1);
    });

    it("hides a comment's group and its unread count once its post is deleted", async () => {
      const post = await createPost("Commented Post");
      const comment = await createReply({
        parentObjectType: CommentParentObject.Post,
        parentObjectId: post.id,
        body: "Liked comment",
      });
      await likes.createOrUpdate({
        owner: recipient,
        liker: await createUser("Gus Liker"),
        targetType: "comment",
        targetId: comment.id,
        webAppLocation: `/forum/post/${post.id}`,
        targetContent: "Liked comment",
      });
      const [row] = await notifRepo.find({
        where: {
          user: { id: recipient.id },
          groupingKey: `like:comment:${comment.id}`,
        },
      });
      expect(await shown(row.id)).toBe(
        "Gus Liker liked your comment: Liked comment",
      );
      const before = await unreadCount();

      await ctx.dataSource
        .getRepository(Post)
        .update(post.id, { deletedAt: new Date() });

      expect(await shown(row.id)).toBeUndefined();
      expect(await unreadCount()).toBe(before - 1);
    });

    it("names an activity's current action, after later likes too", async () => {
      const activityAction = await createVisibleAction("Old Action Name");
      const activity = await ctx.dataSource.getRepository(ActionActivity).save({
        userId: recipient.id,
        actionId: activityAction.id,
        type: ActionActivityType.USER_COMPLETED,
      });
      const likeActivity = async (liker: User) =>
        likes.createOrUpdate({
          owner: recipient,
          liker,
          targetType: "activity:user_completed",
          targetId: activity.id,
          webAppLocation: `/actions/${activityAction.id}`,
          targetContent: activityAction.name,
          targetAction: activityAction,
        });

      await likeActivity(await createUser("Ivy Liker"));
      const [row] = await notifRepo.find({
        where: {
          user: { id: recipient.id },
          groupingKey: `like:activity:user_completed:${activity.id}`,
        },
      });
      expect(row.content).toMatchObject({
        target: { type: ContentTargetType.Activity, id: activity.id },
      });
      await ctx.dataSource
        .getRepository(Action)
        .update(activityAction.id, { name: "New Action Name" });
      expect(await shown(row.id)).toBe(
        "Ivy Liker liked your completion of: New Action Name",
      );

      await likeActivity(await createUser("Jo Liker"));
      expect(await shown(row.id)).toBe(
        "2 people liked your completion of: New Action Name",
      );
      expect((await notifRepo.findOneByOrFail({ id: row.id })).message).toBe(
        "2 people liked your completion of: New Action Name",
      );
    });

    it("takes more concurrent activity likes than the pool has connections", async () => {
      const activityAction = await createVisibleAction("Busy Action");
      const activity = await ctx.dataSource.getRepository(ActionActivity).save({
        userId: recipient.id,
        actionId: activityAction.id,
        type: ActionActivityType.USER_COMPLETED,
      });
      const likeActivity = async (liker: User) =>
        likes.createOrUpdate({
          owner: recipient,
          liker,
          targetType: "activity:user_completed",
          targetId: activity.id,
          webAppLocation: `/actions/${activityAction.id}`,
          targetContent: activityAction.name,
          targetAction: activityAction,
        });
      await likeActivity(await createUser("Seed Liker"));
      const likers = await Promise.all(
        Array.from({ length: 12 }, (_, i) => createUser(`Busy Liker ${i}`)),
      );

      await Promise.all(likers.map(likeActivity));

      const [row] = await notifRepo.find({
        where: {
          user: { id: recipient.id },
          groupingKey: `like:activity:user_completed:${activity.id}`,
        },
      });
      expect(row.groupingCount).toBe(13);
    }, 20000);

    it("keeps a legacy group on the legacy path when it gains a like", async () => {
      const post = await createPost("Legacy Post");
      const first = await createUser("Dee First");
      const legacy = await notifRepo.save({
        user: recipient,
        format: NotificationFormat.Legacy,
        category: NotificationCategory.Likes,
        message: "Dee First liked your post: Legacy Post",
        webAppLocation: `/forum/post/${post.id}`,
        groupingKey: `like:post:${post.id}`,
        groupingCount: 1,
        targetContent: post.title,
        associatedUsers: [first],
      });

      await like(post, await createUser("Eli Second"));
      await userRepo.update(first.id, { name: "Dee Renamed" });

      const [row] = await likeGroup(post.id);
      expect(row.id).toBe(legacy.id);
      expect(row.format).toBe(NotificationFormat.Legacy);
      expect(row.content).toBeNull();
      expect(await shown(row.id)).toBe("2 people liked your post: Legacy Post");
    });
  });
});
