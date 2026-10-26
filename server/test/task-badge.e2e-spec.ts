import { ActionActivityType } from "@alliance/common/actionActivity";
import { milliseconds } from "date-fns";
import {
  Expo,
  type ExpoPushErrorTicket,
  type ExpoPushMessage,
} from "expo-server-sdk";
import { ActionActivityService } from "src/actions/action-activity.service";
import { ActionsService } from "src/actions/actions.service";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
import { TaskBadgeService } from "src/actions/task-badge.service";
import { EXPO_CLIENT } from "src/push/push.service";
import {
  ContractEvent,
  ContractEventType,
} from "src/user/entities/contract-event.entity";
import {
  UserAwayRange,
  UserAwayRangeReason,
} from "src/user/entities/user-away-range.entity";
import { UserDevice } from "src/user/entities/user-device.entity";
import { User } from "src/user/entities/user.entity";
import request from "supertest";
import type { Repository } from "typeorm";
import {
  createTestApp,
  eventually,
  signAccessToken,
  type TestContext,
  waitForLockWait,
} from "./e2e-test-utils";

describe("Task badge sync (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let deviceRepo: Repository<UserDevice>;
  let taskBadgeService: TaskBadgeService;
  let sent: ExpoPushMessage[];
  let rejectNext: ExpoPushErrorTicket | null;
  let failNextSend: boolean;
  let duringSend: (() => Promise<void>) | null;
  let action: Action;
  let userCounter = 0;
  const previousSendDevNotifs = process.env.SEND_DEV_NOTIFS;

  const createMemberWithDevice = async () => {
    userCounter += 1;
    const user = await userRepo.save(
      userRepo.create({
        name: `Badge User ${userCounter}`,
        email: `badgeuser${userCounter}@example.com`,
        password: "pass",
        tags: [ctx.defaultTag],
      }),
    );
    await ctx.dataSource.getRepository(ContractEvent).save({
      user: { id: user.id },
      type: ContractEventType.SIGNED,
      date: new Date(Date.now() - milliseconds({ days: 2 })),
      contract: { id: ctx.defaultContractId },
    });
    const expoPushToken = `ExponentPushToken[badge_${user.id}]`;
    const device = await deviceRepo.save(
      deviceRepo.create({
        user,
        deviceType: "iOS",
        expoPushToken,
        taskBadgePushes: true,
      }),
    );
    return {
      user,
      device,
      expoPushToken,
      token: signAccessToken(ctx.jwtService, user),
    };
  };

  const sentTo = (expoPushToken: string) =>
    sent.filter((message) => message.to === expoPushToken);

  beforeAll(async () => {
    process.env.SEND_DEV_NOTIFS = "1";
    ctx = await createTestApp([]);
    userRepo = ctx.dataSource.getRepository(User);
    deviceRepo = ctx.dataSource.getRepository(UserDevice);
    taskBadgeService = ctx.app.get(TaskBadgeService);

    const expo = ctx.app.get<Expo>(EXPO_CLIENT);
    jest
      .spyOn(expo, "chunkPushNotifications")
      .mockImplementation((messages) => [messages]);
    jest
      .spyOn(expo, "sendPushNotificationsAsync")
      .mockImplementation(async (messages) => {
        sent.push(...messages);
        const hook = duringSend;
        duringSend = null;
        await hook?.();
        if (failNextSend) {
          failNextSend = false;
          throw new Error("Expo unreachable");
        }
        const rejection = rejectNext;
        rejectNext = null;
        if (rejection) {
          return messages.map(() => rejection);
        }
        return messages.map(() => ({ status: "ok" as const, id: "receipt" }));
      });

    action = await ctx.dataSource.getRepository(Action).save({
      name: "Badge Action",
      category: [],
      body: "Body copy",
      visibilityMode: VisibilityMode.Public,
      cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
    });
    await ctx.dataSource.getRepository(ActionEvent).save([
      {
        title: "Open",
        description: "Open",
        newStatus: ActionStatus.MemberAction,
        date: new Date(Date.now() - milliseconds({ hours: 1 })),
        action,
      },
      {
        title: "Close",
        description: "Close",
        newStatus: ActionStatus.OfficeAction,
        date: new Date(Date.now() + milliseconds({ days: 1 })),
        action,
      },
    ]);
  }, 50000);

  beforeEach(() => {
    sent = [];
    rejectNext = null;
    failNextSend = false;
    duringSend = null;
  });

  afterAll(async () => {
    process.env.SEND_DEV_NOTIFS = previousSendDevNotifs;
    await ctx?.app.close();
  });

  it("sends a quiet badge-only push with the count, once per change", async () => {
    const { user, device, expoPushToken } = await createMemberWithDevice();

    await taskBadgeService.syncUser(user.id);
    expect(sentTo(expoPushToken)).toEqual([
      {
        to: expoPushToken,
        badge: 1,
        priority: "normal",
        data: { taskBadgeCount: 1 },
      },
    ]);
    expect(
      (await deviceRepo.findOneByOrFail({ id: device.id })).badgeCount,
    ).toBe(1);

    await taskBadgeService.syncUser(user.id);
    expect(sentTo(expoPushToken)).toHaveLength(1);
  });

  it("sends nothing to a build that registered without badge-push support", async () => {
    const { user, expoPushToken, token } = await createMemberWithDevice();

    await request(ctx.app.getHttpServer())
      .post("/user/registerDevice")
      .set("Authorization", `Bearer ${token}`)
      .send({ deviceType: "iOS", expoPushToken })
      .expect(201);
    await taskBadgeService.syncUser(user.id);

    expect(sentTo(expoPushToken)).toHaveLength(0);
  });

  it("sends nothing to a deleted device", async () => {
    const { user } = await createMemberWithDevice();
    const deletedToken = `ExponentPushToken[badge_deleted_${user.id}]`;
    const deleted = await deviceRepo.save(
      deviceRepo.create({
        user,
        deviceType: "iOS",
        expoPushToken: deletedToken,
        taskBadgePushes: true,
      }),
    );
    await deviceRepo.softDelete(deleted.id);

    await taskBadgeService.syncUser(user.id);

    expect(sentTo(deletedToken)).toHaveLength(0);
  });

  it("pushes the decrease right after the user dismisses the task", async () => {
    const { user, expoPushToken, token } = await createMemberWithDevice();
    await taskBadgeService.syncUser(user.id);

    await request(ctx.app.getHttpServer())
      .post(`/actions/dismiss/${action.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);

    const pushes = await eventually(
      async () => sentTo(expoPushToken),
      (messages) => messages.length === 2,
      "the decrease push",
    );
    expect(pushes[1].badge).toBe(0);
  });

  it.each([
    ActionActivityType.USER_COMPLETED,
    ActionActivityType.USER_WONT_COMPLETE,
  ])("pushes the decrease right after a %s activity", async (type) => {
    const { user, expoPushToken } = await createMemberWithDevice();
    await taskBadgeService.syncUser(user.id);

    await ctx.app.get(ActionActivityService).createActionActivity({
      actionId: action.id,
      userId: user.id,
      type,
      adminCreated: true,
    });

    const pushes = await eventually(
      async () => sentTo(expoPushToken),
      (messages) => messages.length === 2,
      "the decrease push",
    );
    expect(pushes[1].badge).toBe(0);
  });

  it("pushes the decrease right after the user marks themselves away", async () => {
    const { user, expoPushToken, token } = await createMemberWithDevice();
    await taskBadgeService.syncUser(user.id);
    const today = new Date().toISOString().slice(0, 10);
    const later = new Date(Date.now() + milliseconds({ days: 3 }))
      .toISOString()
      .slice(0, 10);

    await request(ctx.app.getHttpServer())
      .post("/user/awayranges")
      .set("Authorization", `Bearer ${token}`)
      .send({
        startDay: today,
        endDay: later,
        reason: UserAwayRangeReason.VACATION,
      })
      .expect(201);

    const pushes = await eventually(
      async () => sentTo(expoPushToken),
      (messages) => messages.length === 2,
      "the decrease push",
    );
    expect(pushes[1].badge).toBe(0);
  });

  const futureDay = (days: number) =>
    new Date(Date.now() + milliseconds({ days })).toISOString().slice(0, 10);

  it.each([
    {
      edit: "has an admin remove it",
      send: (rangeId: number, userId: number) =>
        request(ctx.app.getHttpServer())
          .delete(`/user/admin/${userId}/awayranges/${rangeId}`)
          .set("Authorization", `Bearer ${ctx.adminAccessToken}`),
    },
    {
      edit: "has an admin move it later",
      send: (rangeId: number, userId: number) =>
        request(ctx.app.getHttpServer())
          .patch(`/user/admin/${userId}/awayranges/${rangeId}`)
          .send({
            reason: UserAwayRangeReason.VACATION,
            startDay: futureDay(5),
            endDay: futureDay(7),
          })
          .set("Authorization", `Bearer ${ctx.adminAccessToken}`),
    },
  ])(
    "pushes the increase right after the user's away period $edit",
    async ({ send }) => {
      const { user, expoPushToken } = await createMemberWithDevice();
      const range = await ctx.dataSource.getRepository(UserAwayRange).save({
        userId: user.id,
        startDate: new Date(Date.now() - milliseconds({ hours: 2 })),
        endDate: new Date(Date.now() + milliseconds({ days: 2 })),
        reason: UserAwayRangeReason.VACATION,
      });
      await taskBadgeService.syncUser(user.id);
      expect(sentTo(expoPushToken).map((message) => message.badge)).toEqual([
        0,
      ]);

      await send(range.id, user.id).expect(200);

      const pushes = await eventually(
        async () => sentTo(expoPushToken),
        (messages) => messages.length === 2,
        "the increase push",
      );
      expect(pushes[1].badge).toBe(1);
    },
  );

  it("leaves a device alone when a newer computation already claimed it", async () => {
    const { user, device, expoPushToken } = await createMemberWithDevice();
    await deviceRepo.update(device.id, {
      badgeCount: 5,
      badgeCountComputedAt: new Date(Date.now() + milliseconds({ minutes: 1 })),
    });

    await taskBadgeService.syncUser(user.id);

    expect(sentTo(expoPushToken)).toHaveLength(0);
    expect(
      (await deviceRepo.findOneByOrFail({ id: device.id })).badgeCount,
    ).toBe(5);
  });

  it("compares against a count another sync committed while this one waited", async () => {
    const { user, device, expoPushToken } = await createMemberWithDevice();
    await taskBadgeService.syncUser(user.id);
    const holder = ctx.dataSource.createQueryRunner();
    await holder.connect();
    await holder.startTransaction();
    await holder.query(
      `UPDATE user_device SET "badgeCount" = 5, "badgeCountComputedAt" = $1
       WHERE id = $2`,
      [new Date(Date.now() - milliseconds({ seconds: 1 })), device.id],
    );

    const sync = taskBadgeService.syncUser(user.id);
    await waitForLockWait(ctx.dataSource);
    await holder.commitTransaction();
    await holder.release();
    await sync;

    expect(sentTo(expoPushToken).map((message) => message.badge)).toEqual([
      1, 1,
    ]);
  });

  it("retries a rejected push on the next sync", async () => {
    const { user, device, expoPushToken } = await createMemberWithDevice();
    rejectNext = { status: "error", message: "rejected" };

    await taskBadgeService.syncUser(user.id);
    expect(
      (await deviceRepo.findOneByOrFail({ id: device.id })).badgeCount,
    ).toBeNull();

    await taskBadgeService.syncUser(user.id);
    expect(sentTo(expoPushToken)).toHaveLength(2);
  });

  it("retries a push whose send threw on the next sync", async () => {
    const { user, device, expoPushToken } = await createMemberWithDevice();
    failNextSend = true;

    await taskBadgeService.syncUser(user.id);
    expect(
      (await deviceRepo.findOneByOrFail({ id: device.id })).badgeCount,
    ).toBeNull();

    await taskBadgeService.syncUser(user.id);
    expect(sentTo(expoPushToken)).toHaveLength(2);
  });

  it("retries a rejected push that a newer sync of the same count skipped", async () => {
    const { user, device, expoPushToken } = await createMemberWithDevice();
    rejectNext = { status: "error", message: "rejected" };
    duringSend = () => taskBadgeService.syncUser(user.id);

    await taskBadgeService.syncUser(user.id);
    expect(
      (await deviceRepo.findOneByOrFail({ id: device.id })).badgeCount,
    ).toBeNull();

    await taskBadgeService.syncUser(user.id);
    expect(sentTo(expoPushToken)).toHaveLength(2);
  });

  it("resends when a newer sync claimed a different count while this push was in flight", async () => {
    const { user, device, expoPushToken } = await createMemberWithDevice();
    duringSend = async () => {
      await deviceRepo.update(device.id, {
        badgeCount: 0,
        badgeCountComputedAt: new Date(
          Date.now() + milliseconds({ minutes: 1 }),
        ),
      });
    };

    await taskBadgeService.syncUser(user.id);

    expect(sentTo(expoPushToken)).toHaveLength(1);
    expect(
      (await deviceRepo.findOneByOrFail({ id: device.id })).badgeCount,
    ).toBeNull();
  });

  it("keeps the count of a device whose token isn't an Expo push token", async () => {
    const { user, device } = await createMemberWithDevice();
    await deviceRepo.update(device.id, { expoPushToken: "not-an-expo-token" });

    await taskBadgeService.syncUser(user.id);

    expect(
      (await deviceRepo.findOneByOrFail({ id: device.id })).badgeCount,
    ).toBe(1);
  });

  it("removes a device Expo reports as no longer registered", async () => {
    const { user, device } = await createMemberWithDevice();
    rejectNext = {
      status: "error",
      message: "gone",
      details: { error: "DeviceNotRegistered" },
    };

    await taskBadgeService.syncUser(user.id);

    expect(await deviceRepo.findOneBy({ id: device.id })).toBeNull();
  });

  it("sweeps every opted-in device whose count changed", async () => {
    const { device, expoPushToken } = await createMemberWithDevice();
    await deviceRepo.update(device.id, { badgeCount: 5 });

    await taskBadgeService.sweep();

    expect(sentTo(expoPushToken).map((message) => message.badge)).toEqual([1]);
  });

  it("lets a sync that started during a sweep keep its newer count", async () => {
    const { device, expoPushToken } = await createMemberWithDevice();
    const actionsService = ctx.app.get(ActionsService);
    const findOpenActionIds =
      actionsService.findOpenActionIds.bind(actionsService);
    jest
      .spyOn(actionsService, "findOpenActionIds")
      .mockImplementationOnce(async () => {
        const ids = await findOpenActionIds();
        await deviceRepo.update(device.id, {
          badgeCount: 7,
          badgeCountComputedAt: new Date(),
        });
        return ids;
      });

    await taskBadgeService.sweep();

    expect(sentTo(expoPushToken)).toHaveLength(0);
    expect(
      (await deviceRepo.findOneByOrFail({ id: device.id })).badgeCount,
    ).toBe(7);
  });

  it("resends after the device registers a new push token", async () => {
    const { user, device, token } = await createMemberWithDevice();
    await taskBadgeService.syncUser(user.id);
    const newToken = `ExponentPushToken[badge_${user.id}_new]`;

    await request(ctx.app.getHttpServer())
      .post("/user/registerDevice")
      .set("Authorization", `Bearer ${token}`)
      .send({
        deviceType: "iOS",
        expoPushToken: newToken,
        deviceId: device.id,
        taskBadgePushes: true,
      })
      .expect(201);
    await taskBadgeService.syncUser(user.id);

    expect(sentTo(newToken)).toHaveLength(1);
  });

  it("resends after the device moves to another account", async () => {
    const first = await createMemberWithDevice();
    const second = await createMemberWithDevice();
    await taskBadgeService.syncUser(first.user.id);

    await request(ctx.app.getHttpServer())
      .post("/user/registerDevice")
      .set("Authorization", `Bearer ${second.token}`)
      .send({
        deviceType: "iOS",
        expoPushToken: first.expoPushToken,
        taskBadgePushes: true,
      })
      .expect(201);
    await taskBadgeService.syncUser(first.user.id);
    expect(sentTo(first.expoPushToken)).toHaveLength(1);

    await taskBadgeService.syncUser(second.user.id);
    expect(sentTo(first.expoPushToken)).toHaveLength(2);
  });

  it("unregisters a device only given its push token, without a session", async () => {
    const { device, expoPushToken } = await createMemberWithDevice();

    await request(ctx.app.getHttpServer())
      .post("/user/unregisterDevice")
      .send({ deviceId: device.id, expoPushToken: "ExponentPushToken[other]" })
      .expect(201);
    expect(await deviceRepo.findOneBy({ id: device.id })).not.toBeNull();

    await request(ctx.app.getHttpServer())
      .post("/user/unregisterDevice")
      .send({ deviceId: device.id, expoPushToken })
      .expect(201);
    expect(await deviceRepo.findOneBy({ id: device.id })).toBeNull();
  });
});
