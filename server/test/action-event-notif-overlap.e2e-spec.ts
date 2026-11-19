import { milliseconds } from "date-fns";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { ActionSuite } from "src/actions/entities/action-suite.entity";
import { Action } from "src/actions/entities/action.entity";
import {
  ReminderCohortType,
  ReminderGroup,
  ReminderGroupTimingMode,
} from "src/actions/entities/reminder-group.entity";
import { MmsService } from "src/mms/mms.service";
import { NotificationKind } from "src/notification-settings/notification-kind";
import { ActionEventNotifDeliveryService } from "src/notifs/action-event-notif-delivery.service";
import { ActionEventNotifWorker } from "src/notifs/action-event-notif.worker";
import { ActionEventReminderService } from "src/notifs/action-event-reminder.service";
import { ActionEventNotif } from "src/notifs/entities/action-event-notif.entity";
import { NotificationChannel } from "src/notifs/notif-utils";
import { NotifsService } from "src/notifs/notifs.service";
import {
  ContractEvent,
  ContractEventType,
} from "src/user/entities/contract-event.entity";
import { User } from "src/user/entities/user.entity";
import { EntitySubscriberInterface } from "typeorm";
import { saveLiveCohortDecisions } from "./cohort-decision-fixtures";
import {
  closeTestApp,
  createTestApp,
  setPreference,
  TestContext,
} from "./e2e-test-utils";

