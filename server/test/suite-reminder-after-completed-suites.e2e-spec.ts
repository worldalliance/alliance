import { ActionActivityType } from "@alliance/common/actionActivity";
import { milliseconds } from "date-fns";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
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
import { ActionEventNotifWorker } from "src/notifs/action-event-notif.worker";
import { ActionEventNotif } from "src/notifs/entities/action-event-notif.entity";
import { ExperimentAssignment } from "src/notifs/entities/experiment-assignment.entity";
import { Notification } from "src/notifs/entities/notification.entity";
import {
  ContractEvent,
  ContractEventType,
} from "src/user/entities/contract-event.entity";
import { User } from "src/user/entities/user.entity";
import { saveLiveCohortDecisions } from "./cohort-decision-fixtures";
import { createTestApp, stubExpoClient, TestContext } from "./e2e-test-utils";

const SEND_BEFORE_DEADLINE_SECONDS = 36 * 60 * 60;

describe("suite reminder after a run of completed suites (e2e)", () => {
  let ctx: TestContext;

  const ago = (duration: Parameters<typeof milliseconds>[0]) =>
    new Date(Date.now() - milliseconds(duration));

  const createSuite = async (params: { name: string; deadline: Date }) => {
    const { name, deadline } = params;
    const suite = await ctx.dataSource
      .getRepository(ActionSuite)
      .save({ name });
    const action = await ctx.dataSource.getRepository(Action).save({
      name: `${name} task`,
      category: [],
      body: "Body",
      shortDescription: "Short",
      suite,
      cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
    });
    const [memberEvent, deadlineEvent] = await ctx.dataSource
      .getRepository(ActionEvent)
      .save([
        {
          title: `${name} member`,
          description: "Member phase",
          newStatus: ActionStatus.MemberAction,
          date: new Date(deadline.getTime() - milliseconds({ days: 7 })),
          action,
        },
        {
          title: `${name} deadline`,
          description: "Office phase",
          newStatus: ActionStatus.OfficeAction,
          date: deadline,
          action,
        },
      ]);
    return { suite, action, memberEvent, deadlineEvent };
  };

  beforeAll(async () => {
    process.env.SEND_DEV_NOTIFS = "1";
    ctx = await createTestApp([]);
    stubExpoClient(ctx);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("sends ordinary copy once, with no experiment arm or in-app entry", async () => {
    await ctx.dataSource.getRepository(User).update(ctx.testUserId, {
      turnedOffAllNotifs: false,
      emailNotifsForActions: false,
      textNotifsForActions: true,
      pushNotifsForActions: false,
      phoneNumber: "+14155550100",
    });
    await ctx.dataSource.getRepository(ContractEvent).save({
      user: { id: ctx.testUserId },
      type: ContractEventType.SIGNED,
      date: ago({ days: 120 }),
      automatic: false,
      contractId: ctx.defaultContractId,
    });
    for (let week = 5; week >= 1; week--) {
      const { action } = await createSuite({
        name: `Week -${week}`,
        deadline: ago({ days: 7 * week }),
      });
      await ctx.dataSource.getRepository(ActionActivity).save({
        actionId: action.id,
        userId: ctx.testUserId,
        type: ActionActivityType.USER_COMPLETED,
      });
    }
    const target = await createSuite({
      name: "Current week",
      deadline: new Date(
        Date.now() +
          milliseconds({ seconds: SEND_BEFORE_DEADLINE_SECONDS }) -
          milliseconds({ minutes: 5 }),
      ),
    });
    await ctx.dataSource.getRepository(ReminderGroup).save({
      name: "Two Day Range",
      memberActionEvent: target.memberEvent,
      deadlineEvent: target.deadlineEvent,
      actionSuite: target.suite,
      timingMode: ReminderGroupTimingMode.FromDeadline,
      sendAtSecondsFromDeadline: SEND_BEFORE_DEADLINE_SECONDS,
      cohortType: ReminderCohortType.AllUncompleted,
      emailSubject: "Ordinary subject",
      emailMessage: "Ordinary body",
      textMessage: "You have #{n} Alliance task#{s} left (#{link})",
      pushMessage: "You have #{n} Alliance task#{s} left",
      useSuiteTaskCount: true,
      excludeOptionalActions: false,
      allSent: false,
    });
    const worker = ctx.app.get(ActionEventNotifWorker);

    for (let run = 0; run < 2; run++) {
      await saveLiveCohortDecisions(ctx);
      await worker.dispatchDueNotifs();
    }

    const reminders = await ctx.dataSource
      .getRepository(ActionEventNotif)
      .find({ relations: { mms: true, notification: true } });
    expect(reminders).toHaveLength(1);
    expect(reminders[0]).toMatchObject({ sent: true, notification: null });
    expect(reminders[0].mms?.body).toMatch(/^You have 1 Alliance task left \(/);
    expect(
      await ctx.dataSource.getRepository(ExperimentAssignment).count(),
    ).toBe(0);
    expect(await ctx.dataSource.getRepository(Notification).count()).toBe(0);
  });
});
