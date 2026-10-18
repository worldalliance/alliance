import { CommunityService } from "src/community/community.service";
import { loadedCommunityUsers } from "src/community/entities/community.entity";
import {
  MessageSource,
  MessageTracking,
} from "src/link-tracking/message-tracking.entity";
import { MessagingModule } from "src/messaging/messaging.module";
import { MmsService } from "src/mms/mms.service";
import { NotificationKind } from "src/notification-settings/notification-kind";
import { NotificationPreferencesService } from "src/notification-settings/notification-preferences.service";
import { NotificationCategory } from "src/notifs/entities/notification.entity";
import { NotificationChannel } from "src/notifs/notif-utils";
import { NotifsService } from "src/notifs/notifs.service";
import { NotifPushDispatcherWorker } from "src/push/notif-push-dispatcher.worker";
import { UserDevice } from "src/user/entities/user-device.entity";
import type { User } from "src/user/entities/user.entity";
import { Not } from "typeorm";
import { createTestApp, setPreference, TestContext } from "./e2e-test-utils";
import { GroupJoinFixtures } from "./group-join-fixtures";

describe("Group join notifications: delivery (e2e)", () => {
  let ctx: TestContext;
  let fx: GroupJoinFixtures;
  let communityService: CommunityService;

  beforeAll(async () => {
    ctx = await createTestApp([MessagingModule]);
    fx = new GroupJoinFixtures(ctx);
    communityService = ctx.app.get(CommunityService);
  }, 50000);

  const setJoinNotice = (
    user: User,
    channel: NotificationChannel,
    enabled: boolean,
  ) =>
    setPreference(ctx, {
      userId: user.id,
      kind: NotificationKind.GroupMemberJoined,
      channel,
      enabled,
    });

  afterEach(async () => {
    jest.restoreAllMocks();
    await fx.cleanUp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("names an anonymous joiner by their public name in the entry and the text", async () => {
    const member = await fx.createUser({ phoneNumber: "+14155550106" });
    const group = await fx.createGroup({ leaders: [], members: [member] });
    const joiner = await fx.createUser({
      name: "Secret Realname",
      anonymous: true,
    });

    await communityService.joinPublicCommunity(joiner.id, group.id);

    const [notif] = await fx.joinNotifs();
    expect(notif.message).toBe(`Someone joined ${group.name}!`);
    const [text] = await fx.mmsRepo.find();
    expect(text.body).toMatch(new RegExp(`^Someone joined ${group.name}! `));
  });

  it("texts only recipients who want it with a usable, subscribed number, and keeps every in-app entry", async () => {
    const texted = await fx.createUser({ phoneNumber: "+14155550101" });
    const unsubscribed = await fx.createUser({
      phoneNumber: "+14155550102",
      phoneNumberUnsubscribed: true,
    });
    const defaultOff = await fx.createUser({
      phoneNumber: "+14155550103",
      textByDefault: false,
    });
    const noPhone = await fx.createUser();
    const turnedOn = await fx.createUser({
      phoneNumber: "+14155550104",
      textByDefault: false,
    });
    await setJoinNotice(turnedOn, NotificationChannel.Text, true);
    const turnedOff = await fx.createUser({ phoneNumber: "+14155550105" });
    await setJoinNotice(turnedOff, NotificationChannel.Text, false);
    const members = [
      texted,
      unsubscribed,
      defaultOff,
      noPhone,
      turnedOn,
      turnedOff,
    ];
    const group = await fx.createGroup({ leaders: [], members });
    const joiner = await fx.createUser({ name: "Tex Joiner" });

    await communityService.joinPublicCommunity(joiner.id, group.id);

    expect((await fx.joinNotifs()).length).toBe(members.length);
    const texts = await fx.mmsRepo.find({ order: { to: "ASC" } });
    expect(texts.map((mms) => mms.to)).toEqual([
      texted.phoneNumber,
      turnedOn.phoneNumber,
    ]);
    expect(texts[0].body).toMatch(
      new RegExp(
        `^Tex Joiner joined ${group.name}! \\S*/groups\\?tab=members&communityId=${group.id}`,
      ),
    );
    const notif = await fx.notifRepo.findOneOrFail({
      where: {
        category: NotificationCategory.GroupMemberJoined,
        user: { id: texted.id },
      },
    });
    const tracking = await ctx.dataSource
      .getRepository(MessageTracking)
      .findOneByOrFail({ trackingId: texts[0].cid! });
    expect(tracking).toMatchObject({
      source: MessageSource.GroupJoin,
      userId: texted.id,
      context: { notificationIds: [notif.id] },
    });
  });

  it("pushes per the kind's push setting, falling back to the push default", async () => {
    const pushed = await fx.createUser();
    const pushOff = await fx.createUser();
    await setJoinNotice(pushOff, NotificationChannel.Push, false);
    const defaultOff = await fx.createUser({ pushByDefault: false });
    const pushOn = await fx.createUser({ pushByDefault: false });
    await setJoinNotice(pushOn, NotificationChannel.Push, true);
    const members = [pushed, pushOff, defaultOff, pushOn];
    const deviceRepo = ctx.dataSource.getRepository(UserDevice);
    const past = new Date(Date.now() - 60_000);
    for (const user of members) {
      const device = await deviceRepo.save({
        user,
        deviceType: "iOS",
        expoPushToken: `ExponentPushToken[join_${user.id}]`,
      });
      await deviceRepo.update(device.id, { createdAt: past });
    }
    const group = await fx.createGroup({ leaders: [], members });
    const joiner = await fx.createUser();

    await communityService.joinPublicCommunity(joiner.id, group.id);
    await fx.notifRepo.update(
      { category: Not(NotificationCategory.GroupMemberJoined) },
      { shouldPush: false },
    );

    const messages = await ctx.app
      .get(NotifPushDispatcherWorker)
      .findNotificationPushes("group-join-test");

    expect(messages.map((message) => message.userId).sort()).toEqual(
      [pushed.id, pushOn.id].sort(),
    );
  });

  it("keeps the join and its existing notifications when saving the new ones fails", async () => {
    const leader = await fx.createUser();
    const existing = await fx.createUser();
    const group = await fx.createGroup({
      leaders: [leader],
      members: [leader, existing],
    });
    const joiner = await fx.createUser();
    const notifsService = ctx.app.get(NotifsService);
    const sendNotifs = notifsService.sendNotifs.bind(notifsService);
    jest
      .spyOn(notifsService, "sendNotifs")
      .mockImplementation((notifs) =>
        notifs.some(
          (notif) => notif.category === NotificationCategory.GroupMemberJoined,
        )
          ? Promise.reject(new Error("notification write failed"))
          : sendNotifs(notifs),
      );

    await communityService.joinPublicCommunity(joiner.id, group.id);

    const joined = await fx.communityRepo.findOneOrFail({
      where: { id: group.id },
      relations: { users: true },
    });
    expect(loadedCommunityUsers(joined).map((user) => user.id)).toContain(
      joiner.id,
    );
    expect(await fx.joinNotifs()).toEqual([]);
    expect(
      await fx.notifRepo.count({
        where: { category: NotificationCategory.MemberJoinedCommunity },
      }),
    ).toBe(1);
  });

  it("keeps a staff leader promotion when telling the existing leaders fails", async () => {
    const leader = await fx.createUser();
    const group = await fx.createGroup({
      leaders: [leader],
      members: [leader],
    });
    const promoted = await fx.createUser();
    jest
      .spyOn(ctx.app.get(NotifsService), "sendNotifs")
      .mockRejectedValue(new Error("notification write failed"));

    await communityService.addLeaderAdmin(group.id, promoted.id);

    const updated = await fx.communityRepo.findOneOrFail({
      where: { id: group.id },
      relations: { users: true, leaders: true },
    });
    expect(loadedCommunityUsers(updated).map((user) => user.id)).toContain(
      promoted.id,
    );
    expect(updated.leaders!.map((user) => user.id)).toContain(promoted.id);
  });

  it("keeps the join and its in-app entries when a text fails to send", async () => {
    const member = await fx.createUser({ phoneNumber: "+14155550106" });
    const group = await fx.createGroup({ leaders: [], members: [member] });
    const joiner = await fx.createUser();
    jest
      .spyOn(ctx.app.get(MmsService), "sendMms")
      .mockRejectedValue(new Error("twilio is down"));

    await communityService.joinPublicCommunity(joiner.id, group.id);

    expect((await fx.announcements()).get(member.id)).toEqual([joiner.id]);
  });

  it("keeps the join and its in-app entries and texts no one when the text settings fail to load", async () => {
    const member = await fx.createUser({ phoneNumber: "+14155550108" });
    const group = await fx.createGroup({ leaders: [], members: [member] });
    const joiner = await fx.createUser();
    const preferences = ctx.app.get(NotificationPreferencesService);
    const notifs = ctx.app.get(NotifsService);
    const load = preferences.load.bind(preferences);
    const sendNotifs = notifs.sendNotifs.bind(notifs);
    let saved = false;
    jest.spyOn(preferences, "load").mockImplementation(async (params) => {
      if (saved) throw new Error("db is down");
      return load(params);
    });
    jest.spyOn(notifs, "sendNotifs").mockImplementation(async (rows) => {
      const result = await sendNotifs(rows);
      saved ||= rows.some(
        (row) => row.category === NotificationCategory.GroupMemberJoined,
      );
      return result;
    });
    const sendMms = jest.spyOn(ctx.app.get(MmsService), "sendMms");

    await communityService.joinPublicCommunity(joiner.id, group.id);

    expect((await fx.announcements()).get(member.id)).toEqual([joiner.id]);
    expect(sendMms).not.toHaveBeenCalled();
  });
});
