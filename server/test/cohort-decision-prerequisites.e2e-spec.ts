import { ActionActivityType } from "@alliance/common/actionActivity";
import type { Repository } from "typeorm";
import { CohortDecisionService } from "../src/actions/cohort-decision.service";
import { ActionActivity } from "../src/actions/entities/action-activity.entity";
import { ActionCohortDecision } from "../src/actions/entities/action-cohort-decision.entity";
import { Action } from "../src/actions/entities/action.entity";
import { CohortDecisionReason } from "../src/actions/entities/cohort-decision-reason";
import { TasksModule } from "../src/tasks/tasks.module";
import { User } from "../src/user/entities/user.entity";
import {
  addDays,
  cohortDecisionFixtures,
  type CohortDecisionFixtures,
} from "./cohort-decision-fixtures";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("CohortDecisionService prerequisites (e2e)", () => {
  let ctx: TestContext;
  let service: CohortDecisionService;
  let activityRepo: Repository<ActionActivity>;
  let actionRepo: Repository<Action>;
  let decisionRepo: Repository<ActionCohortDecision>;
  let userRepo: Repository<User>;
  let createUser: CohortDecisionFixtures["createUser"];
  let createAction: CohortDecisionFixtures["createAction"];
  let decisionsFor: CohortDecisionFixtures["decisionsFor"];
  let cleanUp: CohortDecisionFixtures["cleanUp"];

  const now = new Date();
  const signedAt = addDays(now, -30);

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    service = ctx.app.get(CohortDecisionService);
    activityRepo = ctx.dataSource.getRepository(ActionActivity);
    actionRepo = ctx.dataSource.getRepository(Action);
    decisionRepo = ctx.dataSource.getRepository(ActionCohortDecision);
    userRepo = ctx.dataSource.getRepository(User);
    ({ createUser, createAction, decisionsFor, cleanUp } =
      cohortDecisionFixtures(ctx));
  }, 50000);

  afterEach(() => cleanUp());

  afterAll(async () => {
    await ctx.app.close();
  });

  const record = (params: {
    actionId: number;
    userId: number;
    type: ActionActivityType;
  }) => activityRepo.save(params);

  const createUpstream = () =>
    createAction({ start: addDays(now, -3), deadline: addDays(now, 1) });

  it("waits for an open prerequisite, then selects on the completion", async () => {
    const member = await createUser({ signedAt });
    const upstream = await createUpstream();
    const completed = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
      prerequisiteActionIds: [upstream.id],
      cohortExpression: { type: "CompletedAction", actionId: upstream.id },
    });
    const notCompleted = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
      prerequisiteActionIds: [upstream.id],
      cohortExpression: {
        type: "NOT",
        child: { type: "CompletedAction", actionId: upstream.id },
      },
    });

    await service.resolveAll(now);
    expect((await decisionsFor(completed.id)).has(member.id)).toBe(false);
    expect((await decisionsFor(notCompleted.id)).has(member.id)).toBe(false);

    await record({
      actionId: upstream.id,
      userId: member.id,
      type: ActionActivityType.USER_COMPLETED,
    });
    await service.resolveAll(now);

    expect((await decisionsFor(completed.id)).get(member.id)).toMatchObject({
      included: true,
      reason: CohortDecisionReason.PrerequisitesResolved,
    });
    expect((await decisionsFor(notCompleted.id)).get(member.id)).toMatchObject({
      included: false,
      reason: CohortDecisionReason.PrerequisitesResolved,
    });
  });

  it("resolves a withdrawal early into the noncompletion branch", async () => {
    const member = await createUser({ signedAt });
    const upstream = await createUpstream();
    const notCompleted = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
      prerequisiteActionIds: [upstream.id],
      cohortExpression: {
        type: "NOT",
        child: { type: "CompletedAction", actionId: upstream.id },
      },
    });
    await record({
      actionId: upstream.id,
      userId: member.id,
      type: ActionActivityType.USER_WONT_COMPLETE,
    });

    await service.resolveAll(now);

    expect((await decisionsFor(notCompleted.id)).get(member.id)?.included).toBe(
      true,
    );
  });

  it("does not resolve on dismissal", async () => {
    const member = await createUser({ signedAt });
    const upstream = await createUpstream();
    const action = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
      prerequisiteActionIds: [upstream.id],
    });
    await record({
      actionId: upstream.id,
      userId: member.id,
      type: ActionActivityType.USER_DISMISSED,
    });

    await service.resolveAll(now);

    expect((await decisionsFor(action.id)).has(member.id)).toBe(false);
  });

  it("decides everyone once the prerequisite's deadline passes", async () => {
    const member = await createUser({ signedAt });
    const upstream = await createUpstream();
    const action = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
      prerequisiteActionIds: [upstream.id],
    });

    await service.resolveAll(addDays(now, 2));

    expect((await decisionsFor(action.id)).get(member.id)).toMatchObject({
      included: true,
      reason: CohortDecisionReason.PrerequisitesResolved,
    });
  });

  it("resolves early when the prerequisite excluded the member", async () => {
    const member = await createUser({ signedAt });
    const upstream = await createUpstream();
    const action = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
      prerequisiteActionIds: [upstream.id],
    });
    await decisionRepo.save({
      actionId: upstream.id,
      userId: member.id,
      included: false,
      reason: CohortDecisionReason.Launch,
      resolvedAt: now,
    });

    await service.resolveAll(now);

    expect((await decisionsFor(action.id)).get(member.id)?.included).toBe(true);
  });

  it("waits for every prerequisite", async () => {
    const member = await createUser({ signedAt });
    const first = await createUpstream();
    const second = await createUpstream();
    const action = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
      prerequisiteActionIds: [first.id, second.id],
    });
    await record({
      actionId: first.id,
      userId: member.id,
      type: ActionActivityType.USER_COMPLETED,
    });

    await service.resolveAll(now);
    expect((await decisionsFor(action.id)).has(member.id)).toBe(false);

    await record({
      actionId: second.id,
      userId: member.id,
      type: ActionActivityType.USER_WONT_COMPLETE,
    });
    await service.resolveAll(now);
    expect((await decisionsFor(action.id)).has(member.id)).toBe(true);
  });

  it("selects the country branch from the profile when the prerequisite resolves", async () => {
    const member = await createUser({
      signedAt,
      timeZone: "America/New_York",
    });
    const upstream = await createUpstream();
    const usAction = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
      prerequisiteActionIds: [upstream.id],
      cohortExpression: { type: "USMember" },
    });
    const nonUsAction = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
      prerequisiteActionIds: [upstream.id],
      cohortExpression: { type: "NonUSMember" },
    });

    await service.resolveAll(now);
    await userRepo.update(member.id, { timeZone: "America/Toronto" });
    await record({
      actionId: upstream.id,
      userId: member.id,
      type: ActionActivityType.USER_COMPLETED,
    });
    await service.resolveAll(now);
    await userRepo.update(member.id, { timeZone: "America/New_York" });
    await service.resolveAll(now);

    expect((await decisionsFor(usAction.id)).get(member.id)?.included).toBe(
      false,
    );
    expect((await decisionsFor(nonUsAction.id)).get(member.id)?.included).toBe(
      true,
    );
  });

  it("keeps a signer's reason on an action with prerequisites", async () => {
    const upstream = await createUpstream();
    const action = await createAction({
      start: addDays(now, -2),
      deadline: addDays(now, 3),
      prerequisiteActionIds: [upstream.id],
    });
    const member = await createUser({ signedAt: addDays(now, -1) });

    await service.resolveAll(addDays(now, 2));

    expect((await decisionsFor(action.id)).get(member.id)?.reason).toBe(
      CohortDecisionReason.Signing,
    );
  });

  describe("after the deadline", () => {
    const createClosed = async (prerequisiteActionIds: number[]) => {
      const action = await createAction({
        start: addDays(now, -3),
        deadline: addDays(now, -1),
        prerequisiteActionIds,
      });
      const decided = await createUser({ signedAt });
      await decisionRepo.save({
        actionId: action.id,
        userId: decided.id,
        included: true,
        reason: CohortDecisionReason.PrerequisitesResolved,
        resolvedAt: addDays(now, -2),
      });
      return action;
    };

    it("leaves an obligated member undecided until the prerequisite resolves", async () => {
      const member = await createUser({ signedAt });
      const upstream = await createUpstream();
      const action = await createClosed([upstream.id]);

      await service.resolveAll(now);
      expect((await decisionsFor(action.id)).has(member.id)).toBe(false);

      await record({
        actionId: upstream.id,
        userId: member.id,
        type: ActionActivityType.USER_COMPLETED,
      });
      await service.resolveAll(now);
      expect((await decisionsFor(action.id)).get(member.id)).toMatchObject({
        included: false,
        reason: CohortDecisionReason.ResolvedAfterDeadline,
      });
    });

    it("admits a ready member of an optional action", async () => {
      const member = await createUser({ signedAt });
      const upstream = await createAction({
        start: addDays(now, -5),
        deadline: addDays(now, -4),
      });
      const action = await createClosed([upstream.id]);
      await actionRepo.update(action.id, { optional: true });

      await service.resolveAll(now);

      expect((await decisionsFor(action.id)).get(member.id)).toMatchObject({
        included: true,
        reason: CohortDecisionReason.PrerequisitesResolved,
      });
    });

    it("counts a prerequisite decision toward the cutover, so waiting members skip backfill", async () => {
      const upstream = await createUpstream();
      await createClosed([upstream.id]);
      const action = await createAction({
        start: addDays(now, -1.5),
        deadline: addDays(now, -1),
        prerequisiteActionIds: [upstream.id],
      });
      const member = await createUser({ signedAt });

      await service.resolveAll(now);

      expect((await decisionsFor(action.id)).has(member.id)).toBe(false);
    });
  });
});
