import { ActionActivityType } from "@alliance/common/actionActivity";
import { milliseconds } from "date-fns";
import { secondsInHour } from "date-fns/constants";
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
import { MailService } from "src/mail/mail.service";
import { ActionEventNotifWorker } from "src/notifs/action-event-notif.worker";
import {
  ActionEventNotif,
  ReminderSocialProofOutcome,
} from "src/notifs/entities/action-event-notif.entity";
import {
  Experiment,
  ExperimentArm,
  ExperimentAssignment,
} from "src/notifs/entities/experiment-assignment.entity";
import { findSocialProofCandidates } from "src/notifs/reminder-social-proof";
import {
  ContractEvent,
  ContractEventType,
} from "src/user/entities/contract-event.entity";
import { Friend, FriendStatus } from "src/user/entities/friend.entity";
import { UserDevice } from "src/user/entities/user-device.entity";
import { ReferralSource, User } from "src/user/entities/user.entity";
import type { Repository } from "typeorm";
import { saveLiveCohortDecisions } from "./cohort-decision-fixtures";
import { createTestApp, stubExpoClient, TestContext } from "./e2e-test-utils";

describe("reminder social proof (e2e)", () => {
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
  let friendRepo: Repository<Friend>;
  let contractEventRepo: Repository<ContractEvent>;
  let memberCount = 0;

  const createMember = (overrides: Partial<User> = {}) =>
    userRepo.save(
      userRepo.create({
        email: `member${++memberCount}@example.com`,
        password: "pass",
        name: `Member ${memberCount}`,
        referralSource: ReferralSource.None,
        ...overrides,
      }),
    );

  const befriend = (
    requester: User | number,
    addressee: User | number,
    status = FriendStatus.Accepted,
  ) =>
    friendRepo.save(
      friendRepo.create({
        requester: {
          id: typeof requester === "number" ? requester : requester.id,
        },
        addressee: {
          id: typeof addressee === "number" ? addressee : addressee.id,
        },
        status,
      }),
    );

  const record = (
    user: User | number,
    action: Action,
    type = ActionActivityType.USER_COMPLETED,
  ) =>
    activityRepo.save(
      activityRepo.create({
        actionId: action.id,
        userId: typeof user === "number" ? user : user.id,
        type,
      }),
    );

  const setArm = (arm: ExperimentArm) =>
    armRepo.save(
      armRepo.create({
        userId: ctx.testUserId,
        experiment: Experiment.ReminderSocialProof,
        arm,
      }),
    );

  /** Due in 2h55m, so a three-hour reminder fell due five minutes ago. */
  const createSuite = async (actionNames: string[]) => {
    const suite = await suiteRepo.save(suiteRepo.create({ name: "Week" }));
    const deadline = new Date(
      Date.now() + milliseconds({ hours: 3, minutes: -5 }),
    );
    const actions: Action[] = [];
    let memberEvent: ActionEvent | undefined;
    let deadlineEvent: ActionEvent | undefined;
    for (const name of actionNames) {
      const action = await actionRepo.save(
        actionRepo.create({
          name,
          category: [],
          body: "Body",
          shortDescription: "Short",
          suite,
          cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
        }),
      );
      const [member, due] = await eventRepo.save([
        eventRepo.create({
          title: `${name} member`,
          description: "Member phase",
          newStatus: ActionStatus.MemberAction,
          date: new Date(Date.now() - milliseconds({ days: 1 })),
          action,
        }),
        eventRepo.create({
          title: `${name} deadline`,
          description: "Office phase",
          newStatus: ActionStatus.OfficeAction,
          date: deadline,
          action,
        }),
      ]);
      memberEvent ??= member;
      deadlineEvent ??= due;
      actions.push(action);
    }
    return {
      suite,
      actions,
      memberEvent: memberEvent!,
      deadlineEvent: deadlineEvent!,
    };
  };

  const createGroup = (
    created: Awaited<ReturnType<typeof createSuite>>,
    sendAtSecondsFromDeadline = 3 * secondsInHour,
  ) =>
    groupRepo.save(
      groupRepo.create({
        name: "Any name",
        memberActionEvent: created.memberEvent,
        deadlineEvent: created.deadlineEvent,
        actionSuite: created.suite,
        timingMode: ReminderGroupTimingMode.FromDeadline,
        sendAtSecondsFromDeadline,
        cohortType: ReminderCohortType.AllUncompleted,
        emailSubject: "Custom subject",
        emailMessage: "Custom email",
        textMessage: "Custom text",
        pushMessage: "Custom push",
        useSuiteTaskCount: true,
        excludeOptionalActions: true,
        allSent: false,
      }),
    );

  const dispatch = async () => {
    await saveLiveCohortDecisions(ctx);
    await worker.dispatchDueNotifs();
  };

  const findReminder = async () => {
    const [notif, ...others] = await notifRepo.find({
      relations: { mms: true, pushes: true },
    });
    expect(others).toHaveLength(0);
    return notif;
  };

  const variantArm = () =>
    armRepo.findOneByOrFail({
      userId: ctx.testUserId,
      experiment: Experiment.ReminderSocialProof,
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
    friendRepo = ctx.dataSource.getRepository(Friend);
    contractEventRepo = ctx.dataSource.getRepository(ContractEvent);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    for (const table of [
      "message_tracking",
      "push",
      "action_event_notif",
      "experiment_assignment",
      "reminder_group",
      "action_activity",
      "action_event",
      "action",
      "action_suite",
      "friend",
      "user_device",
    ]) {
      await ctx.dataSource.query(`DELETE FROM ${table}`);
    }
    await ctx.dataSource.query(`DELETE FROM "user" WHERE email LIKE 'member%'`);
    await userRepo.update(ctx.testUserId, {
      emailByDefault: false,
      textByDefault: true,
      pushByDefault: false,
      phoneNumber: "+14155550100",
    });
    await contractEventRepo.delete({ user: { id: ctx.testUserId } });
    await contractEventRepo.save(
      contractEventRepo.create({
        user: { id: ctx.testUserId },
        type: ContractEventType.SIGNED,
        date: new Date(Date.now() - milliseconds({ days: 60 })),
        automatic: false,
        contractId: ctx.defaultContractId,
      }),
    );
  });

  it("names two friends in the push and text, and keeps the group's email", async () => {
    await userRepo.update(ctx.testUserId, {
      pushByDefault: true,
      emailByDefault: true,
    });
    const deviceRepo = ctx.dataSource.getRepository(UserDevice);
    await deviceRepo.save(
      deviceRepo.create({
        user: { id: ctx.testUserId },
        deviceType: "iOS",
        expoPushToken: "ExponentPushToken[social_proof]",
      }),
    );
    const sendEmail = jest.spyOn(
      ctx.app.get(MailService),
      "sendActionEventNotificationEmail",
    );
    await setArm(ExperimentArm.Variant);
    const created = await createSuite(["Only task"]);
    const friendA = await createMember({ name: "Ada Friend" });
    const friendB = await createMember({ name: "Bea Friend" });
    const stranger = await createMember({ name: "Cy Stranger" });
    await befriend(friendA, ctx.testUserId);
    await befriend(ctx.testUserId, friendB);
    for (const member of [friendA, friendB, stranger]) {
      await record(member, created.actions[0]);
    }
    await createGroup(created);

    try {
      await dispatch();
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Custom subject",
          message: "Custom email",
        }),
      );
    } finally {
      sendEmail.mockRestore();
    }

    const notif = await findReminder();
    expect(notif.socialProofOutcome).toBe(ReminderSocialProofOutcome.NamesV1);
    expect(notif.socialProofActionIds).toEqual([created.actions[0].id]);
    expect(new Set(notif.socialProofUserIds)).toEqual(
      new Set([friendA.id, friendB.id]),
    );
    const names = notif
      .socialProofUserIds!.map((id) =>
        id === friendA.id ? "Ada Friend" : "Bea Friend",
      )
      .join(" and ");
    expect(notif.pushes?.[0].body).toMatch(
      new RegExp(
        `^.+ left for 1 task\\. ${names} have already completed it\\.$`,
      ),
    );
    expect(notif.mms?.body).toMatch(
      new RegExp(
        `^You have .+ left to complete 1 Alliance task\\. ${names} have already completed it\\. \\S+/tasks\\?cid=\\S+$`,
      ),
    );
  });

  it("pluralizes and counts every task in the reminder", async () => {
    await setArm(ExperimentArm.Variant);
    const created = await createSuite(["First task", "Second task"]);
    const memberA = await createMember({ name: "Ada Done" });
    const memberB = await createMember({ name: "Bea Done" });
    for (const member of [memberA, memberB]) {
      for (const action of created.actions) await record(member, action);
    }
    await createGroup(created);

    await dispatch();

    const notif = await findReminder();
    expect(notif.socialProofActionIds?.sort()).toEqual(
      created.actions.map((action) => action.id).sort(),
    );
    expect(notif.mms?.body).toMatch(
      /^You have .+ left to complete 2 Alliance tasks\. (Ada Done and Bea Done|Bea Done and Ada Done) have already completed them\. \S+\/tasks\?cid=\S+$/,
    );
  });

  it("qualifies completers on the tasks left after optional ones are dropped", async () => {
    await setArm(ExperimentArm.Variant);
    const created = await createSuite(["Required task", "Optional task"]);
    const [required, optional] = created.actions;
    await actionRepo.update(optional.id, { optional: true });
    for (const member of [await createMember(), await createMember()]) {
      await record(member, required);
    }
    await createGroup(created);

    await dispatch();

    const notif = await findReminder();
    expect(notif.socialProofOutcome).toBe(ReminderSocialProofOutcome.NamesV1);
    expect(notif.socialProofActionIds).toEqual([required.id]);
    expect(notif.mms?.body).toMatch(/ 1 Alliance task\. /);
  });

  it("falls back to the group's copy when fewer than two qualify, keeping the arm", async () => {
    await setArm(ExperimentArm.Variant);
    const created = await createSuite(["Only task"]);
    await record(await createMember(), created.actions[0]);
    await createGroup(created);

    await dispatch();

    const notif = await findReminder();
    expect(notif.socialProofOutcome).toBe(
      ReminderSocialProofOutcome.FallbackTooFewCompleters,
    );
    expect(notif.socialProofUserIds).toBeNull();
    expect(notif.mms?.body).toBe("Custom text");
    expect((await variantArm()).arm).toBe(ExperimentArm.Variant);
  });

  it("falls back to the group's copy when the lookup fails", async () => {
    await setArm(ExperimentArm.Variant);
    const created = await createSuite(["Only task"]);
    for (const member of [await createMember(), await createMember()]) {
      await record(member, created.actions[0]);
    }
    await createGroup(created);
    const manager = ctx.dataSource.manager;
    const query = manager.query.bind(manager);
    const lookup = jest
      .spyOn(manager, "query")
      .mockImplementation((sql: string, parameters?: unknown[]) =>
        sql.includes('AS "isFriend"')
          ? Promise.reject(new Error("lookup down"))
          : query(sql, parameters),
      );

    try {
      await dispatch();
    } finally {
      lookup.mockRestore();
    }

    const notif = await findReminder();
    expect(notif.socialProofOutcome).toBe(
      ReminderSocialProofOutcome.FallbackLookupFailed,
    );
    expect(notif.mms?.body).toBe("Custom text");
    expect((await variantArm()).arm).toBe(ExperimentArm.Variant);
  });

  it("looks up completers once for a reminder left unsent", async () => {
    await setArm(ExperimentArm.Variant);
    await userRepo.update(ctx.testUserId, {
      textByDefault: false,
      pushByDefault: true,
    });
    const created = await createSuite(["Only task"]);
    for (const member of [await createMember(), await createMember()]) {
      await record(member, created.actions[0]);
    }
    await createGroup(created);
    const lookup = jest.spyOn(ctx.dataSource.manager, "query");

    let lookups: number;
    try {
      await dispatch();
      await dispatch();
      lookups = lookup.mock.calls.filter(([sql]) =>
        sql.includes('AS "isFriend"'),
      ).length;
    } finally {
      lookup.mockRestore();
    }

    expect(lookups).toBe(1);
    const notif = await findReminder();
    expect(notif.sent).toBe(false);
    expect(notif.socialProofOutcome).toBe(ReminderSocialProofOutcome.NamesV1);
  });

  it("claims nothing when the arm draw fails, so the next tick sends", async () => {
    const created = await createSuite(["Only task"]);
    await createGroup(created);
    const manager = ctx.dataSource.manager;
    const find = manager.find.bind(manager);
    const draw = jest
      .spyOn(manager, "find")
      .mockImplementation((entity, options) =>
        entity === ExperimentAssignment
          ? Promise.reject(new Error("arm down"))
          : find(entity, options),
      );

    try {
      await expect(dispatch()).rejects.toThrow("arm down");
    } finally {
      draw.mockRestore();
    }
    expect(await notifRepo.count()).toBe(0);

    await dispatch();

    const notif = await findReminder();
    expect(notif.sent).toBe(true);
    expect(notif.socialProofOutcome).not.toBeNull();
  });

  it("leaves a member with push and text off outside the experiment", async () => {
    await userRepo.update(ctx.testUserId, {
      textByDefault: false,
      emailByDefault: true,
    });
    const created = await createSuite(["Only task"]);
    for (const member of [await createMember(), await createMember()]) {
      await record(member, created.actions[0]);
    }
    await createGroup(created);

    await dispatch();

    const notif = await findReminder();
    expect(notif).toMatchObject({
      socialProofOutcome: null,
      socialProofUserIds: null,
      socialProofActionIds: null,
    });
    expect(
      await armRepo.findOneBy({
        userId: ctx.testUserId,
        experiment: Experiment.ReminderSocialProof,
      }),
    ).toBeNull();
  });

  it("sends the control arm the group's copy and records the counted tasks", async () => {
    await setArm(ExperimentArm.Control);
    const created = await createSuite(["Only task"]);
    for (const member of [await createMember(), await createMember()]) {
      await record(member, created.actions[0]);
    }
    await createGroup(created);

    await dispatch();

    const notif = await findReminder();
    expect(notif).toMatchObject({
      socialProofOutcome: ReminderSocialProofOutcome.Control,
      socialProofUserIds: null,
      socialProofActionIds: [created.actions[0].id],
    });
    expect(notif.mms?.body).toBe("Custom text");
  });

  it("draws an arm for a member without one", async () => {
    const created = await createSuite(["Only task"]);
    await createGroup(created);

    await dispatch();

    const notif = await findReminder();
    const { arm } = await variantArm();
    expect(notif.socialProofOutcome).toBe(
      arm === ExperimentArm.Control
        ? ReminderSocialProofOutcome.Control
        : ReminderSocialProofOutcome.FallbackTooFewCompleters,
    );
  });

  it("leaves reminders at other timings outside the experiment", async () => {
    const created = await createSuite(["Only task"]);
    await groupRepo.update((await createGroup(created)).id, {
      sendAtSecondsFromDeadline: 3 * secondsInHour - 60,
    });

    await dispatch();

    const notif = await findReminder();
    expect(notif.socialProofOutcome).toBeNull();
    expect(notif.socialProofActionIds).toBeNull();
    expect(await armRepo.count()).toBe(0);
  });

  describe("findSocialProofCandidates", () => {
    const find = (actionIds: number[]) =>
      findSocialProofCandidates(ctx.dataSource.manager, {
        recipientId: ctx.testUserId,
        actionIds,
      });

    it("keeps only members whose latest activity completes every task", async () => {
      const { actions } = await createSuite(["First", "Second"]);
      const [first, second] = actions;
      const both = await createMember();
      const firstOnly = await createMember();
      const secondOnly = await createMember();
      const withdrew = await createMember();
      const recompleted = await createMember();
      const unrelated = await createMember();
      for (const member of [both, recompleted]) {
        await record(member, first);
        await record(member, second);
      }
      await record(firstOnly, first);
      await record(secondOnly, second);
      await record(withdrew, first);
      await record(withdrew, second);
      await record(withdrew, second, ActionActivityType.USER_WONT_COMPLETE);
      await record(recompleted, second, ActionActivityType.USER_WONT_COMPLETE);
      await record(recompleted, second);
      const { actions: otherActions } = await createSuite(["Elsewhere"]);
      await record(unrelated, otherActions[0]);
      await record(ctx.testUserId, first);
      await record(ctx.testUserId, second);

      const candidates = await find([first.id, second.id]);

      expect(candidates.map((candidate) => candidate.id).sort()).toEqual(
        [both.id, recompleted.id].sort(),
      );
    });

    it("excludes anonymous, deleted, and unnamed members and keeps same-named ones apart", async () => {
      const { actions } = await createSuite(["Only"]);
      const twinA = await createMember({ name: "Sam Same" });
      const twinB = await createMember({ name: "Sam Same" });
      const paused = await createMember();
      await contractEventRepo.save(
        [ContractEventType.SIGNED, ContractEventType.SUSPENDED].map((type) =>
          contractEventRepo.create({
            user: { id: paused.id },
            type,
            date: new Date(),
            automatic: false,
            contractId: ctx.defaultContractId,
          }),
        ),
      );
      const anonymous = await createMember({ anonymous: true });
      const unnamed = await createMember({ name: "  " });
      const deleted = await createMember();
      for (const member of [
        twinA,
        twinB,
        paused,
        anonymous,
        unnamed,
        deleted,
      ]) {
        await record(member, actions[0]);
      }
      await userRepo.softDelete(deleted.id);

      const candidates = await find([actions[0].id]);

      expect(candidates.map((candidate) => candidate.id).sort()).toEqual(
        [twinA.id, twinB.id, paused.id].sort(),
      );
    });

    it("counts only live accepted friendships, in either direction", async () => {
      const { actions } = await createSuite(["Only"]);
      const asRequester = await createMember();
      const asAddressee = await createMember();
      const pending = await createMember();
      const declined = await createMember();
      const removed = await createMember();
      await befriend(asRequester, ctx.testUserId);
      await befriend(ctx.testUserId, asAddressee);
      await befriend(pending, ctx.testUserId, FriendStatus.Pending);
      await befriend(declined, ctx.testUserId, FriendStatus.Declined);
      await friendRepo.softDelete((await befriend(removed, ctx.testUserId)).id);
      for (const member of [
        asRequester,
        asAddressee,
        pending,
        declined,
        removed,
      ]) {
        await record(member, actions[0]);
      }

      const candidates = await find([actions[0].id]);

      expect(
        Object.fromEntries(
          candidates.map((candidate) => [candidate.id, candidate.isFriend]),
        ),
      ).toEqual({
        [asRequester.id]: true,
        [asAddressee.id]: true,
        [pending.id]: false,
        [declined.id]: false,
        [removed.id]: false,
      });
    });
  });
});
