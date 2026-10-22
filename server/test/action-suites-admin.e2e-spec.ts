import { milliseconds } from "date-fns";
import request from "supertest";
import type { CreateActionEventDto } from "../src/actions/dto/action.dto";
import { ActionStatus } from "../src/actions/entities/action-event.entity";
import { ActionSuite } from "../src/actions/entities/action-suite.entity";
import { Action } from "../src/actions/entities/action.entity";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Admin action suites (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([]);
  }, 50000);

  afterEach(async () => {
    await ctx.dataSource
      .getRepository(Action)
      .delete({ body: "action-suites-admin e2e" });
    await ctx.dataSource
      .getRepository(ActionSuite)
      .delete({ name: "action-suites-admin e2e" });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const admin = (req: request.Test) =>
    req.set("Authorization", `Bearer ${ctx.adminAccessToken}`);

  const createSuite = async () => {
    const res = await admin(
      request(ctx.app.getHttpServer())
        .post("/actions/createSuite")
        .send({ name: "action-suites-admin e2e" }),
    );
    expect(res.status).toBe(201);
    return res.body;
  };

  it("creates a suite with no actions or events", async () => {
    const created = await createSuite();

    expect(created.actions).toEqual([]);
    expect(created.events).toEqual([]);
  });

  it("adds, lists, and deletes an event across a suite's actions", async () => {
    const suite = await createSuite();
    const actionRepo = ctx.dataSource.getRepository(Action);
    for (const name of ["first", "second"]) {
      await actionRepo.save(
        actionRepo.create({
          name,
          body: "action-suites-admin e2e",
          category: [],
          suite: { id: suite.id },
        }),
      );
    }
    const event: CreateActionEventDto = {
      title: "Suite resolution",
      description: "Suite resolved",
      newStatus: ActionStatus.Resolution,
      date: new Date(Date.now() + milliseconds({ days: 7 })),
    };

    const added = await admin(
      request(ctx.app.getHttpServer())
        .post(`/actions/suite/${suite.id}/events`)
        .send(event),
    );

    expect(added.status).toBe(201);
    expect(added.body.actions).toHaveLength(2);
    expect(added.body.events).toEqual([
      expect.objectContaining({ title: "Suite resolution" }),
    ]);
    for (const action of added.body.actions) {
      expect(action.events).toEqual([
        expect.objectContaining({ title: "Suite resolution" }),
      ]);
    }

    const listed = await admin(
      request(ctx.app.getHttpServer()).get("/actions/suites"),
    );
    expect(listed.status).toBe(200);
    expect(
      listed.body.find(
        (listedSuite: { id: number }) => listedSuite.id === suite.id,
      ),
    ).toMatchObject({ actions: [], events: [] });

    const deleted = await admin(
      request(ctx.app.getHttpServer()).delete(
        `/actions/suite/${suite.id}/events/${added.body.events[0].id}`,
      ),
    );

    expect(deleted.status).toBe(200);
    expect(deleted.body.actions).toHaveLength(2);
    expect(deleted.body.events).toEqual([]);
    expect(
      deleted.body.actions.flatMap(
        (action: { events: unknown[] }) => action.events,
      ),
    ).toEqual([]);
  });
});