describe("ActionEventNotifWorker overlapping runs (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    process.env.SEND_DEV_NOTIFS = "1";
    ctx = await createTestApp([]);
  });

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  const missedInApp = () => ({
    userId: ctx.testUserId,
    kind: NotificationKind.MissedDeadline,
    channel: NotificationChannel.InApp,
  });
  const suiteIds: number[] = [];
  const missedGroupIds: number[] = [];

  afterEach(async () => {
    jest.restoreAllMocks();
    await setPreference(ctx, { ...missedInApp(), enabled: true });
    // The spec's tests share a member, whose third consecutive missed suite
    // gets no notice.
    if (suiteIds.length > 0)
      await ctx.dataSource
        .getRepository(ActionSuite)
        .softDelete(suiteIds.splice(0));
    if (missedGroupIds.length > 0)
      await ctx.dataSource
        .getRepository(ReminderGroup)
        .softDelete(missedGroupIds.splice(0));
  });

  const phoneNumber = "+14155550142";

  const siblingGroups = async (
    groups: Array<{ excludePreviouslyNotified: boolean; sendAt: Date }>,
    missedSuite?: { closedAt: Date },
  ) => {
    const now = Date.now();
    const ago = (ms: number) => new Date(now - ms);
    await ctx.dataSource.getRepository(User).update(ctx.testUserId, {
      emailByDefault: false,
      textByDefault: true,
      phoneNumber,
    });
    await ctx.dataSource.getRepository(ContractEvent).save({
      user: { id: ctx.testUserId },
      type: ContractEventType.SIGNED,
      date: ago(milliseconds({ days: 3 })),
      automatic: false,
      contractId: ctx.defaultContractId,
    });
    const actionSuite =
      missedSuite &&
      (await ctx.dataSource
        .getRepository(ActionSuite)
        .save({ name: "Overlap suite" }));
    if (actionSuite) suiteIds.push(actionSuite.id);
    const actionRepo = ctx.dataSource.getRepository(Action);
    const action = await actionRepo.save(
      actionRepo.create({
        name: "Overlap action",
        category: [],
        body: "Body copy",
        shortDescription: "Short description",
        cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
        suite: actionSuite,
      }),
    );
    const eventRepo = ctx.dataSource.getRepository(ActionEvent);
    const memberActionEvent = await eventRepo.save(
      eventRepo.create({
        title: "Overlap member event",
        description: "desc",
        newStatus: ActionStatus.MemberAction,
        date: ago(milliseconds({ hours: 1 })),
        action,
      }),
    );
    const groupRepo = ctx.dataSource.getRepository(ReminderGroup);
    const saved: ReminderGroup[] = [];
    for (const [
      index,
      { excludePreviouslyNotified, sendAt },
    ] of groups.entries()) {
      saved.push(
        await groupRepo.save(
          groupRepo.create({
            name: `Overlap group ${index}`,
            memberActionEvent,
            timingMode: ReminderGroupTimingMode.Absolute,
            cohortType: ReminderCohortType.AllUncompleted,
            sendAtAbsolute: sendAt,
            excludePreviouslyNotified,
            emailMessage: "Reminder for #{firstname} on #{action}",
            emailSubject: "Reminder: #{action}",
            textMessage: "Hi #{firstname}, remember #{action}",
            allSent: false,
          }),
        ),
      );
    }
    if (missedSuite) {
      const deadlineEvent = await eventRepo.save(
        eventRepo.create({
          title: "Overlap deadline",
          description: "desc",
          newStatus: ActionStatus.OfficeAction,
          date: missedSuite.closedAt,
          action,
        }),
      );
      const missedGroup = await groupRepo.save(
        groupRepo.create({
          name: "Overlap missed suite",
          memberActionEvent,
          deadlineEvent,
          actionSuite,
          timingMode: ReminderGroupTimingMode.FromDeadline,
          sendAtSecondsFromDeadline: 0,
          cohortType: ReminderCohortType.AllUncompleted,
          emailSubject: "You missed an Alliance task",
          emailMessage: "Hi #{firstname}\n#{missedactioncontext}",
          textMessage: "Missed text",
          pushMessage: "Missed push",
          useSuiteTaskCount: true,
          allSent: false,
        }),
      );
      missedGroupIds.push(missedGroup.id);
      saved.push(missedGroup);
    }
    await saveLiveCohortDecisions(ctx);
    return saved;
  };

  const minutesAgo = (minutes: number) =>
    new Date(Date.now() - milliseconds({ minutes }));

  const dueSiblingGroups = () =>
    siblingGroups(
      [false, true].map((excludePreviouslyNotified) => ({
        excludePreviouslyNotified,
        sendAt: minutesAgo(5),
      })),
    );

  it("sends a catch-up group nothing while a sibling's send to the member is in flight", async () => {
    await dueSiblingGroups();
    const mms = ctx.app.get(MmsService);
    const sendMms = mms.sendMms.bind(mms);
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    let sending!: () => void;
    const firstSendStarted = new Promise<void>(
      (resolve) => (sending = resolve),
    );
    const spy = jest
      .spyOn(mms, "sendMms")
      .mockImplementationOnce(async (params) => {
        sending();
        await released;
        return sendMms(params);
      });
    const worker = ctx.app.get(ActionEventNotifWorker);

    const first = worker.dispatchDue();
    await firstSendStarted;
    await worker.dispatchDue();
    release();
    await first;

    expect(
      spy.mock.calls.filter(([params]) => params.to === phoneNumber),
    ).toHaveLength(1);
  });

  it("releases a sibling's reservation when it sent nothing, so the catch-up sends", async () => {
    await dueSiblingGroups();
    jest
      .spyOn(ctx.app.get(ActionEventNotifDeliveryService), "prepare")
      .mockResolvedValueOnce(async () => false);
    const spy = jest.spyOn(ctx.app.get(MmsService), "sendMms");

    await ctx.app.get(ActionEventNotifWorker).dispatchDue();

    expect(
      spy.mock.calls.filter(([params]) => params.to === phoneNumber),
    ).toHaveLength(1);
  });

  it("releases a sibling's reservation when it failed before sending, so the catch-up sends", async () => {
    await dueSiblingGroups();
    jest
      .spyOn(ctx.app.get(ActionEventNotifDeliveryService), "prepare")
      .mockRejectedValueOnce(new Error("render failed"));
    const spy = jest.spyOn(ctx.app.get(MmsService), "sendMms");
    const worker = ctx.app.get(ActionEventNotifWorker);

    await expect(worker.dispatchDue()).rejects.toThrow("render failed");
    await worker.dispatchDue();

    expect(
      spy.mock.calls.filter(([params]) => params.to === phoneNumber),
    ).toHaveLength(1);
  });

  it("keeps a reservation whose send threw, so the catch-up does not send", async () => {
    await dueSiblingGroups();
    const spy = jest
      .spyOn(ctx.app.get(MmsService), "sendMms")
      .mockRejectedValueOnce(new Error("provider timed out"));
    const worker = ctx.app.get(ActionEventNotifWorker);

    await expect(worker.dispatchDue()).rejects.toThrow("provider timed out");
    await worker.dispatchDue();

    expect(
      spy.mock.calls.filter(([params]) => params.to === phoneNumber),
    ).toHaveLength(1);
  });

  it("plans no catch-up for a member a pending reminder covers", async () => {
    const [, catchUp] = await dueSiblingGroups();
    jest
      .spyOn(ctx.app.get(MmsService), "sendMms")
      .mockRejectedValueOnce(new Error("provider timed out"));
    await expect(
      ctx.app.get(ActionEventNotifWorker).dispatchDue(),
    ).rejects.toThrow("provider timed out");

    const plans = await ctx.app
      .get(ActionEventReminderService)
      .findNotificationPlansForGroup(catchUp.id);

    expect(plans.map((plan) => plan.user.id)).not.toContain(ctx.testUserId);
  });

  // Gives up after 5s, so without the lock the test fails on its assertion
  // rather than its timeout.
  const waitForAdvisoryLockWaiter = async () => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const [{ waiting }] = await ctx.dataSource.query<
        Array<{ waiting: boolean }>
      >(
        "SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND NOT granted) AS waiting",
      );
      if (waiting) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  };

  const laterCatchUp = () => ({
    excludePreviouslyNotified: true,
    sendAt: new Date(Date.now() + 60_000),
  });

  it.each([
    [
      "a concurrent catch-up's",
      () =>
        siblingGroups([
          laterCatchUp(),
          { excludePreviouslyNotified: true, sendAt: minutesAgo(5) },
        ]),
    ],
    [
      "a concurrent non-catch-up's",
      () =>
        siblingGroups([
          laterCatchUp(),
          { excludePreviouslyNotified: false, sendAt: minutesAgo(5) },
        ]),
    ],
    [
      "a concurrent missed-suite notice's",
      () => siblingGroups([laterCatchUp()], { closedAt: minutesAgo(5) }),
    ],
  ])(
    "holds a catch-up's coverage read until %s reservation commits",
    async (_, setUp) => {
      // The first run plans only the due group. The second, started once the
      // other group is due too, reaches that one first, so the two runs
      // reserve different groups and only the coverage lock keeps the
      // catch-up's read after the first run's reservation.
      const [later, due] = await setUp();
      let release!: () => void;
      const released = new Promise<void>((resolve) => (release = resolve));
      let paused!: () => void;
      const firstReserving = new Promise<void>((resolve) => (paused = resolve));
      let pausedOnce = false;
      const subscriber: EntitySubscriberInterface<ActionEventNotif> = {
        listenTo: () => ActionEventNotif,
        beforeInsert: async ({ entity }) => {
          if (pausedOnce || entity.reminderGroup?.id !== due.id) return;
          pausedOnce = true;
          paused();
          await released;
        },
      };
      ctx.dataSource.subscribers.push(subscriber);
      const spy = jest.spyOn(ctx.app.get(MmsService), "sendMms");
      const worker = ctx.app.get(ActionEventNotifWorker);

      try {
        const first = worker.dispatchDue();
        await firstReserving;
        await ctx.dataSource
          .getRepository(ReminderGroup)
          .update(later.id, { sendAtAbsolute: minutesAgo(10) });
        const second = worker.dispatchDue();
        await waitForAdvisoryLockWaiter();
        release();
        await Promise.all([first, second]);
      } finally {
        ctx.dataSource.subscribers.splice(
          ctx.dataSource.subscribers.indexOf(subscriber),
          1,
        );
      }

      expect(
        spy.mock.calls.filter(([params]) => params.to === phoneNumber),
      ).toHaveLength(1);
    },
  );

  it("releases a missed-suite notice's reservation when it failed before sending, so a catch-up sends", async () => {
    const [later, missed] = await siblingGroups([laterCatchUp()], {
      closedAt: minutesAgo(5),
    });
    await setPreference(ctx, { ...missedInApp(), enabled: false });
    jest
      .spyOn(ctx.app.get(ActionEventNotifDeliveryService), "prepare")
      .mockRejectedValueOnce(new Error("render failed"));
    const spy = jest.spyOn(ctx.app.get(MmsService), "sendMms");
    const worker = ctx.app.get(ActionEventNotifWorker);

    await expect(worker.dispatchDue()).rejects.toThrow("render failed");
    await ctx.dataSource
      .getRepository(ReminderGroup)
      .update(later.id, { sendAtAbsolute: minutesAgo(10) });
    await worker.dispatchDue();

    expect(
      await ctx.dataSource.getRepository(ActionEventNotif).findOneByOrFail({
        reminderGroup: { id: missed.id },
      }),
    ).toMatchObject({ sent: false, deliveryPending: false });
    expect(
      spy.mock.calls.filter(([params]) => params.to === phoneNumber),
    ).toHaveLength(1);
  });

  it("keeps a missed-suite notice counted when its in-app entry was saved but not recorded, so a catch-up does not send", async () => {
    const [later, missed] = await siblingGroups([laterCatchUp()], {
      closedAt: minutesAgo(5),
    });
    const notifs = ctx.app.get(NotifsService);
    const sendNotif = notifs.sendNotif.bind(notifs);
    jest.spyOn(notifs, "sendNotif").mockImplementationOnce(async (params) => {
      const notification = await sendNotif(params);
      // The next query builder is the write recording the entry.
      jest
        .spyOn(ctx.dataSource.manager, "createQueryBuilder")
        .mockImplementationOnce(() => {
          throw new Error("write failed");
        });
      return notification;
    });
    const spy = jest.spyOn(ctx.app.get(MmsService), "sendMms");
    const worker = ctx.app.get(ActionEventNotifWorker);

    await expect(worker.dispatchDue()).rejects.toThrow("write failed");
    await ctx.dataSource
      .getRepository(ReminderGroup)
      .update(later.id, { sendAtAbsolute: minutesAgo(10) });
    await worker.dispatchDue();

    expect(
      await ctx.dataSource.getRepository(ActionEventNotif).findOneByOrFail({
        reminderGroup: { id: missed.id },
      }),
    ).toMatchObject({ sent: false, deliveryPending: true });
    expect(
      spy.mock.calls.filter(([params]) => params.to === phoneNumber),
    ).toHaveLength(0);
  });

  it("sends a catch-up nothing while a missed-suite notice with no in-app entry sends its text", async () => {
    const [later, missed] = await siblingGroups([laterCatchUp()], {
      closedAt: minutesAgo(5),
    });
    await setPreference(ctx, { ...missedInApp(), enabled: false });
    const mms = ctx.app.get(MmsService);
    const sendMms = mms.sendMms.bind(mms);
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    let sending!: () => void;
    const noticeSending = new Promise<void>((resolve) => (sending = resolve));
    const spy = jest
      .spyOn(mms, "sendMms")
      .mockImplementationOnce(async (params) => {
        sending();
        await released;
        return sendMms(params);
      });
    const worker = ctx.app.get(ActionEventNotifWorker);

    const first = worker.dispatchDue();
    await noticeSending;
    await ctx.dataSource
      .getRepository(ReminderGroup)
      .update(later.id, { sendAtAbsolute: minutesAgo(10) });
    await worker.dispatchDue();
    release();
    await first;

    expect(
      spy.mock.calls.filter(([params]) => params.to === phoneNumber),
    ).toHaveLength(1);
    expect(
      await ctx.dataSource.getRepository(ActionEventNotif).findOneByOrFail({
        reminderGroup: { id: missed.id },
      }),
    ).toMatchObject({ sent: true, deliveryPending: false });
  });
});
