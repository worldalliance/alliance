import { ActionActivityType } from "@alliance/common/actionActivity";
import { Logger } from "@nestjs/common";
import type { Repository } from "typeorm";
import { CohortDecisionService } from "../src/actions/cohort-decision.service";
import { CohortDivergenceService } from "../src/actions/cohort-divergence.service";
import { ActionActivity } from "../src/actions/entities/action-activity.entity";
import { ActionCohortDecision } from "../src/actions/entities/action-cohort-decision.entity";
import { CohortDecisionReason } from "../src/actions/entities/cohort-decision-reason";
import { TasksModule } from "../src/tasks/tasks.module";
import { User } from "../src/user/entities/user.entity";
import {
  addDays,
  cohortDecisionFixtures,
  type CohortDecisionFixtures,
} from "./cohort-decision-fixtures";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("CohortDivergenceService.logDivergences (e2e)", () => {
  let ctx: TestContext;
  let service: CohortDecisionService;
  let divergenceService: CohortDivergenceService;
  let decisionRepo: Repository<ActionCohortDecision>;
  let userRepo: Repository<User>;
  let activityRepo: Repository<ActionActivity>;
  let createUser: CohortDecisionFixtures["createUser"];
  let createAction: CohortDecisionFixtures["createAction"];
  let cleanUp: CohortDecisionFixtures["cleanUp"];

  const now = new Date();
  const signedAt = addDays(now, -30);

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    service = ctx.app.get(CohortDecisionService);
    divergenceService = ctx.app.get(CohortDivergenceService);
    decisionRepo = ctx.dataSource.getRepository(ActionCohortDecision);
    userRepo = ctx.dataSource.getRepository(User);
    activityRepo = ctx.dataSource.getRepository(ActionActivity);
    ({ createUser, createAction, cleanUp } = cohortDecisionFixtures(ctx));
  }, 50000);

  afterEach(() => cleanUp());

  afterAll(async () => {
    await ctx.app.close();
  });

  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it("logs members who left a profile-only cohort", async () => {
    const member = await createUser({ signedAt });
    const action = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
    });
    await service.resolveAll(now);
    await userRepo.save({ id: member.id, tags: [] });

    await divergenceService.logDivergences(now);

    expect(warn).toHaveBeenCalledWith(
      `cohort decisions for action ${action.id} diverge from the live cohort (profile-only expression): now in 0 [], now out 1 [${member.id}]`,
    );
  });

  it("logs members who joined an activity cohort", async () => {
    const member = await createUser({ signedAt });
    const upstream = await createAction({
      start: addDays(now, -2),
      deadline: addDays(now, 3),
    });
    const action = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
      cohortExpression: { type: "CompletedAction", actionId: upstream.id },
    });
    await service.resolveAll(now);
    await activityRepo.save({
      actionId: upstream.id,
      userId: member.id,
      type: ActionActivityType.USER_COMPLETED,
    });

    await divergenceService.logDivergences(now);

    expect(warn).toHaveBeenCalledWith(
      `cohort decisions for action ${action.id} diverge from the live cohort (activity-dependent expression): now in 1 [${member.id}], now out 0 []`,
    );
  });

  it("keeps checking other actions when one cohort fails", async () => {
    const member = await createUser({ signedAt });
    const broken = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
      cohortExpression: { type: "MissedActionDeadline", actionId: 999999 },
    });
    await decisionRepo.save({
      actionId: broken.id,
      userId: member.id,
      included: false,
      reason: CohortDecisionReason.Launch,
      resolvedAt: now,
    });
    const action = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
    });
    await decisionRepo.save({
      actionId: action.id,
      userId: member.id,
      included: false,
      reason: CohortDecisionReason.Launch,
      resolvedAt: now,
    });
    const error = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => {});

    await divergenceService.logDivergences(now);

    expect(error).toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      `cohort decisions for action ${action.id} diverge from the live cohort (profile-only expression): now in 1 [${member.id}], now out 0 []`,
    );
    error.mockRestore();
  });

  it("stays quiet when decisions match the live cohort", async () => {
    await createUser({ signedAt });
    await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
    });
    await service.resolveAll(now);

    await divergenceService.logDivergences(now);

    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    CohortDecisionReason.ResolvedAfterDeadline,
    CohortDecisionReason.StaffCorrection,
  ])("ignores %s exclusions", async (reason) => {
    const member = await createUser({ signedAt });
    const action = await createAction({
      start: addDays(now, -3),
      deadline: addDays(now, -1),
    });
    await decisionRepo.save({
      actionId: action.id,
      userId: member.id,
      included: false,
      reason,
      resolvedAt: now,
    });

    await divergenceService.logDivergences(now);

    expect(warn).not.toHaveBeenCalled();
  });
});
