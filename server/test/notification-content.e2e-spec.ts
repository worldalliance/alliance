import { ActionActivityType } from "@alliance/common/actionActivity";
import { milliseconds } from "date-fns";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
import { Community } from "src/community/entities/community.entity";
import { Post } from "src/forum/entities/post.entity";
import { NotificationSourceType } from "src/notifs/dto/notification.dto";
import {
  Notification,
  NotificationCategory,
} from "src/notifs/entities/notification.entity";
import { LikeNotificationService } from "src/notifs/like-notification.service";
import {
  action as actionRef,
  communityDestination,
  DELETED_GROUP_LABEL,
  DELETED_MEMBER_LABEL,
  group,
  member,
  NotificationFormat,
  notifMessage,
} from "src/notifs/notification-content";
import { NotifsService } from "src/notifs/notifs.service";
import { User } from "src/user/entities/user.entity";
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

  const createPost = (title: string) =>
    ctx.dataSource.getRepository(Post).save({
      title,
      author: recipient,
      authors: [],
      editableContent: { body: "Body", attachments: [] },
      deleted: false,
      visibleAt: new Date(),
    });

  beforeAll(async () => {
    ctx = await createTestApp([]);
    notifsService = ctx.app.get(NotifsService);
    likes = ctx.app.get(LikeNotificationService);
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
