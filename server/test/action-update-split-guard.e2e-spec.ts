import {
  ActionUpdate,
  ActionUpdateNotificationMode,
} from "src/actions/entities/action-update.entity";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
import request from "supertest";
import { createTestApp, type TestContext } from "./e2e-test-utils";

describe("action update split guard (e2e)", () => {
  let ctx: TestContext;
  let action: Action;

  const admin = (
    method: "post" | "patch",
    path: string,
    body?: Record<string, unknown>,
  ) =>
    request(ctx.app.getHttpServer())
      [method](path)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send(body);

  const createUpdate = async (body: Record<string, unknown> = {}) => {
    const created = await admin("post", `/actions/createUpdate/${action.id}`, {
      title: "Recognition",
      shortNotifString: "a hearing on the bill",
      nonCompleterResult: "a hearing on the bill",
      date: new Date().toISOString(),
      notifyType: "none",
      ...body,
    }).expect(201);
    const id: number = created.body.id;
    return id;
  };

  beforeAll(async () => {
    ctx = await createTestApp([]);
    action = await ctx.dataSource.getRepository(Action).save({
      name: "Write to your representative",
      category: [],
      body: "Body",
      shortDescription: "Short",
      visibilityMode: VisibilityMode.Public,
      cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
    });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("creates the didn't-complete text in the split shape older servers read", async () => {
    const id = await createUpdate({ nonCompleterResult: "without you" });
    expect(
      await ctx.dataSource.getRepository(ActionUpdate).findOneByOrFail({ id }),
    ).toMatchObject({
      splitCollectiveResult: true,
      uninvolvedResult: "without you",
    });
  });

  it("accepts an older admin bundle's split save when its two texts match", async () => {
    const id = await createUpdate({
      splitCollectiveResult: true,
      nonCompleterResult: "without you",
      uninvolvedResult: "without you",
    });
    const read = () =>
      ctx.dataSource.getRepository(ActionUpdate).findOneByOrFail({ id });
    expect((await read()).uninvolvedResult).toBe("without you");

    await admin("patch", `/actions/updateUpdate/${id}`, {
      splitCollectiveResult: true,
      nonCompleterResult: "after you",
      uninvolvedResult: "after you",
    }).expect(200);
    expect(await read()).toMatchObject({
      splitCollectiveResult: true,
      nonCompleterResult: "after you",
      uninvolvedResult: "after you",
    });
  });

  it("refuses an older admin bundle's separate uninvolved text", async () => {
    const differing = {
      splitCollectiveResult: true,
      nonCompleterResult: "without you",
      uninvolvedResult: "not involved",
    };
    await admin("post", `/actions/createUpdate/${action.id}`, {
      title: "Recognition",
      shortNotifString: "a hearing on the bill",
      date: new Date().toISOString(),
      notifyType: "none",
      ...differing,
    })
      .expect(400)
      .expect(({ body }) =>
        expect(body.message).toEqual(["Reload the admin to save this update."]),
      );
    const id = await createUpdate();
    await admin("patch", `/actions/updateUpdate/${id}`, differing).expect(400);
  });

  it("refuses an unsplit collective result", async () => {
    await admin("post", `/actions/createUpdate/${action.id}`, {
      title: "Recognition",
      shortNotifString: "a hearing on the bill",
      splitCollectiveResult: false,
      nonCompleterResult: "without you",
      uninvolvedResult: "not involved",
      date: new Date().toISOString(),
      notifyType: "none",
    })
      .expect(400)
      .expect(({ body }) =>
        expect(body.message).toEqual(["Reload the admin to save this update."]),
      );
    const id = await createUpdate();
    for (const splitCollectiveResult of [false, null]) {
      await admin("patch", `/actions/updateUpdate/${id}`, {
        splitCollectiveResult,
      }).expect(400);
    }
  });

  it("marks an unsplit row split when an edit sets its didn't-complete text", async () => {
    const id = await createUpdate();
    const repo = ctx.dataSource.getRepository(ActionUpdate);
    await repo.update(id, { splitCollectiveResult: false });
    await admin("patch", `/actions/updateUpdate/${id}`, {
      nonCompleterResult: "without you",
    }).expect(200);
    expect(await repo.findOneByOrFail({ id })).toMatchObject({
      splitCollectiveResult: true,
      nonCompleterResult: "without you",
      uninvolvedResult: "without you",
    });

    await admin("patch", `/actions/updateUpdate/${id}`, {
      nonCompleterResult: null,
    }).expect(200);
    expect((await repo.findOneByOrFail({ id })).uninvolvedResult).toBeNull();
  });

  it("leaves a legacy row unsplit when an edit sets its didn't-complete text", async () => {
    const id = await createUpdate();
    const repo = ctx.dataSource.getRepository(ActionUpdate);
    await repo.update(id, {
      notificationMode: ActionUpdateNotificationMode.Legacy,
      splitCollectiveResult: false,
    });
    await admin("patch", `/actions/updateUpdate/${id}`, {
      nonCompleterResult: "without you",
    }).expect(200);
    expect((await repo.findOneByOrFail({ id })).splitCollectiveResult).toBe(
      false,
    );
  });

  it("returns the split fields an older admin bundle seeds its edit form from", async () => {
    const id = await createUpdate({ nonCompleterResult: "without you" });
    await ctx.dataSource
      .getRepository(ActionUpdate)
      .update(id, { uninvolvedResult: "stale" });
    const saved = await admin("patch", `/actions/updateUpdate/${id}`, {
      title: "Renamed",
    }).expect(200);
    expect(saved.body).toMatchObject({
      splitCollectiveResult: true,
      uninvolvedResult: "without you",
    });
  });
});
