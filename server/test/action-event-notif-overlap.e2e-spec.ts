import { milliseconds } from "date-fns";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { Action } from "src/actions/entities/action.entity";
import {
  ReminderCohortType,
  ReminderGroup,
  ReminderGroupTimingMode,
} from "src/actions/entities/reminder-group.entity";
import { MmsService } from "src/mms/mms.service";
import { ActionEventNotifDeliveryService } from "src/notifs/action-event-notif-delivery.service";
import { ActionEventNotifWorker } from "src/notifs/action-event-notif.worker";
import { ActionEventReminderService } from "src/notifs/action-event-reminder.service";
import { ActionEventNotif } from "src/notifs/entities/action-event-notif.entity";
import {
  ContractEvent,
  ContractEventType,
} from "src/user/entities/contract-event.entity";
import { User } from "src/user/entities/user.entity";
import { EntitySubscriberInterface } from "typeorm";
import { saveLiveCohortDecisions } from "./cohort-decision-fixtures";
import { closeTestApp, createTestApp, TestContext } from "./e2e-test-utils";

describe("ActionEventNotifWorker overlapping runs (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    process.env.SEND_DEV_NOTIFS = "1";
    ctx = await createTestApp([]);
  });

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  afterEach(() => jest.restoreAllMocks());

  const phoneNumber = "+14155550142";

  const siblingGroups = async (
    groups: Array<{ excludePreviouslyNotified: boolean; sendAt: Date }>,
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
    const actionRepo = ctx.dataSource.getRepository(Action);
    const action = await actionRepo.save(
      actionRepo.create({
        name: "Overlap action",
        category: [],
        body: "Body copy",
        shortDescription: "Short description",
        cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
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

  it.each([
    ["a concurrent catch-up's", true],
    ["a concurrent non-catch-up's", false],
  ])(
    "holds a catch-up's coverage read until %s reservation commits",
    async (_, excludePreviouslyNotified) => {
      // The first run plans only the due group. The second, started once the
      // other group is due too, reaches that one first, so the two runs
      // reserve different groups and only the coverage lock keeps the
      // catch-up's read after the first run's reservation.
      const [later, due] = await siblingGroups([
        {
          excludePreviouslyNotified: true,
          sendAt: new Date(Date.now() + 60_000),
        },
        { excludePreviouslyNotified, sendAt: minutesAgo(5) },
      ]);
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
});
