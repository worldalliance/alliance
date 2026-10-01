import { ActionActivityType } from "@alliance/common/actionActivity";
import { milliseconds } from "date-fns";
import { ActionsService } from "src/actions/actions.service";
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
import {
  ActionEventNotif,
  ActionEventNotifType,
  MissedSuiteNoticeCopy,
} from "src/notifs/entities/action-event-notif.entity";
import {
  ContractEvent,
  ContractEventType,
} from "src/user/entities/contract-event.entity";
import { User } from "src/user/entities/user.entity";
import type { Repository } from "typeorm";
import { saveLiveCohortDecisions } from "./cohort-decision-fixtures";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("missed-suite notices (e2e)", () => {
  let ctx: TestContext;
  let worker: ActionEventNotifWorker;
  let actionRepo: Repository<Action>;
  let eventRepo: Repository<ActionEvent>;
  let suiteRepo: Repository<ActionSuite>;
  let groupRepo: Repository<ReminderGroup>;
  let notifRepo: Repository<ActionEventNotif>;
  let activityRepo: Repository<ActionActivity>;
  let userRepo: Repository<User>;
  let contractEventRepo: Repository<ContractEvent>;

  const ago = (duration: Parameters<typeof milliseconds>[0]) =>
    new Date(Date.now() - milliseconds(duration));

  type ClosedSuite = {
    suite: ActionSuite;
    actions: Action[];
    memberEvent: ActionEvent;
    deadlineEvent: ActionEvent;
  };

  const createClosedSuite = async (
    name: string,
    deadline: Date,
    actionNames: string[],
  ): Promise<ClosedSuite> => {
    const suite = await suiteRepo.save(suiteRepo.create({ name }));
    const created = await Promise.all(
      actionNames.map(async (actionName) => {
        const action = await actionRepo.save(
          actionRepo.create({
            name: actionName,
            category: [],
            body: "Body",
            shortDescription: "Short",
            suite,
            cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
          }),
        );
        const [memberEvent, deadlineEvent] = await eventRepo.save([
          eventRepo.create({
            title: `${actionName} member`,
            description: "Member phase",
            newStatus: ActionStatus.MemberAction,
            date: new Date(deadline.getTime() - milliseconds({ days: 7 })),
            action,
          }),
          eventRepo.create({
            title: `${actionName} deadline`,
            description: "Office phase",
            newStatus: ActionStatus.OfficeAction,
            date: deadline,
            action,
          }),
        ]);
        return { action, memberEvent, deadlineEvent };
      }),
    );
    return {
      suite,
      actions: created.map(({ action }) => action),
      memberEvent: created[0].memberEvent,
      deadlineEvent: created[0].deadlineEvent,
    };
  };

  const createMissedSuiteGroup = (closed: ClosedSuite, index = 0) =>
    groupRepo.save(
      groupRepo.create({
        name: `Missed deadline ${closed.suite.name} ${index}`,
        memberActionEvent: closed.memberEvent,
        deadlineEvent: closed.deadlineEvent,
        actionSuite: closed.suite,
        timingMode: ReminderGroupTimingMode.FromDeadline,
        sendAtSecondsFromDeadline: 0,
        cohortType: ReminderCohortType.AllUncompleted,
        emailSubject: "You missed an Alliance task",
        emailMessage: "Hi #{firstname}\n#{missedactioncontext}",
        textMessage: "Control text",
        pushMessage: "Control push",
        useSuiteTaskCount: true,
        excludeOptionalActions: true,
        allSent: false,
      }),
    );

  const record = (action: Action, type: ActionActivityType) =>
    activityRepo.save(
      activityRepo.create({
        actionId: action.id,
        userId: ctx.testUserId,
        type,
      }),
    );

  const dispatch = async () => {
    await saveLiveCohortDecisions(ctx);
    await worker.dispatchDueNotifs();
  };

  const findNotices = () =>
    notifRepo.find({
      where: { type: ActionEventNotifType.MissedDeadline },
      relations: { actionSuite: true, mms: true },
    });

  beforeAll(async () => {
    process.env.SEND_DEV_NOTIFS = "1";
    ctx = await createTestApp([]);
    worker = ctx.app.get(ActionEventNotifWorker);
    actionRepo = ctx.dataSource.getRepository(Action);
    eventRepo = ctx.dataSource.getRepository(ActionEvent);
    suiteRepo = ctx.dataSource.getRepository(ActionSuite);
    groupRepo = ctx.dataSource.getRepository(ReminderGroup);
    notifRepo = ctx.dataSource.getRepository(ActionEventNotif);
    activityRepo = ctx.dataSource.getRepository(ActionActivity);
    userRepo = ctx.dataSource.getRepository(User);
    contractEventRepo = ctx.dataSource.getRepository(ContractEvent);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    for (const table of [
      "action_event_notif",
      "notification",
      "reminder_group",
      "action_activity",
      "action_event",
      "action",
      "action_suite",
    ]) {
      await ctx.dataSource.query(`DELETE FROM ${table}`);
    }
    await userRepo.update(ctx.testUserId, {
      turnedOffAllNotifs: false,
      emailNotifsForActions: false,
      textNotifsForActions: true,
      phoneNumber: "+14155550100",
      name: "Missed Tester",
    });
    await contractEventRepo.delete({ user: { id: ctx.testUserId } });
    await contractEventRepo.save(
      contractEventRepo.create({
        user: { id: ctx.testUserId },
        type: ContractEventType.SIGNED,
        date: ago({ days: 60 }),
        automatic: false,
        contractId: ctx.defaultContractId,
      }),
    );
  });

  it("sends one notice per suite naming only the missed tasks", async () => {
    const closed = await createClosedSuite("Week", ago({ minutes: 10 }), [
      "Done task",
      "Missed task",
    ]);
    await record(closed.actions[0], ActionActivityType.USER_COMPLETED);
    await createMissedSuiteGroup(closed, 0);
    await createMissedSuiteGroup(closed, 1);

    await dispatch();
    const loadSuites = jest.spyOn(
      ctx.app.get(ActionsService),
      "findClosedSuiteOutcomes",
    );
    await dispatch();
    expect(loadSuites).not.toHaveBeenCalled();
    loadSuites.mockRestore();

    const notices = await findNotices();
    expect(notices).toHaveLength(1);
    const [notice] = notices;
    expect(notice.actionSuite?.id).toBe(closed.suite.id);
    expect(notice.missNumber).toBe(1);
    expect(notice.missedSuiteCopy).toBe(MissedSuiteNoticeCopy.FirstMissControl);
    expect(notice.notifiedActionIds).toEqual([closed.actions[1].id]);
    expect(notice.mms?.body).toBe("Control text");
  });

  it("totals the missed tasks' time estimates for #{tasktime}", async () => {
    const closed = await createClosedSuite("Week", ago({ minutes: 10 }), [
      "First task",
      "Second task",
    ]);
    for (const [index, timeEstimate] of [15, 30].entries()) {
      await actionRepo.update(closed.actions[index].id, { timeEstimate });
    }
    const group = await createMissedSuiteGroup(closed);
    await groupRepo.update(group.id, { textMessage: "About #{tasktime}" });

    await dispatch();

    const [notice] = await findNotices();
    expect(notice.mms?.body).toBe("About 45 minutes");
  });

  it("names dismissed tasks", async () => {
    const closed = await createClosedSuite("Week", ago({ minutes: 10 }), [
      "First task",
      "Second task",
    ]);
    await record(closed.actions[1], ActionActivityType.USER_DISMISSED);
    await createMissedSuiteGroup(closed);

    await dispatch();

    const [notice] = await findNotices();
    expect(new Set(notice.notifiedActionIds)).toEqual(
      new Set(closed.actions.map((action) => action.id)),
    );
  });

  it("sends the second-miss copy on a second consecutive miss", async () => {
    await createClosedSuite("Earlier", ago({ days: 7 }), ["Earlier task"]);
    const closed = await createClosedSuite("Week", ago({ minutes: 10 }), [
      "Missed task",
    ]);
    await createMissedSuiteGroup(closed);

    await dispatch();

    const [notice] = await findNotices();
    expect(notice.missNumber).toBe(2);
    expect(notice.missedSuiteCopy).toBe(
      MissedSuiteNoticeCopy.SecondMissReportV1,
    );
    expect(notice.mms?.body).toMatch(
      /^You have missed two consecutive weeks of tasks\. /,
    );
  });

  it("waits for the suite to close before sending", async () => {
    const closed = await createClosedSuite("Week", ago({ minutes: 10 }), [
      "Missed task",
    ]);
    const later = await actionRepo.save(
      actionRepo.create({
        name: "Later task",
        category: [],
        body: "Body",
        shortDescription: "Short",
        suite: closed.suite,
        cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
      }),
    );
    const [, laterDeadline] = await eventRepo.save([
      eventRepo.create({
        title: "Later task member",
        description: "Member phase",
        newStatus: ActionStatus.MemberAction,
        date: ago({ days: 7 }),
        action: later,
      }),
      eventRepo.create({
        title: "Later task deadline",
        description: "Office phase",
        newStatus: ActionStatus.OfficeAction,
        date: new Date(Date.now() + milliseconds({ days: 1 })),
        action: later,
      }),
    ]);
    await createMissedSuiteGroup(closed);

    await dispatch();
    expect(await findNotices()).toHaveLength(0);

    await eventRepo.update(laterDeadline.id, { date: ago({ minutes: 5 }) });
    await dispatch();
    const notices = await findNotices();
    expect(notices.map((notice) => notice.missNumber)).toEqual([1]);
  });

  it("leaves a third consecutive miss to the suspension notice", async () => {
    await createClosedSuite("First", ago({ days: 14 }), ["First task"]);
    await createClosedSuite("Second", ago({ days: 7 }), ["Second task"]);
    const closed = await createClosedSuite("Week", ago({ minutes: 10 }), [
      "Missed task",
    ]);
    await createMissedSuiteGroup(closed);

    await dispatch();

    const [claim, ...rest] = await findNotices();
    expect(rest).toHaveLength(0);
    expect(claim).toMatchObject({
      sent: false,
      missNumber: 3,
      missedSuiteCopy: null,
      mms: null,
    });
  });

  it("counts a sent notice toward a later catch-up on the same event", async () => {
    const closed = await createClosedSuite("Week", ago({ minutes: 10 }), [
      "Missed task",
    ]);
    await createMissedSuiteGroup(closed);
    await dispatch();
    const catchUp = await createMissedSuiteGroup(closed, 1);
    await groupRepo.update(catchUp.id, {
      emailMessage: "Hi #{firstname}",
      textMessage: "Catch-up text",
      excludePreviouslyNotified: true,
    });

    await dispatch();

    expect(
      await notifRepo.countBy({
        reminderGroup: { id: catchUp.id },
        sent: true,
      }),
    ).toBe(0);
  });
});
