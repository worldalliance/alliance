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
  Experiment,
  ExperimentArm,
  ExperimentAssignment,
} from "src/notifs/entities/experiment-assignment.entity";
import { NotificationCategory } from "src/notifs/entities/notification.entity";
import {
  ContractEvent,
  ContractEventType,
} from "src/user/entities/contract-event.entity";
import { UserDevice } from "src/user/entities/user-device.entity";
import { User } from "src/user/entities/user.entity";
import request from "supertest";
import type { Repository } from "typeorm";
import { saveLiveCohortDecisions } from "./cohort-decision-fixtures";
import { createTestApp, stubExpoClient, TestContext } from "./e2e-test-utils";

describe("missed-suite notices (e2e)", () => {
  let ctx: TestContext;
  let worker: ActionEventNotifWorker;
  let actionRepo: Repository<Action>;
  let eventRepo: Repository<ActionEvent>;
  let suiteRepo: Repository<ActionSuite>;
  let groupRepo: Repository<ReminderGroup>;
  let notifRepo: Repository<ActionEventNotif>;
  let activityRepo: Repository<ActionActivity>;
  let armRepo: Repository<ExperimentAssignment>;
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

  const setArm = (arm: ExperimentArm) =>
    armRepo.save(
      armRepo.create({
        userId: ctx.testUserId,
        experiment: Experiment.MissedSuiteFirstNotice,
        arm,
      }),
    );

  const dispatch = async () => {
    await saveLiveCohortDecisions(ctx);
    await worker.dispatchDueNotifs();
  };

  const findNotices = () =>
    notifRepo.find({
      where: { type: ActionEventNotifType.MissedDeadline },
      relations: { actionSuite: true, notification: true, mms: true },
    });

  beforeAll(async () => {
    process.env.SEND_DEV_NOTIFS = "1";
    ctx = await createTestApp([]);
    stubExpoClient(ctx);
    worker = ctx.app.get(ActionEventNotifWorker);
    actionRepo = ctx.dataSource.getRepository(Action);
    eventRepo = ctx.dataSource.getRepository(ActionEvent);
    suiteRepo = ctx.dataSource.getRepository(ActionSuite);
    groupRepo = ctx.dataSource.getRepository(ReminderGroup);
    notifRepo = ctx.dataSource.getRepository(ActionEventNotif);
    activityRepo = ctx.dataSource.getRepository(ActionActivity);
    armRepo = ctx.dataSource.getRepository(ExperimentAssignment);
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
      "experiment_assignment",
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
      pushNotifsForActions: false,
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

  it("sends one variant notice per suite naming only the missed tasks", async () => {
    await setArm(ExperimentArm.Variant);
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
    expect(notice.missedSuiteCopy).toBe(
      MissedSuiteNoticeCopy.FirstMissReportV1,
    );
    expect(notice.notifiedActionIds).toEqual([closed.actions[1].id]);
    expect(notice.notification).toMatchObject({
      category: NotificationCategory.ActionEvent,
      message: "The deadline for Missed task passed without your completion.",
      webAppLocation: "/tasks",
      shouldPush: false,
    });
    expect(notice.mms?.body).toMatch(
      /^The deadline for Missed task passed without your completion\. If you did complete it, contact us\. \S+\/tasks/,
    );
  });

  it("totals the missed tasks' time estimates for #{tasktime}", async () => {
    await setArm(ExperimentArm.Control);
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

  it("sends the control group its configured copy and keeps its arm", async () => {
    await setArm(ExperimentArm.Control);
    const closed = await createClosedSuite("Week", ago({ minutes: 10 }), [
      "Missed task",
    ]);
    await createMissedSuiteGroup(closed);

    await dispatch();

    const [notice] = await findNotices();
    expect(notice.missedSuiteCopy).toBe(MissedSuiteNoticeCopy.FirstMissControl);
    expect(notice.notification?.message).toBe("Control push");
    expect(notice.mms?.body).toBe("Control text");
    expect(
      await armRepo.findOneByOrFail({
        userId: ctx.testUserId,
        experiment: Experiment.MissedSuiteFirstNotice,
      }),
    ).toMatchObject({ arm: ExperimentArm.Control });
  });

  it("draws an arm once and reuses it for later first misses", async () => {
    const first = await createClosedSuite("First", ago({ hours: 2 }), [
      "First missed task",
    ]);
    const satisfied = await createClosedSuite("Between", ago({ hours: 1 }), [
      "Done task",
    ]);
    await record(satisfied.actions[0], ActionActivityType.USER_COMPLETED);
    const later = await createClosedSuite("Later", ago({ minutes: 10 }), [
      "Later missed task",
    ]);
    await createMissedSuiteGroup(first);
    await createMissedSuiteGroup(later);

    await dispatch();

    const [assignment, ...otherArms] = await armRepo.find();
    expect(otherArms).toHaveLength(0);
    const notices = await findNotices();
    expect(notices.map((notice) => notice.missNumber)).toEqual([1, 1]);
    expect(new Set(notices.map((notice) => notice.missedSuiteCopy))).toEqual(
      new Set([
        assignment.arm === ExperimentArm.Control
          ? MissedSuiteNoticeCopy.FirstMissControl
          : MissedSuiteNoticeCopy.FirstMissReportV1,
      ]),
    );
  });

  it("names dismissed tasks and pluralizes for several missed tasks", async () => {
    await setArm(ExperimentArm.Variant);
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
    expect(notice.mms?.body).toMatch(
      /^The deadline for (First task, Second task|Second task, First task) passed without your completion\. If you did complete them, contact us\./,
    );
  });

  it("gives the in-app entry to a member with every channel off", async () => {
    await userRepo.update(ctx.testUserId, { turnedOffAllNotifs: true });
    await setArm(ExperimentArm.Control);
    const closed = await createClosedSuite("Week", ago({ minutes: 10 }), [
      "Missed task",
    ]);
    const group = await createMissedSuiteGroup(closed);

    await dispatch();

    const [notice] = await findNotices();
    expect(notice).toMatchObject({ sent: true, mms: null });
    expect(notice.notification?.message).toBe("Control push");

    const res = await request(ctx.app.getHttpServer())
      .get(`/actions/sentNotifsForGroup/${group.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);
    expect(res.body).toEqual([
      expect.objectContaining({ notificationId: notice.notification?.id }),
    ]);
  });

  it("links the push to the in-app entry", async () => {
    await userRepo.update(ctx.testUserId, { pushNotifsForActions: true });
    const deviceRepo = ctx.dataSource.getRepository(UserDevice);
    await deviceRepo.save(
      deviceRepo.create({
        user: { id: ctx.testUserId },
        deviceType: "iOS",
        expoPushToken: `ExponentPushToken[missed_suite_${Date.now()}]`,
      }),
    );
    await setArm(ExperimentArm.Control);
    const closed = await createClosedSuite("Week", ago({ minutes: 10 }), [
      "Missed task",
    ]);
    await createMissedSuiteGroup(closed);

    try {
      await dispatch();

      const [notice] = await notifRepo.find({
        where: { type: ActionEventNotifType.MissedDeadline },
        relations: { notification: true, pushes: { notification: true } },
      });
      expect(notice.pushes).toHaveLength(1);
      expect(notice.pushes?.[0].notification?.id).toBe(notice.notification?.id);
    } finally {
      await deviceRepo.delete({ user: { id: ctx.testUserId } });
    }
  });

  it("skips the in-app entry when the group's push copy is blank", async () => {
    await setArm(ExperimentArm.Control);
    const closed = await createClosedSuite("Week", ago({ minutes: 10 }), [
      "Missed task",
    ]);
    const group = await createMissedSuiteGroup(closed);
    await groupRepo.update(group.id, { pushMessage: "" });

    await dispatch();

    const [notice] = await findNotices();
    expect(notice.notification).toBeNull();
    expect(notice.mms?.body).toBe("Control text");
  });

  it("sends everyone the second-miss copy on a second consecutive miss", async () => {
    await setArm(ExperimentArm.Control);
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
    expect(notice.notification?.message).toBe(
      "You have missed two consecutive weeks. One more pauses your agreement automatically.",
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
