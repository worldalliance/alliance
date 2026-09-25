import request from "supertest";
import type { Repository } from "typeorm";
import { CohortDecisionService } from "../src/actions/cohort-decision.service";
import { Action } from "../src/actions/entities/action.entity";
import { CohortDecisionReason } from "../src/actions/entities/cohort-decision-reason";
import { TasksModule } from "../src/tasks/tasks.module";
import {
  addDays,
  cohortDecisionFixtures,
  type CohortDecisionFixtures,
} from "./cohort-decision-fixtures";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Cohort decision staff tooling (e2e)", () => {
  let ctx: TestContext;
  let service: CohortDecisionService;
  let actionRepo: Repository<Action>;
  let createUser: CohortDecisionFixtures["createUser"];
  let createAction: CohortDecisionFixtures["createAction"];
  let decisionsFor: CohortDecisionFixtures["decisionsFor"];
  let cleanUp: CohortDecisionFixtures["cleanUp"];

  const now = new Date();
  const signedAt = addDays(now, -30);

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    service = ctx.app.get(CohortDecisionService);
    actionRepo = ctx.dataSource.getRepository(Action);
    ({ createUser, createAction, decisionsFor, cleanUp } =
      cohortDecisionFixtures(ctx));
  }, 50000);

  afterEach(() => cleanUp());

  afterAll(async () => {
    await ctx.app.close();
  });

  const patchAction = (actionId: number, body: object) =>
    request(ctx.app.getHttpServer())
      .patch(`/actions/${actionId}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send(body);

  describe("optionality", () => {
    it("rejects changing optional once the action has decisions", async () => {
      await createUser({ signedAt });
      const action = await createAction({
        start: addDays(now, -1),
        deadline: addDays(now, 3),
      });
      await service.resolveAll(now);

      expect((await patchAction(action.id, { optional: true })).status).toBe(
        400,
      );
      expect(
        (await actionRepo.findOneByOrFail({ id: action.id })).optional,
      ).toBe(false);
      expect((await patchAction(action.id, { optional: false })).status).toBe(
        200,
      );
    });

    it("allows changing optional before any decision", async () => {
      const action = await createAction({
        start: addDays(now, 1),
        deadline: addDays(now, 3),
      });

      expect((await patchAction(action.id, { optional: true })).status).toBe(
        200,
      );
      expect(
        (await actionRepo.findOneByOrFail({ id: action.id })).optional,
      ).toBe(true);
    });
  });

  describe("corrections", () => {
    const listDecisions = (actionId: number, token = ctx.adminAccessToken) =>
      request(ctx.app.getHttpServer())
        .get(`/cohort-decisions/action/${actionId}`)
        .set("Authorization", `Bearer ${token}`);
    const correct = (params: {
      actionId: number;
      userId: number;
      body: object;
      token?: string;
    }) =>
      request(ctx.app.getHttpServer())
        .post(
          `/cohort-decisions/action/${params.actionId}/user/${params.userId}/correction`,
        )
        .set("Authorization", `Bearer ${params.token ?? ctx.adminAccessToken}`)
        .send(params.body);

    const decidedAction = async () => {
      const member = await createUser({ signedAt });
      const action = await createAction({
        start: addDays(now, -1),
        deadline: addDays(now, 3),
      });
      await service.resolveAll(now);
      return { member, action };
    };

    it("lists each member's decision, reason, and resolution time", async () => {
      const { member, action } = await decidedAction();

      const res = await listDecisions(action.id);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        {
          userId: member.id,
          userName: member.name,
          included: true,
          reason: CohortDecisionReason.Launch,
          resolvedAt: now.toISOString(),
          corrections: [],
        },
      ]);
    });

    it("flips a decision and keeps the values it replaced with the staff note", async () => {
      const { member, action } = await decidedAction();

      const first = await correct({
        actionId: action.id,
        userId: member.id,
        body: { included: false, note: "  Moved before launch  " },
      });
      const second = await correct({
        actionId: action.id,
        userId: member.id,
        body: { included: true, note: "Move was a typo" },
      });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(second.body).toMatchObject({
        included: true,
        reason: CohortDecisionReason.StaffCorrection,
        corrections: [
          {
            previousIncluded: true,
            previousReason: CohortDecisionReason.Launch,
            previousResolvedAt: now.toISOString(),
            note: "Moved before launch",
            correctedByName: expect.any(String),
          },
          {
            previousIncluded: false,
            previousReason: CohortDecisionReason.StaffCorrection,
            note: "Move was a typo",
          },
        ],
      });
      expect((await listDecisions(action.id)).body).toEqual([second.body]);
    });

    it("keeps a correction through later resolver passes", async () => {
      const { member, action } = await decidedAction();
      await correct({
        actionId: action.id,
        userId: member.id,
        body: { included: false, note: "Staff decision" },
      });

      await service.resolveAll(now);

      expect((await decisionsFor(action.id)).get(member.id)).toMatchObject({
        included: false,
        reason: CohortDecisionReason.StaffCorrection,
      });
    });

    it("keeps the resolver's cutover when staff correct its first decisions", async () => {
      const member = await createUser({ signedAt });
      const early = await createAction({
        start: addDays(now, -10),
        deadline: addDays(now, 5),
      });
      await service.resolveAll(addDays(now, -9));
      await correct({
        actionId: early.id,
        userId: member.id,
        body: { included: false, note: "Staff decision" },
      });
      const missed = await createAction({
        start: addDays(now, -6),
        deadline: addDays(now, -2),
      });

      await service.resolveAll(now);

      expect((await decisionsFor(missed.id)).get(member.id)).toMatchObject({
        included: false,
        reason: CohortDecisionReason.ResolvedAfterDeadline,
      });
    });

    it("rejects a blank note, a no-op, a missing decision, and non-staff", async () => {
      const { member, action } = await decidedAction();
      const undecided = await createUser();

      expect(
        (
          await correct({
            actionId: action.id,
            userId: member.id,
            body: { included: false, note: "   " },
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await correct({
            actionId: action.id,
            userId: member.id,
            body: { included: true, note: "Already in" },
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await correct({
            actionId: action.id,
            userId: undecided.id,
            body: { included: true, note: "Not decided" },
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await correct({
            actionId: action.id,
            userId: member.id,
            body: { included: false, note: "Not staff" },
            token: ctx.accessToken,
          })
        ).status,
      ).toBe(401);
      expect((await listDecisions(action.id, ctx.accessToken)).status).toBe(
        401,
      );
      expect((await decisionsFor(action.id)).get(member.id)).toMatchObject({
        included: true,
        reason: CohortDecisionReason.Launch,
      });
    });
  });
});
