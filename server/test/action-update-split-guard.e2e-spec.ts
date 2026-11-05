import {
  ActionUpdate,
  ActionUpdateNotificationMode,
} from "src/actions/entities/action-update.entity";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
import request from "supertest";
import { UnsplitCollectiveResultToNonCompleters1793827479825 } from "../migrations/1793827479825-UnsplitCollectiveResultToNonCompleters";
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

  it("carries unsplit rows' collective result over to non-completers", async () => {
    const repo = ctx.dataSource.getRepository(ActionUpdate);
    const unsplitRow = async (
      fields: Partial<
        Pick<
          ActionUpdate,
          "shortNotifString" | "nonCompleterResult" | "notificationMode"
        >
      >,
    ) => {
      const id = await createUpdate({ nonCompleterResult: "split text" });
      await repo.update(id, { splitCollectiveResult: false, ...fields });
      return id;
    };
    const unsplit = await unsplitRow({
      shortNotifString: "We won",
      nonCompleterResult: "stale",
    });
    const empty = await unsplitRow({ shortNotifString: "" });
    const split = await createUpdate({ nonCompleterResult: "split text" });
    const legacy = await unsplitRow({
      notificationMode: ActionUpdateNotificationMode.Legacy,
    });

    const queryRunner = ctx.dataSource.createQueryRunner();
    await new UnsplitCollectiveResultToNonCompleters1793827479825().up(
      queryRunner,
    );
    await queryRunner.release();

    const read = (id: number) => repo.findOneByOrFail({ id });
    expect(await read(unsplit)).toMatchObject({
      splitCollectiveResult: true,
      nonCompleterResult: "We won",
      uninvolvedResult: "We won",
    });
    expect(await read(empty)).toMatchObject({
      splitCollectiveResult: true,
      nonCompleterResult: null,
      uninvolvedResult: null,
    });
    expect(await read(split)).toMatchObject({
      splitCollectiveResult: true,
      nonCompleterResult: "split text",
    });
    expect(await read(legacy)).toMatchObject({
      splitCollectiveResult: false,
      nonCompleterResult: "split text",
    });
  });
});
