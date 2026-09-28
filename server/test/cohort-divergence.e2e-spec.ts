import { ActionActivityType } from "@alliance/common/actionActivity";
import { Logger } from "@nestjs/common";
import type { Repository } from "typeorm";
import { CohortDecisionService } from "../src/actions/cohort-decision.service";
import { CohortDecisionWorker } from "../src/actions/cohort-decision.worker";
import { CohortDivergenceService } from "../src/actions/cohort-divergence.service";
import { ActionActivity } from "../src/actions/entities/action-activity.entity";
import { ActionCohortDecision } from "../src/actions/entities/action-cohort-decision.entity";
import { ActionFormVariant } from "../src/actions/entities/action-form-variant.entity";
import { Action } from "../src/actions/entities/action.entity";
import { CohortDecisionReason } from "../src/actions/entities/cohort-decision-reason";
import { TasksModule } from "../src/tasks/tasks.module";
import { User } from "../src/user/entities/user.entity";
import {
  addDays,
  cohortDecisionFixtures,
  type CohortDecisionFixtures,
} from "./cohort-decision-fixtures";
import {
  createFormWithSnapshot,
  createTestApp,
  TestContext,
} from "./e2e-test-utils";

describe("CohortDivergenceService (e2e)", () => {
  let ctx: TestContext;
  let service: CohortDecisionService;
  let divergenceService: CohortDivergenceService;
  let decisionRepo: Repository<ActionCohortDecision>;
  let userRepo: Repository<User>;
  let activityRepo: Repository<ActionActivity>;
  let createUser: CohortDecisionFixtures["createUser"];
  let createAction: CohortDecisionFixtures["createAction"];
  let failManualCohorts: CohortDecisionFixtures["failManualCohorts"];
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
    ({ createUser, createAction, failManualCohorts, cleanUp } =
      cohortDecisionFixtures(ctx));
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
      cohortExpression: { type: "Manual", userIds: [member.id] },
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
    const failing = failManualCohorts();
    const error = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => {});

    try {
      await divergenceService.logDivergences(now);

      expect(error).toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(
        `cohort decisions for action ${action.id} diverge from the live cohort (profile-only expression): now in 1 [${member.id}], now out 0 []`,
      );
    } finally {
      failing.mockRestore();
      error.mockRestore();
    }
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

  describe("logUnawaitedOpenReferences", () => {
    const createPair = (
      prerequisiteActionIds: (upstreamId: number) => number[],
    ) =>
      createAction({
        start: addDays(now, -3),
        deadline: addDays(now, 1),
      }).then(async (upstream) => ({
        upstream,
        action: await createAction({
          start: addDays(now, -1),
          deadline: addDays(now, 3),
          cohortExpression: { type: "CompletedAction", actionId: upstream.id },
          prerequisiteActionIds: prerequisiteActionIds(upstream.id),
        }),
      }));

    it("logs an action reading one still open at its launch", async () => {
      const { upstream, action } = await createPair(() => []);

      await divergenceService.logUnawaitedOpenReferences(now);

      expect(warn).toHaveBeenCalledWith(
        `action ${action.id} reads actions still open at its launch without a prerequisite on them: ${upstream.id}`,
      );
    });

    const createFormReader = async (
      link: (upstream: Action, formId: number) => Promise<unknown>,
    ) => {
      const upstream = await createAction({
        start: addDays(now, -3),
        deadline: addDays(now, 1),
      });
      const { form } = await createFormWithSnapshot(ctx.dataSource, {
        title: "Upstream form",
        schema: { title: "Upstream form", pages: [], outputViews: [] },
      });
      await link(upstream, form.id);
      const action = await createAction({
        start: addDays(now, -1),
        deadline: addDays(now, 3),
        cohortExpression: {
          type: "FormFieldValue",
          formId: form.id,
          fieldId: "f",
        },
      });
      return { upstream, action };
    };

    it("logs an action reading an open action's task form", async () => {
      const { upstream, action } = await createFormReader((upstream, formId) =>
        ctx.dataSource
          .getRepository(Action)
          .update(upstream.id, { taskFormId: formId }),
      );

      await divergenceService.logUnawaitedOpenReferences(now);

      expect(warn).toHaveBeenCalledWith(
        `action ${action.id} reads actions still open at its launch without a prerequisite on them: ${upstream.id}`,
      );
    });

    it("logs an action reading an open action's variant form", async () => {
      const { upstream, action } = await createFormReader((upstream, formId) =>
        ctx.dataSource.getRepository(ActionFormVariant).save({
          actionId: upstream.id,
          formId,
          name: "Variant A",
          splitValue: 0.5,
        }),
      );

      await divergenceService.logUnawaitedOpenReferences(now);

      expect(warn).toHaveBeenCalledWith(
        `action ${action.id} reads actions still open at its launch without a prerequisite on them: ${upstream.id}`,
      );
    });

    it("stays quiet once the action waits for it, but records the clean run", async () => {
      const log = jest
        .spyOn(Logger.prototype, "log")
        .mockImplementation(() => {});
      await createPair((upstreamId) => [upstreamId]);

      try {
        await divergenceService.logUnawaitedOpenReferences(now);

        expect(warn).not.toHaveBeenCalled();
        expect(log).toHaveBeenCalledWith(
          "checked 2 scheduled action(s) for unawaited open references, 0 flagged",
        );
      } finally {
        log.mockRestore();
      }
    });

    it("logs a public-only action read while still open", async () => {
      const { upstream, action } = await createPair(() => []);
      await ctx.dataSource
        .getRepository(Action)
        .update(upstream.id, { publicOnly: true });

      await divergenceService.logUnawaitedOpenReferences(now);

      expect(warn).toHaveBeenCalledWith(
        `action ${action.id} reads actions still open at its launch without a prerequisite on them: ${upstream.id}`,
      );
    });

    it("logs an action reading an onboarding action due before its launch", async () => {
      const upstream = await createAction({
        start: addDays(now, -6),
        deadline: addDays(now, -2),
      });
      await ctx.dataSource
        .getRepository(Action)
        .update(upstream.id, { onboarding: true });
      const action = await createAction({
        start: addDays(now, -1),
        deadline: addDays(now, 3),
        cohortExpression: { type: "CompletedAction", actionId: upstream.id },
        prerequisiteActionIds: [upstream.id],
      });

      await divergenceService.logUnawaitedOpenReferences(now);

      expect(warn).toHaveBeenCalledWith(
        `action ${action.id} reads onboarding actions, which stay open to members who join later: ${upstream.id}`,
      );
    });

    it("logs an action yet to launch reading one still open at its launch", async () => {
      const upstream = await createAction({
        start: addDays(now, -1),
        deadline: addDays(now, 3),
      });
      const action = await createAction({
        start: addDays(now, 1),
        deadline: addDays(now, 5),
        cohortExpression: { type: "CompletedAction", actionId: upstream.id },
      });

      await divergenceService.logUnawaitedOpenReferences(now);

      expect(warn).toHaveBeenCalledWith(
        `action ${action.id} reads actions still open at its launch without a prerequisite on them: ${upstream.id}`,
      );
    });

    it("logs a closed action still in its catch-up", async () => {
      const upstream = await createAction({
        start: addDays(now, -6),
        deadline: addDays(now, -2),
      });
      const action = await createAction({
        start: addDays(now, -5),
        deadline: addDays(now, -1),
        cohortExpression: { type: "CompletedAction", actionId: upstream.id },
      });

      await divergenceService.logUnawaitedOpenReferences(now);

      expect(warn).toHaveBeenCalledWith(
        `action ${action.id} reads actions still open at its launch without a prerequisite on them: ${upstream.id}`,
      );
    });

    it("stays quiet about an action past its catch-up", async () => {
      const upstream = await createAction({
        start: addDays(now, -20),
        deadline: addDays(now, -9),
      });
      await createAction({
        start: addDays(now, -15),
        deadline: addDays(now, -8),
        cohortExpression: { type: "CompletedAction", actionId: upstream.id },
      });

      await divergenceService.logUnawaitedOpenReferences(now);

      expect(warn).not.toHaveBeenCalled();
    });

    it("runs when the divergence pass throws, and reports its failure", async () => {
      const { upstream, action } = await createPair(() => []);
      const boom = new Error("boom");
      const logDivergences = jest
        .spyOn(divergenceService, "logDivergences")
        .mockRejectedValue(boom);

      try {
        await expect(
          ctx.app.get(CohortDecisionWorker).logDivergences(),
        ).rejects.toMatchObject({
          message: "cohort decision divergence checks failed",
          errors: [boom],
        });
      } finally {
        logDivergences.mockRestore();
      }

      expect(warn).toHaveBeenCalledWith(
        `action ${action.id} reads actions still open at its launch without a prerequisite on them: ${upstream.id}`,
      );
    });
  });
});
