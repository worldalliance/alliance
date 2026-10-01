import { ActionActivityType } from "@alliance/common/actionActivity";
import { millisecondsInDay } from "date-fns/constants";
import request from "supertest";
import type { Repository } from "typeorm";
import { ActionsService } from "../src/actions/actions.service";
import { ActionActivity } from "../src/actions/entities/action-activity.entity";
import {
  ActionEvent,
  ActionStatus,
} from "../src/actions/entities/action-event.entity";
import { ActionSuite } from "../src/actions/entities/action-suite.entity";
import { Action, VisibilityMode } from "../src/actions/entities/action.entity";
import { ContractService } from "../src/contract/contract.service";
import { ContractEventType } from "../src/user/entities/contract-event.entity";
import { User } from "../src/user/entities/user.entity";
import { UserService } from "../src/user/user.service";
import { saveLiveCohortDecisions } from "./cohort-decision-fixtures";
import { createTestApp, TestContext } from "./e2e-test-utils";

const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * millisecondsInDay);

describe("findUsersToSuspend (e2e)", () => {
  let ctx: TestContext;
  let actionsService: ActionsService;
  let contractService: ContractService;
  let userService: UserService;
  let actionRepo: Repository<Action>;
  let eventRepo: Repository<ActionEvent>;
  let suiteRepo: Repository<ActionSuite>;
  let activityRepo: Repository<ActionActivity>;
  let userRepo: Repository<User>;

  let completingUser: User;
  let failingUser: User;
  const now = new Date("2023-04-01T00:00:00Z");

  const createCompletedSuiteAction = async (
    suiteName: string,
    actionName: string,
    baseDate: Date,
    options: {
      cohortExpression?: Action["cohortExpression"];
      priority?: number;
      suite?: ActionSuite;
    } = {},
  ) => {
    const suite =
      options.suite ??
      (await suiteRepo.save(
        suiteRepo.create({
          name: suiteName,
        }),
      ));

    const action = await actionRepo.save(
      actionRepo.create({
        name: actionName,
        category: [],
        body: "Body",
        shortDescription: "Short description",
        suite,
        visibilityMode: VisibilityMode.Public,
        cohortExpression: options.cohortExpression ?? {
          type: "Tag",
          tagId: ctx.defaultTag.id,
        },
        priority: options.priority,
        preventCompletion: false,
      }),
    );

    await eventRepo.save([
      eventRepo.create({
        title: `${actionName} office`,
        description: "Office phase",
        newStatus: ActionStatus.OfficeAction,
        date: baseDate,
        action,
      }),
      eventRepo.create({
        title: `${actionName} member`,
        description: "Member phase",
        newStatus: ActionStatus.MemberAction,
        date: addDays(baseDate, 1),
        action,
      }),
      eventRepo.create({
        title: `${actionName} done`,
        description: "Completed",
        newStatus: ActionStatus.Completed,
        date: addDays(baseDate, 2),
        action,
      }),
    ]);

    return action;
  };

  beforeAll(async () => {
    ctx = await createTestApp([]);
    actionsService = ctx.app.get(ActionsService);
    contractService = ctx.app.get(ContractService);
    userService = ctx.app.get(UserService);

    actionRepo = ctx.dataSource.getRepository(Action);
    eventRepo = ctx.dataSource.getRepository(ActionEvent);
    suiteRepo = ctx.dataSource.getRepository(ActionSuite);
    activityRepo = ctx.dataSource.getRepository(ActionActivity);
    userRepo = ctx.dataSource.getRepository(User);

    const contractSignedAt = new Date("2023-01-01T00:00:00Z");

    completingUser = await userService.create({
      email: "suspension-complete@example.com",
      password: "Password123!",
      name: "Completing User",
      tags: [ctx.defaultTag],
      contractEvents: [
        {
          type: ContractEventType.SIGNED,
          date: contractSignedAt,
          automatic: false,
          contractId: ctx.defaultContractId,
        },
      ],
    });

    failingUser = await userService.create({
      email: "suspension-failing@example.com",
      password: "Password123!",
      name: "Failing User",
      tags: [ctx.defaultTag],
      contractEvents: [
        {
          type: ContractEventType.SIGNED,
          contractId: ctx.defaultContractId,
          date: contractSignedAt,
          automatic: false,
        },
      ],
    });

    const actions = await Promise.all([
      createCompletedSuiteAction(
        "Suite One",
        "Action One",
        new Date("2023-01-10T00:00:00Z"),
      ),
      createCompletedSuiteAction(
        "Suite Two",
        "Action Two",
        new Date("2023-02-10T00:00:00Z"),
      ),
      createCompletedSuiteAction(
        "Suite Three",
        "Action Three",
        new Date("2023-03-10T00:00:00Z"),
      ),
    ]);

    await activityRepo.save(
      actions.map((action) =>
        activityRepo.create({
          actionId: action.id,
          userId: completingUser.id,
          type: ActionActivityType.USER_COMPLETED,
        }),
      ),
    );
  });

  afterAll(async () => {
    await userRepo.query('DELETE FROM "user"');
    await ctx.app.close();
  });

  it("returns suspension plans from the admin endpoint", async () => {
    const rangeStart = new Date("2023-04-01T00:00:00Z");
    const rangeEnd = new Date("2023-04-02T00:00:00Z");

    await saveLiveCohortDecisions(ctx);
    const res = await request(ctx.app.getHttpServer())
      .get("/actions/scheduledPlans")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .query({
        rangeStart: rangeStart.toISOString(),
        rangeEnd: rangeEnd.toISOString(),
      });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.suspensionPlans)).toBe(true);
    expect(res.body.suspensionPlans).toHaveLength(1);

    const [plan] = res.body.suspensionPlans;
    expect(new Date(plan.date).toISOString()).toBe(rangeStart.toISOString());

    const userIds = plan.users.map((user: { id: number }) => user.id);
    expect(userIds).toContain(failingUser.id);
    expect(userIds).not.toContain(completingUser.id);
  });

  it("does not count a suite as past while still in its member action window", async () => {
    // Create a 4th suite whose member action has started but deadline is still
    // in the future relative to `now`. Even though the user has already failed
    // two earlier suites, this in-progress suite should not count, so the user
    // should not yet be eligible for suspension.
    const inProgressSuite = await suiteRepo.save(
      suiteRepo.create({ name: "Suite In-Progress" }),
    );
    const inProgressAction = await actionRepo.save(
      actionRepo.create({
        name: "Action In-Progress",
        category: [],
        body: "Body",
        shortDescription: "Short description",
        suite: inProgressSuite,
        visibilityMode: VisibilityMode.Public,
        priority: 0,
        preventCompletion: false,
        cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
      }),
    );

    // MemberAction started 1 day before `now`, deadline 5 days after `now`
    await eventRepo.save(
      eventRepo.create({
        title: "In-Progress member",
        description: "Member phase",
        newStatus: ActionStatus.MemberAction,
        date: addDays(now, -1),
        action: inProgressAction,
      }),
    );
    await eventRepo.save(
      eventRepo.create({
        title: "In-Progress done",
        description: "Completed",
        newStatus: ActionStatus.Completed,
        date: addDays(now, 5),
        action: inProgressAction,
      }),
    );

    try {
      // Query at `now` — the in-progress suite deadline hasn't passed,
      // so only the first 3 (fully past) suites should count.
      // failingUser has failed all 3 past suites => still suspended.
      await saveLiveCohortDecisions(ctx);
      const result = await actionsService.findUsersToSuspend(now);
      expect(result.map(({ user }) => user.id)).toEqual([failingUser.id]);

      // Now query at a time where only 2 suites are past and the 3rd suite's
      // deadline hasn't passed yet. Remove suite three's completed event deadline
      // by pushing it into the future so only 2 suites are fully past.
      // Instead, simulate by checking at a date before suite three's deadline:
      // Suite Three: MemberAction at 2023-03-11, Completed at 2023-03-12
      // Check at 2023-03-11T12:00:00Z — between member start and deadline
      const midSuiteThree = new Date("2023-03-11T12:00:00Z");
      await saveLiveCohortDecisions(ctx);
      const midResult = await actionsService.findUsersToSuspend(midSuiteThree);
      // Only 2 suites are fully past at this point, not enough for suspension
      expect(midResult).toHaveLength(0);
    } finally {
      // Clean up the in-progress suite
      await eventRepo.delete({ action: { id: inProgressAction.id } });
      await actionRepo.delete(inProgressAction.id);
      await suiteRepo.delete(inProgressSuite.id);
    }
  });

  it("does not count optional actions toward the suspension streak", async () => {
    // Remove Suite Three so failingUser only has 2 required failures, then add
    // an optional suite. If optional actions were counted this would hit the
    // 3-strike threshold — but they shouldn't be.
    const suiteThree = await suiteRepo.findOneOrFail({
      where: { name: "Suite Three" },
    });
    const actionThree = await actionRepo.findOneOrFail({
      where: { suite: { id: suiteThree.id } },
    });
    await activityRepo.delete({ actionId: actionThree.id });
    await eventRepo.delete({ action: { id: actionThree.id } });
    await actionRepo.delete(actionThree.id);
    await suiteRepo.delete(suiteThree.id);

    const optionalSuite = await suiteRepo.save(
      suiteRepo.create({ name: "Suite Optional" }),
    );
    const optionalAction = await actionRepo.save(
      actionRepo.create({
        name: "Optional Action",
        category: [],
        body: "Body",
        shortDescription: "Short description",
        suite: optionalSuite,
        visibilityMode: VisibilityMode.Public,
        preventCompletion: false,
        optional: true,
        cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
      }),
    );
    await eventRepo.save([
      eventRepo.create({
        title: "Optional office",
        description: "Office phase",
        newStatus: ActionStatus.OfficeAction,
        date: new Date("2023-03-10T00:00:00Z"),
        action: optionalAction,
      }),
      eventRepo.create({
        title: "Optional member",
        description: "Member phase",
        newStatus: ActionStatus.MemberAction,
        date: new Date("2023-03-11T00:00:00Z"),
        action: optionalAction,
      }),
      eventRepo.create({
        title: "Optional done",
        description: "Completed",
        newStatus: ActionStatus.Completed,
        date: new Date("2023-03-12T00:00:00Z"),
        action: optionalAction,
      }),
    ]);

    try {
      // 2 required failures + 1 optional failure should NOT trigger suspension
      await saveLiveCohortDecisions(ctx);
      const result = await actionsService.findUsersToSuspend(now);
      expect(result.map(({ user }) => user.id)).not.toContain(failingUser.id);
    } finally {
      // Restore Suite Three so subsequent tests have the original 3 required suites
      await eventRepo.delete({ action: { id: optionalAction.id } });
      await actionRepo.delete(optionalAction.id);
      await suiteRepo.delete(optionalSuite.id);

      const restoredAction = await createCompletedSuiteAction(
        "Suite Three",
        "Action Three",
        new Date("2023-03-10T00:00:00Z"),
      );
      await activityRepo.save(
        activityRepo.create({
          actionId: restoredAction.id,
          userId: completingUser.id,
          type: ActionActivityType.USER_COMPLETED,
        }),
      );
    }
  });

  it("suspends users who fail three suites and does not re-suspend once inactive or re-signed", async () => {
    await saveLiveCohortDecisions(ctx);
    const initialRun = await actionsService.findUsersToSuspend(now);

    expect(initialRun.map(({ user }) => user.id)).toEqual([failingUser.id]);
    expect(initialRun[0].reasonKey).toContain("s-");
    expect(initialRun.some(({ user }) => user.id === completingUser.id)).toBe(
      false,
    );

    await contractService.suspendContract({
      userId: failingUser.id,
      automatic: true,
      autoSuspendKey: "test-auto-key",
    });

    await saveLiveCohortDecisions(ctx);
    const afterSuspension = await actionsService.findUsersToSuspend(now);
    expect(afterSuspension).toHaveLength(0);

    await contractService.signContract({
      userId: failingUser.id,
      signedName: "Test Name",
      viaTaskForm: false,
      contractId: ctx.defaultContractId,
    });

    await saveLiveCohortDecisions(ctx);
    const afterResigning = await actionsService.findUsersToSuspend(now);
    expect(afterResigning).toHaveLength(0);
  });

  it("counts only the actions assigned to each member toward their suite", async () => {
    const multiActionFailingUser = await userService.create({
      email: "suspension-multi-action@example.com",
      password: "Password123!",
      name: "Multi-Action Failing User",
      tags: [ctx.defaultTag],
      contractEvents: [
        {
          type: ContractEventType.SIGNED,
          date: new Date("2023-03-15T00:00:00Z"),
          automatic: false,
          contractId: ctx.defaultContractId,
        },
      ],
    });
    const multiActionCompletingUser = await userService.create({
      email: "suspension-multi-action-completing@example.com",
      password: "Password123!",
      name: "Multi-Action Completing User",
      tags: [ctx.defaultTag],
      contractEvents: [
        {
          type: ContractEventType.SIGNED,
          date: new Date("2023-03-15T00:00:00Z"),
          automatic: false,
          contractId: ctx.defaultContractId,
        },
      ],
    });

    const assignedTestUsers = {
      type: "Manual" as const,
      userIds: [multiActionFailingUser.id, multiActionCompletingUser.id],
    };
    const onlyCompletingUser = {
      type: "Manual" as const,
      userIds: [completingUser.id],
    };

    await createCompletedSuiteAction(
      "Multi-Action Suite One",
      "Multi-Action One",
      new Date("2023-03-16T00:00:00Z"),
      { cohortExpression: assignedTestUsers },
    );
    const multiActionSuiteTwo = await suiteRepo.save(
      suiteRepo.create({ name: "Multi-Action Suite Two" }),
    );
    await createCompletedSuiteAction(
      "Multi-Action Suite Two",
      "Restricted First Action",
      new Date("2023-03-20T00:00:00Z"),
      {
        cohortExpression: onlyCompletingUser,
        priority: 0,
        suite: multiActionSuiteTwo,
      },
    );
    const assignedSecondAction = await createCompletedSuiteAction(
      "Multi-Action Suite Two",
      "Assigned Second Action",
      new Date("2023-03-20T00:00:00Z"),
      {
        cohortExpression: assignedTestUsers,
        priority: 1,
        suite: multiActionSuiteTwo,
      },
    );
    await createCompletedSuiteAction(
      "Multi-Action Suite Three",
      "Multi-Action Three",
      new Date("2023-03-24T00:00:00Z"),
      { cohortExpression: assignedTestUsers },
    );
    await activityRepo.save(
      activityRepo.create({
        actionId: assignedSecondAction.id,
        userId: multiActionCompletingUser.id,
        type: ActionActivityType.USER_COMPLETED,
      }),
    );

    await saveLiveCohortDecisions(ctx);
    const result = await actionsService.findUsersToSuspend(now);

    expect(result.map(({ user }) => user.id)).toContain(
      multiActionFailingUser.id,
    );
    expect(result.map(({ user }) => user.id)).not.toContain(
      multiActionCompletingUser.id,
    );
  });

  const createSignedUser = (email: string, signedAt: Date) =>
    userService.create({
      email,
      password: "Password123!",
      name: email,
      contractEvents: [
        {
          type: ContractEventType.SIGNED,
          date: signedAt,
          automatic: false,
          contractId: ctx.defaultContractId,
        },
      ],
    });

  it("counts the suites a member was decided into after the live cohort drops them", async () => {
    const member = await createSignedUser(
      "suspension-decided@example.com",
      new Date("2023-01-01T00:00:00Z"),
    );
    const actions = await Promise.all(
      ["2023-03-13", "2023-03-16", "2023-03-19"].map((date, i) =>
        createCompletedSuiteAction(
          `Decided Suite ${i}`,
          `Decided Action ${i}`,
          new Date(`${date}T00:00:00Z`),
          { cohortExpression: { type: "Manual", userIds: [member.id] } },
        ),
      ),
    );
    try {
      await saveLiveCohortDecisions(ctx);
      await Promise.all(
        actions.map((action) =>
          actionRepo.update(action.id, {
            cohortExpression: { type: "Manual", userIds: [] },
          }),
        ),
      );

      const result = await actionsService.findUsersToSuspend(now);

      expect(result.map(({ user }) => user.id)).toContain(member.id);
    } finally {
      await actionRepo.delete(actions.map((action) => action.id));
    }
  });

  describe("missed streaks", () => {
    let member: User;
    let suiteActions: Action[][];

    const createMemberSuites = async (
      prefix: string,
      dates: string[],
      actionsPerSuite: number,
    ) => {
      member = await createSignedUser(
        `${prefix}@example.com`,
        new Date("2023-01-01T00:00:00Z"),
      );
      suiteActions = [];
      for (const [i, date] of dates.entries()) {
        const suite = await suiteRepo.save(
          suiteRepo.create({ name: `${prefix} suite ${i}` }),
        );
        const actions: Action[] = [];
        for (let j = 0; j < actionsPerSuite; j++) {
          actions.push(
            await createCompletedSuiteAction(
              suite.name,
              `${prefix} action ${i}.${j}`,
              new Date(`${date}T00:00:00Z`),
              {
                cohortExpression: { type: "Manual", userIds: [member.id] },
                suite,
              },
            ),
          );
        }
        suiteActions.push(actions);
      }
      await saveLiveCohortDecisions(ctx);
    };

    const record = (action: Action, type: ActionActivityType) =>
      activityRepo.save(
        activityRepo.create({ actionId: action.id, userId: member.id, type }),
      );

    const isSuspended = async () =>
      (await actionsService.findUsersToSuspend(now)).some(
        ({ user }) => user.id === member.id,
      );

    afterEach(async () => {
      await actionRepo.delete(suiteActions.flat().map((action) => action.id));
    });

    it("misses a suite when any assigned required action is missed", async () => {
      await createMemberSuites(
        "streak-partial",
        ["2023-03-13", "2023-03-16", "2023-03-19"],
        2,
      );
      for (const [first] of suiteActions) {
        await record(first, ActionActivityType.USER_COMPLETED);
      }
      expect(await isSuspended()).toBe(true);

      await record(suiteActions[2][1], ActionActivityType.USER_WONT_COMPLETE);
      expect(await isSuspended()).toBe(false);
    });

    it("does not suspend for an older run that a satisfied suite reset", async () => {
      await createMemberSuites(
        "streak-reset",
        ["2023-03-10", "2023-03-13", "2023-03-16", "2023-03-19"],
        1,
      );
      await record(suiteActions[3][0], ActionActivityType.USER_COMPLETED);
      expect(await isSuspended()).toBe(false);
    });

    it("reads the run into the missed-deadline reminder context", async () => {
      await createMemberSuites(
        "streak-reminder",
        ["2023-03-13", "2023-03-16"],
        2,
      );
      for (const [first] of suiteActions) {
        await record(first, ActionActivityType.USER_COMPLETED);
      }
      const contextAt = async (at: Date) =>
        (
          await actionsService.getMissedActionReminderContexts([member.id], at)
        ).get(member.id);

      expect(await contextAt(new Date("2023-03-16T00:00:00Z"))).toEqual({
        isFirstAssignedSuite: true,
        consecutiveMissedSuiteCount: 1,
      });
      expect(await contextAt(now)).toEqual({
        isFirstAssignedSuite: false,
        consecutiveMissedSuiteCount: 2,
      });
    });

    it("counts dismissed actions as missed", async () => {
      await createMemberSuites(
        "streak-dismissed",
        ["2023-03-13", "2023-03-16", "2023-03-19"],
        1,
      );
      for (const [action] of suiteActions) {
        await record(action, ActionActivityType.USER_DISMISSED);
      }
      expect(await isSuspended()).toBe(true);
    });

    it("recalculates the run after a late completion without erasing later misses", async () => {
      await createMemberSuites(
        "streak-late",
        ["2023-03-10", "2023-03-13", "2023-03-16", "2023-03-19"],
        1,
      );
      await record(suiteActions[0][0], ActionActivityType.USER_COMPLETED);
      expect(await isSuspended()).toBe(true);

      await record(suiteActions[1][0], ActionActivityType.USER_COMPLETED);
      expect(await isSuspended()).toBe(false);
    });
  });

  it("previews suspensions from a suite that has not launched yet", async () => {
    const today = new Date();
    const member = await createSignedUser(
      "suspension-upcoming@example.com",
      addDays(today, -60),
    );
    const actions = await Promise.all(
      [-30, -15, 1].map((offset, i) =>
        createCompletedSuiteAction(
          `Upcoming Suite ${i}`,
          `Upcoming Action ${i}`,
          addDays(today, offset - 1),
          { cohortExpression: { type: "Manual", userIds: [member.id] } },
        ),
      ),
    );
    try {
      await saveLiveCohortDecisions(ctx);

      const plans = await actionsService.getSuspendPlans(
        today,
        addDays(today, 7),
        6,
      );

      expect(
        plans.flatMap((plan) => plan.users.map((user) => user.id)),
      ).toContain(member.id);
    } finally {
      await actionRepo.delete(actions.map((action) => action.id));
    }
  });
});
