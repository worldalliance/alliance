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
  StreakRecognitionCopy,
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
import { User } from "src/user/entities/user.entity";
import request from "supertest";
import type { Repository } from "typeorm";
import { saveLiveCohortDecisions } from "./cohort-decision-fixtures";
import { createTestApp, stubExpoClient, TestContext } from "./e2e-test-utils";

const RECOGNITION = (count: number) =>
  `You have completed ${count} weeks of tasks in a row!`;
const SEND_BEFORE_DEADLINE_SECONDS = 36 * 60 * 60;

describe("streak recognition (e2e)", () => {
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

  type CreatedSuite = {
    suite: ActionSuite;
    actions: Action[];
    memberEvent: ActionEvent;
    deadlineEvent: ActionEvent;
  };

  const createSuite = async (params: {
    name: string;
    deadline: Date;
    actionNames: string[];
    onboarding?: boolean;
  }): Promise<CreatedSuite> => {
    const { name, deadline, actionNames, onboarding = false } = params;
    const suite = await suiteRepo.save(suiteRepo.create({ name, onboarding }));
    const created: {
      action: Action;
      memberEvent: ActionEvent;
      deadlineEvent: ActionEvent;
    }[] = [];
    for (const actionName of actionNames) {
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
      created.push({ action, memberEvent, deadlineEvent });
    }
    return {
      suite,
      actions: created.map(({ action }) => action),
      memberEvent: created[0].memberEvent,
      deadlineEvent: created[0].deadlineEvent,
    };
  };

  const record = (action: Action, type: ActionActivityType) =>
    activityRepo.save(
      activityRepo.create({
        actionId: action.id,
        userId: ctx.testUserId,
        type,
      }),
    );

  const createCompletedSuites = async (count: number) => {
    const suites: CreatedSuite[] = [];
    for (let week = count; week >= 1; week--) {
      const created = await createSuite({
        name: `Week -${week}`,
        deadline: ago({ days: 7 * week }),
        actionNames: [`Task -${week}`],
      });
      await record(created.actions[0], ActionActivityType.USER_COMPLETED);
      suites.push(created);
    }
    return suites;
  };

  const createTargetSuite = (name = "Current week") =>
    createSuite({
      name,
      deadline: new Date(
        Date.now() +
          milliseconds({ seconds: SEND_BEFORE_DEADLINE_SECONDS }) -
          milliseconds({ minutes: 5 }),
      ),
      actionNames: [`${name} task`],
    });

  const createReminderGroup = (
    target: CreatedSuite,
    { streakRecognition = true, index = 0 } = {},
  ) =>
    groupRepo.save(
      groupRepo.create({
        name: `24-48h reminder ${target.suite.name} ${index}`,
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
        streakRecognition,
        allSent: false,
      }),
    );

  const setArm = (arm: ExperimentArm) =>
    armRepo.save(
      armRepo.create({
        userId: ctx.testUserId,
        experiment: Experiment.StreakRecognition,
        arm,
      }),
    );

  const dispatch = async () => {
    await saveLiveCohortDecisions(ctx);
    await worker.dispatchDueNotifs();
  };

  const findReminders = () =>
    notifRepo.find({
      relations: { actionSuite: true, notification: true, mms: true },
      order: { id: "ASC" },
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
      name: "Streak Tester",
    });
    await contractEventRepo.delete({ user: { id: ctx.testUserId } });
    await contractEventRepo.save(
      contractEventRepo.create({
        user: { id: ctx.testUserId },
        type: ContractEventType.SIGNED,
        date: ago({ days: 120 }),
        automatic: false,
        contractId: ctx.defaultContractId,
      }),
    );
  });

  it("recognizes a variant member's milestone on push, SMS, and a new in-app entry", async () => {
    await setArm(ExperimentArm.Variant);
    const [first] = await createCompletedSuites(2);
    const target = await createTargetSuite();
    await createReminderGroup(target);

    await dispatch();

    const [reminder, ...rest] = await findReminders();
    expect(rest).toHaveLength(0);
    expect(reminder).toMatchObject({
      sent: true,
      streakCount: 2,
      streakRunSuiteId: first.suite.id,
      streakRecognitionCopy: StreakRecognitionCopy.RecognitionV1,
    });
    expect(reminder.actionSuite?.id).toBe(target.suite.id);
    expect(reminder.mms?.body).toMatch(
      new RegExp(
        `^${RECOGNITION(2)} You have 1 Alliance task left \\(\\S+/tasks\\S*\\)$`,
      ),
    );
    expect(reminder.notification).toMatchObject({
      category: NotificationCategory.ActionEvent,
      message: `${RECOGNITION(2)} You have 1 Alliance task left`,
      webAppLocation: "/tasks",
      shouldPush: false,
    });
  });

  it("sends the control arm ordinary copy with no in-app entry and records the milestone", async () => {
    await setArm(ExperimentArm.Control);
    await createCompletedSuites(3);
    const target = await createTargetSuite();
    await createReminderGroup(target);

    await dispatch();

    const [reminder] = await findReminders();
    expect(reminder).toMatchObject({
      streakCount: 3,
      streakRecognitionCopy: StreakRecognitionCopy.Control,
      notification: null,
    });
    expect(reminder.mms?.body).toMatch(/^You have 1 Alliance task left \(/);
  });

  it.each([1, 4])(
    "sends ordinary copy and records nothing at %i completed suites",
    async (count) => {
      await setArm(ExperimentArm.Variant);
      await createCompletedSuites(count);
      const target = await createTargetSuite();
      await createReminderGroup(target);

      await dispatch();

      const [reminder] = await findReminders();
      expect(reminder).toMatchObject({
        streakCount: null,
        streakRecognitionCopy: null,
        notification: null,
      });
      expect(reminder.mms?.body).toMatch(/^You have 1 Alliance task left \(/);
    },
  );

  it("sends ordinary copy and draws no arm from a group without the flag", async () => {
    await createCompletedSuites(2);
    const target = await createTargetSuite();
    await createReminderGroup(target, { streakRecognition: false });

    await dispatch();

    const [reminder] = await findReminders();
    expect(reminder.streakCount).toBeNull();
    expect(reminder.mms?.body).toMatch(/^You have 1 Alliance task left \(/);
    expect(await armRepo.count()).toBe(0);
  });

  it("recognizes a milestone once across sibling groups, reruns, and later suites", async () => {
    await setArm(ExperimentArm.Variant);
    await createCompletedSuites(2);
    const target = await createTargetSuite();
    await createReminderGroup(target, { index: 0 });
    await createReminderGroup(target, { index: 1 });
    const nextTarget = await createTargetSuite("Overlapping week");
    await createReminderGroup(nextTarget);

    await dispatch();
    await dispatch();

    const reminders = await findReminders();
    expect(reminders).toHaveLength(3);
    const recognized = reminders.filter(
      (reminder) => reminder.streakCount !== null,
    );
    expect(recognized).toHaveLength(1);
    expect(
      reminders.filter((reminder) => reminder.notification !== null),
    ).toHaveLength(1);
    for (const reminder of reminders.filter((r) => r.streakCount === null)) {
      expect(reminder.mms?.body).toMatch(/^You have 1 Alliance task left \(/);
    }
  });

  it("recognizes the same milestone again in a new run", async () => {
    await setArm(ExperimentArm.Variant);
    const [first, , missed, newRun] = await createCompletedSuites(5);
    await activityRepo.delete({ actionId: missed.actions[0].id });
    const earlier = await notifRepo.save(
      notifRepo.create({
        user: { id: ctx.testUserId },
        sent: true,
        notifiedActionIds: null,
        streakCount: 2,
        streakRunSuiteId: first.suite.id,
        streakRecognitionCopy: StreakRecognitionCopy.RecognitionV1,
      }),
    );
    const target = await createTargetSuite();
    await createReminderGroup(target);

    await dispatch();

    const [reminder] = (await findReminders()).filter(
      (notif) => notif.id !== earlier.id,
    );
    expect(reminder).toMatchObject({
      streakCount: 2,
      streakRunSuiteId: newRun.suite.id,
    });
    expect(reminder.notification).not.toBeNull();
  });

  it("counts a suite completed in part and withdrawn in part, and skips a fully withdrawn suite", async () => {
    await setArm(ExperimentArm.Variant);
    const mixed = await createSuite({
      name: "Mixed",
      deadline: ago({ days: 14 }),
      actionNames: ["Done", "Withdrawn"],
    });
    await record(mixed.actions[0], ActionActivityType.USER_COMPLETED);
    await record(mixed.actions[1], ActionActivityType.USER_WONT_COMPLETE);
    const withdrawn = await createSuite({
      name: "Withdrawn",
      deadline: ago({ days: 7 }),
      actionNames: ["Withdrawn only"],
    });
    await record(withdrawn.actions[0], ActionActivityType.USER_WONT_COMPLETE);
    const completed = await createSuite({
      name: "Completed",
      deadline: ago({ days: 3 }),
      actionNames: ["Completed task"],
    });
    await record(completed.actions[0], ActionActivityType.USER_COMPLETED);
    const target = await createTargetSuite();
    await createReminderGroup(target);

    await dispatch();

    const [reminder] = await findReminders();
    expect(reminder).toMatchObject({
      streakCount: 2,
      streakRunSuiteId: mixed.suite.id,
    });
  });

  it("does not count a suite whose completion the member later withdrew", async () => {
    await setArm(ExperimentArm.Variant);
    const [first] = await createCompletedSuites(2);
    const withdrawn = await createSuite({
      name: "Withdrawn after completing",
      deadline: ago({ days: 3 }),
      actionNames: ["Withdrawn task"],
    });
    await activityRepo.save([
      activityRepo.create({
        actionId: withdrawn.actions[0].id,
        userId: ctx.testUserId,
        type: ActionActivityType.USER_COMPLETED,
        createdAt: ago({ days: 5 }),
      }),
      activityRepo.create({
        actionId: withdrawn.actions[0].id,
        userId: ctx.testUserId,
        type: ActionActivityType.USER_WONT_COMPLETE,
        createdAt: ago({ days: 4 }),
      }),
    ]);
    const target = await createTargetSuite();
    await createReminderGroup(target);

    await dispatch();

    const [reminder] = await findReminders();
    expect(reminder).toMatchObject({
      streakCount: 2,
      streakRunSuiteId: first.suite.id,
    });
  });

  it("resets on a suite left incomplete, even when its task was dismissed", async () => {
    await setArm(ExperimentArm.Variant);
    await createCompletedSuites(2);
    const dismissed = await createSuite({
      name: "Dismissed",
      deadline: ago({ days: 3 }),
      actionNames: ["Dismissed task"],
    });
    await record(dismissed.actions[0], ActionActivityType.USER_DISMISSED);
    const target = await createTargetSuite();
    await createReminderGroup(target);

    await dispatch();

    const [reminder] = await findReminders();
    expect(reminder.streakCount).toBeNull();
  });

  it("skips the onboarding suite whatever its actions' flags", async () => {
    await setArm(ExperimentArm.Variant);
    const onboarding = await createSuite({
      name: "Onboarding",
      deadline: ago({ days: 14 }),
      actionNames: ["Introduce yourself"],
      onboarding: true,
    });
    await record(onboarding.actions[0], ActionActivityType.USER_COMPLETED);
    await createCompletedSuites(1);
    const target = await createTargetSuite();
    await createReminderGroup(target);

    await dispatch();

    const [reminder] = await findReminders();
    expect(reminder.streakCount).toBeNull();
  });

  it("starts a new streak when the member signs again", async () => {
    await setArm(ExperimentArm.Variant);
    await createCompletedSuites(3);
    await contractEventRepo.save(
      contractEventRepo.create({
        user: { id: ctx.testUserId },
        type: ContractEventType.SIGNED,
        date: ago({ days: 25 }),
        automatic: false,
        contractId: ctx.defaultContractId,
      }),
    );
    const target = await createTargetSuite();
    await createReminderGroup(target);

    await dispatch();

    const [reminder] = await findReminders();
    expect(reminder.streakCount).toBe(2);
  });

  it("creates the in-app entry for a variant member with every channel off", async () => {
    await userRepo.update(ctx.testUserId, { turnedOffAllNotifs: true });
    await setArm(ExperimentArm.Variant);
    await createCompletedSuites(2);
    const target = await createTargetSuite();
    await createReminderGroup(target);

    await dispatch();

    const [reminder] = await findReminders();
    expect(reminder).toMatchObject({ sent: true, mms: null, streakCount: 2 });
    expect(reminder.notification?.message).toBe(
      `${RECOGNITION(2)} You have 1 Alliance task left`,
    );
  });

  it("previews a flagged group without loading suite outcomes", async () => {
    await createCompletedSuites(2);
    const target = await createSuite({
      name: "Next week",
      deadline: new Date(Date.now() + milliseconds({ days: 5 })),
      actionNames: ["Next week task"],
    });
    const group = await createReminderGroup(target);
    await saveLiveCohortDecisions(ctx);
    const loadSuites = jest.spyOn(
      ctx.app.get(ActionsService),
      "findClosedSuiteOutcomes",
    );

    const preview = await request(ctx.app.getHttpServer())
      .get(`/actions/plansForGroup/${group.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);

    expect(preview.body).toHaveLength(1);
    expect(loadSuites).not.toHaveBeenCalled();
    loadSuites.mockRestore();
  });

  it("stores the flag an admin applies and keeps it through an edit that omits it", async () => {
    const target = await createTargetSuite();
    const body = {
      name: "24-48h reminder",
      timingMode: ReminderGroupTimingMode.WithinRelativeRange,
      relative_range_start_seconds_from_deadline: 48 * 60 * 60,
      relative_range_end_seconds_from_deadline: 24 * 60 * 60,
      cohortType: ReminderCohortType.AllUncompleted,
      emailSubject: "Ordinary subject",
      emailMessage: "Ordinary body",
      textMessage: "Ordinary text",
      pushMessage: "Ordinary push",
      suiteId: target.suite.id,
      useSuiteTaskCount: true,
      excludeOptionalActions: false,
      excludePreviouslyNotified: false,
    };
    const server = ctx.app.getHttpServer();
    const auth = `Bearer ${ctx.adminAccessToken}`;

    const ordinary = await request(server)
      .post(`/actions/events/${target.memberEvent.id}/createremindergroup`)
      .set("Authorization", auth)
      .send(body)
      .expect(201);
    expect(ordinary.body).toMatchObject({ streakRecognition: false });

    const created = await request(server)
      .post(`/actions/events/${target.memberEvent.id}/createremindergroup`)
      .set("Authorization", auth)
      .send({ ...body, streakRecognition: true })
      .expect(201);
    expect(created.body).toMatchObject({ streakRecognition: true });

    const edited = await request(server)
      .patch(`/actions/remindergroups/${(created.body as { id: number }).id}`)
      .set("Authorization", auth)
      .send({ ...body, name: "Renamed" })
      .expect(200);
    expect(edited.body).toMatchObject({
      name: "Renamed",
      streakRecognition: true,
    });

    await request(server)
      .patch(`/actions/remindergroups/${(created.body as { id: number }).id}`)
      .set("Authorization", auth)
      .send({
        ...body,
        cohortType: ReminderCohortType.GroupLeadsWithUncompleted,
      })
      .expect(400);
  });
});
