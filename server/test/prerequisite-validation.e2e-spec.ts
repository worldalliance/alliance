import request from "supertest";
import type { Repository } from "typeorm";
import {
  ActionEvent,
  ActionStatus,
} from "../src/actions/entities/action-event.entity";
import { ActionSuite } from "../src/actions/entities/action-suite.entity";
import { Action } from "../src/actions/entities/action.entity";
import {
  assertNotAPrerequisite,
  assertPrerequisitesValid,
} from "../src/actions/prerequisite-validation";
import { TasksModule } from "../src/tasks/tasks.module";
import {
  addDays,
  cohortDecisionFixtures,
  type CohortDecisionFixtures,
} from "./cohort-decision-fixtures";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Prerequisite validation (e2e)", () => {
  let ctx: TestContext;
  let actionRepo: Repository<Action>;
  let eventRepo: Repository<ActionEvent>;
  let suiteRepo: Repository<ActionSuite>;
  let createAction: CohortDecisionFixtures["createAction"];
  let cleanUp: CohortDecisionFixtures["cleanUp"];

  const now = new Date();

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    actionRepo = ctx.dataSource.getRepository(Action);
    eventRepo = ctx.dataSource.getRepository(ActionEvent);
    suiteRepo = ctx.dataSource.getRepository(ActionSuite);
    ({ createAction, cleanUp } = cohortDecisionFixtures(ctx));
  }, 50000);

  afterEach(async () => {
    await cleanUp();
    await suiteRepo.query("DELETE FROM action_suite");
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const admin = () => `Bearer ${ctx.adminAccessToken}`;

  const patchAction = (actionId: number, body: object) =>
    request(ctx.app.getHttpServer())
      .patch(`/actions/${actionId}`)
      .set("Authorization", admin())
      .send(body);

  const prerequisitesOf = async (actionId: number) =>
    (await actionRepo.findOneByOrFail({ id: actionId })).prerequisiteActionIds;

  const deadlineOf = async (actionId: number) =>
    (
      await actionRepo.findOneOrFail({
        where: { id: actionId },
        relations: { events: true },
      })
    ).memberActionPhase.deadlineEvent?.date;

  const createPair = async () => {
    const upstream = await createAction({
      start: addDays(now, -3),
      deadline: addDays(now, 1),
    });
    const downstream = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
      prerequisiteActionIds: [upstream.id],
    });
    return { upstream, downstream };
  };

  const inSuite = async (actionIds: number[]) => {
    const suite = await suiteRepo.save({ name: "Suite" });
    for (const id of actionIds) {
      await actionRepo.update(id, { suite: { id: suite.id } });
    }
    return suite;
  };

  it("saves prerequisites and returns them to admins", async () => {
    const upstream = await createAction({
      start: addDays(now, -3),
      deadline: addDays(now, 1),
    });
    const downstream = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
    });

    const response = await patchAction(downstream.id, {
      prerequisiteActionIds: [upstream.id],
    });

    expect(response.status).toBe(200);
    expect(response.body.prerequisiteActionIds).toEqual([upstream.id]);
    expect(await prerequisitesOf(downstream.id)).toEqual([upstream.id]);
  });

  it("rejects a prerequisite without a deadline", async () => {
    const upstream = await createAction({
      start: addDays(now, -3),
      deadline: null,
    });
    const downstream = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
    });

    const response = await patchAction(downstream.id, {
      prerequisiteActionIds: [upstream.id],
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("needs a deadline");
    expect(await prerequisitesOf(downstream.id)).toEqual([]);
  });

  it("rejects a prerequisite due after its dependent", async () => {
    const upstream = await createAction({
      start: addDays(now, -3),
      deadline: addDays(now, 5),
    });
    const downstream = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
    });

    const response = await patchAction(downstream.id, {
      prerequisiteActionIds: [upstream.id],
    });

    expect(response.status).toBe(400);
    expect(await prerequisitesOf(downstream.id)).toEqual([]);
  });

  it("rejects a cycle", async () => {
    const { upstream, downstream } = await createPair();

    const response = await patchAction(upstream.id, {
      prerequisiteActionIds: [downstream.id],
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("can't loop");
    expect(await prerequisitesOf(upstream.id)).toEqual([]);
  });

  it("rejects creating an action that waits for one without a deadline", async () => {
    const upstream = await createAction({
      start: addDays(now, -3),
      deadline: null,
    });

    const response = await request(ctx.app.getHttpServer())
      .post("/actions/create")
      .set("Authorization", admin())
      .send({
        name: "Downstream",
        category: [],
        body: "Body",
        shortDescription: "Short",
        visibilityMode: "public",
        isContractSigningAction: false,
        priority: 0,
        prerequisiteActionIds: [upstream.id],
      });

    expect(response.status).toBe(400);
    expect(await actionRepo.count()).toBe(1);
  });

  it("rejects an event that brings a dependent's deadline before its prerequisite's", async () => {
    const { downstream } = await createPair();

    const response = await request(ctx.app.getHttpServer())
      .post(`/actions/${downstream.id}/events`)
      .set("Authorization", admin())
      .send({
        title: "Resolution",
        description: "",
        newStatus: ActionStatus.Resolution,
        date: addDays(now, 0.5).toISOString(),
      });

    expect(response.status).toBe(400);
    expect(await deadlineOf(downstream.id)).toEqual(addDays(now, 3));
  });

  it("rejects a suite edit that moves a prerequisite's deadline past its dependent's", async () => {
    const { upstream } = await createPair();
    const suite = await inSuite([upstream.id]);
    const event = await eventRepo.findOneByOrFail({
      action: { id: upstream.id },
      newStatus: ActionStatus.Resolution,
    });

    const response = await request(ctx.app.getHttpServer())
      .patch(`/actions/suite/${suite.id}/batchUpdateSuiteEvents/${event.id}`)
      .set("Authorization", admin())
      .send({ date: addDays(now, 4).toISOString() });

    expect(response.status).toBe(400);
    expect(await deadlineOf(upstream.id)).toEqual(addDays(now, 1));
  });

  it("rejects deleting a prerequisite's deadline", async () => {
    const { upstream } = await createPair();
    const suite = await inSuite([upstream.id]);
    const event = await eventRepo.findOneByOrFail({
      action: { id: upstream.id },
      newStatus: ActionStatus.Resolution,
    });
    await eventRepo.update(event.id, { suiteManaged: true });

    const response = await request(ctx.app.getHttpServer())
      .delete(`/actions/suite/${suite.id}/events/${event.id}`)
      .set("Authorization", admin());

    expect(response.status).toBe(400);
    expect(await deadlineOf(upstream.id)).toEqual(addDays(now, 1));
  });

  it("rejects deleting an action others wait for", async () => {
    const { upstream } = await createPair();

    const response = await request(ctx.app.getHttpServer())
      .delete(`/actions/${upstream.id}`)
      .set("Authorization", admin());

    expect(response.status).toBe(400);
    expect(await actionRepo.existsBy({ id: upstream.id })).toBe(true);
  });

  it("makes a delete wait for a concurrent edge onto the deleted action", async () => {
    const upstream = await createAction({
      start: addDays(now, -3),
      deadline: addDays(now, 1),
    });
    const downstream = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
    });
    const adding = ctx.dataSource.createQueryRunner();
    const deleting = ctx.dataSource.createQueryRunner();
    try {
      await adding.startTransaction();
      await deleting.startTransaction();
      await adding.manager.update(Action, downstream.id, {
        prerequisiteActionIds: [upstream.id],
      });
      await assertPrerequisitesValid({
        em: adding.manager,
        actionIds: [downstream.id],
      });
      const deleteCheck = assertNotAPrerequisite({
        em: deleting.manager,
        actionId: upstream.id,
      });
      const settled = deleteCheck.then(
        () => "settled",
        () => "settled",
      );
      const waiting = new Promise((resolve) =>
        setTimeout(() => resolve("waiting"), 500),
      );
      expect(await Promise.race([settled, waiting])).toBe("waiting");
      await adding.commitTransaction();

      await expect(deleteCheck).rejects.toThrow("is a prerequisite of");
    } finally {
      for (const runner of [adding, deleting]) {
        if (runner.isTransactionActive) await runner.rollbackTransaction();
        await runner.release();
      }
    }
  });
});
