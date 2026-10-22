import request from "supertest";
import type { Repository } from "typeorm";
import { CohortDecisionService } from "../src/actions/cohort-decision.service";
import {
  ActionEvent,
  ActionStatus,
} from "../src/actions/entities/action-event.entity";
import { ActionSuite } from "../src/actions/entities/action-suite.entity";
import { Action } from "../src/actions/entities/action.entity";
import { CohortDecisionReason } from "../src/actions/entities/cohort-decision-reason";
import { TasksModule } from "../src/tasks/tasks.module";
import {
  addDays,
  cohortDecisionFixtures,
  type CohortDecisionFixtures,
} from "./cohort-decision-fixtures";
import { createTestApp, signAccessToken, TestContext } from "./e2e-test-utils";

describe("Cohort decision staff tooling (e2e)", () => {
  let ctx: TestContext;
  let service: CohortDecisionService;
  let actionRepo: Repository<Action>;
  let eventRepo: Repository<ActionEvent>;
  let suiteRepo: Repository<ActionSuite>;
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
    eventRepo = ctx.dataSource.getRepository(ActionEvent);
    suiteRepo = ctx.dataSource.getRepository(ActionSuite);
    ({ createUser, createAction, decisionsFor, cleanUp } =
      cohortDecisionFixtures(ctx));
  }, 50000);

  afterEach(async () => {
    await cleanUp();
    await suiteRepo.query("DELETE FROM action_suite");
  });

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

  describe("schedule changes", () => {
    const addEvent = (params: {
      actionId: number;
      date: Date;
      acknowledge?: boolean;
    }) =>
      request(ctx.app.getHttpServer())
        .post(`/actions/${params.actionId}/events`)
        .query(
          params.acknowledge ? { acknowledgeDeadlineShortening: true } : {},
        )
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          title: "Resolution",
          description: "",
          newStatus: ActionStatus.Resolution,
          date: params.date.toISOString(),
        });

    const moveSuiteEvent = async (params: {
      actionId: number;
      status: ActionStatus;
      date: Date;
      acknowledge?: boolean;
    }) => {
      const suite = await suiteRepo.save({ name: "Suite" });
      await actionRepo.update(params.actionId, { suite: { id: suite.id } });
      const event = await eventRepo.findOneByOrFail({
        action: { id: params.actionId },
        newStatus: params.status,
      });
      return request(ctx.app.getHttpServer())
        .patch(`/actions/suite/${suite.id}/batchUpdateSuiteEvents/${event.id}`)
        .query(
          params.acknowledge ? { acknowledgeDeadlineShortening: true } : {},
        )
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ date: params.date.toISOString() });
    };

    const deadlineOf = async (actionId: number) =>
      (
        await actionRepo.findOneOrFail({
          where: { id: actionId },
          relations: { events: true },
        })
      ).memberActionPhase.deadlineEvent?.date;

    it("asks before moving an assigned action's deadline earlier", async () => {
      const member = await createUser({ signedAt });
      const action = await createAction({
        start: addDays(now, -1),
        deadline: addDays(now, 5),
      });
      await service.resolveAll(now);
      const earlier = addDays(now, 2);

      const refused = await addEvent({ actionId: action.id, date: earlier });

      expect(refused.status).toBe(409);
      expect(refused.body.message).toContain('"Action" (1 assigned)');
      expect(await deadlineOf(action.id)).toEqual(addDays(now, 5));

      const acknowledged = await addEvent({
        actionId: action.id,
        date: earlier,
        acknowledge: true,
      });

      expect(acknowledged.status).toBe(201);
      expect(await deadlineOf(action.id)).toEqual(earlier);
      expect((await decisionsFor(action.id)).get(member.id)).toMatchObject({
        included: true,
        reason: CohortDecisionReason.Launch,
      });
    });

    it("asks before a suite edit moves an assigned action's deadline earlier", async () => {
      await createUser({ signedAt });
      const action = await createAction({
        start: addDays(now, -1),
        deadline: addDays(now, 5),
      });
      await service.resolveAll(now);

      const refused = await moveSuiteEvent({
        actionId: action.id,
        status: ActionStatus.Resolution,
        date: addDays(now, 2),
      });

      expect(refused.status).toBe(409);
      expect(await deadlineOf(action.id)).toEqual(addDays(now, 5));

      const acknowledged = await moveSuiteEvent({
        actionId: action.id,
        status: ActionStatus.Resolution,
        date: addDays(now, 2),
        acknowledge: true,
      });

      expect(acknowledged.status).toBe(200);
      expect(await deadlineOf(action.id)).toEqual(addDays(now, 2));
    });

    it("asks before a new suite event moves an assigned action's deadline earlier", async () => {
      await createUser({ signedAt });
      const action = await createAction({
        start: addDays(now, -1),
        deadline: addDays(now, 5),
      });
      await service.resolveAll(now);
      const suite = await suiteRepo.save({ name: "Suite" });
      await actionRepo.update(action.id, { suite: { id: suite.id } });
      const addSuiteEvent = (acknowledge: boolean) =>
        request(ctx.app.getHttpServer())
          .post(`/actions/suite/${suite.id}/events`)
          .query(acknowledge ? { acknowledgeDeadlineShortening: true } : {})
          .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
          .send({
            title: "Resolution",
            description: "",
            newStatus: ActionStatus.Resolution,
            date: addDays(now, 2).toISOString(),
          });

      expect((await addSuiteEvent(false)).status).toBe(409);
      expect(await deadlineOf(action.id)).toEqual(addDays(now, 5));
      expect((await addSuiteEvent(true)).status).toBe(201);
      expect(await deadlineOf(action.id)).toEqual(addDays(now, 2));
    });

    it("asks when a suite edit targets an assigned action outside the suite", async () => {
      await createUser({ signedAt });
      const action = await createAction({
        start: addDays(now, -1),
        deadline: addDays(now, 5),
      });
      await service.resolveAll(now);
      const suite = await suiteRepo.save({ name: "Other suite" });
      const event = await eventRepo.findOneByOrFail({
        action: { id: action.id },
        newStatus: ActionStatus.Resolution,
      });

      const refused = await request(ctx.app.getHttpServer())
        .patch(`/actions/suite/${suite.id}/batchUpdateSuiteEvents/${event.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ date: addDays(now, 2).toISOString() });

      expect(refused.status).toBe(409);
      expect(await deadlineOf(action.id)).toEqual(addDays(now, 5));
    });

    it("moves a deadline earlier without asking when nobody is assigned", async () => {
      await createUser({ signedAt, tagged: false });
      const action = await createAction({
        start: addDays(now, -1),
        deadline: addDays(now, 5),
      });
      await service.resolveAll(now);

      expect(
        (await addEvent({ actionId: action.id, date: addDays(now, 2) })).status,
      ).toBe(201);
    });

    it("extends a deadline without asking", async () => {
      await createUser({ signedAt });
      const action = await createAction({
        start: addDays(now, -1),
        deadline: addDays(now, 5),
      });
      await service.resolveAll(now);

      const extended = await moveSuiteEvent({
        actionId: action.id,
        status: ActionStatus.Resolution,
        date: addDays(now, 8),
      });

      expect(extended.status).toBe(200);
      expect(await deadlineOf(action.id)).toEqual(addDays(now, 8));
    });

    it("reopens a closed action, keeping its decisions and admitting later signers as optional", async () => {
      const assigned = await createUser({ signedAt });
      const excluded = await createUser({ signedAt, tagged: false });
      const action = await createAction({
        start: addDays(now, -5),
        deadline: addDays(now, -2),
      });
      await service.resolveAll(addDays(now, -3));
      const lateSigner = await createUser({ signedAt: addDays(now, -1) });

      const reopened = await moveSuiteEvent({
        actionId: action.id,
        status: ActionStatus.Resolution,
        date: addDays(now, 3),
      });
      await service.resolveAll(now);

      expect(reopened.status).toBe(200);
      const decisions = await decisionsFor(action.id);
      expect(decisions.get(assigned.id)).toEqual(
        expect.objectContaining({
          included: true,
          resolvedAt: addDays(now, -3),
        }),
      );
      expect(decisions.get(excluded.id)).toEqual(
        expect.objectContaining({
          included: false,
          resolvedAt: addDays(now, -3),
        }),
      );
      expect(decisions.get(lateSigner.id)).toMatchObject({
        included: true,
        reason: CohortDecisionReason.Signing,
      });
      const viewed = await request(ctx.app.getHttpServer())
        .get(`/actions/slug/${action.id}`)
        .set(
          "Authorization",
          `Bearer ${signAccessToken(ctx.jwtService, lateSigner)}`,
        );
      expect(viewed.status).toBe(200);
      expect(viewed.body.viewer).toMatchObject({
        assigned: true,
        optional: true,
        optionalReason: "contract_gap",
      });
    });

    it("keeps decisions when the start moves", async () => {
      const member = await createUser({ signedAt });
      const action = await createAction({
        start: addDays(now, -1),
        deadline: addDays(now, 5),
      });
      await service.resolveAll(now);

      const moved = await moveSuiteEvent({
        actionId: action.id,
        status: ActionStatus.MemberAction,
        date: addDays(now, 1),
      });
      await service.resolveAll(addDays(now, 2));

      expect(moved.status).toBe(200);
      expect((await decisionsFor(action.id)).get(member.id)).toEqual(
        expect.objectContaining({
          included: true,
          reason: CohortDecisionReason.Launch,
          resolvedAt: now,
        }),
      );
    });
  });
});
