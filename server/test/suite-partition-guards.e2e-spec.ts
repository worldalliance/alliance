import { addDays } from "date-fns";
import request from "supertest";
import { ActionStatus } from "../src/actions/entities/action-event.entity";
import { Action } from "../src/actions/entities/action.entity";
import { Project } from "../src/actions/entities/project.entity";
import { SuitePartitionsModule } from "../src/suite-partitions/suite-partitions.module";
import { createActionAsAdmin, patchActionAsAdmin } from "./action-requests";
import {
  closeTestApp,
  createTestApp,
  type TestContext,
  waitForLockWait,
} from "./e2e-test-utils";
import {
  optional,
  part,
  required,
  suitePartitionFixtures,
} from "./suite-partition-fixtures";

const launchEvent = () => ({
  title: "Members act",
  description: "",
  newStatus: ActionStatus.MemberAction,
  date: addDays(new Date(), 1).toISOString(),
});

describe("Suite partition write guards (e2e)", () => {
  let ctx: TestContext;
  let fx: ReturnType<typeof suitePartitionFixtures>;
  const server = () => ctx.app.getHttpServer();
  const auth = () => `Bearer ${ctx.adminAccessToken}`;
  const optionalOf = async (id: number) =>
    (await ctx.dataSource.getRepository(Action).findOneByOrFail({ id }))
      .optional;

  beforeAll(async () => {
    ctx = await createTestApp([SuitePartitionsModule]);
    fx = suitePartitionFixtures(ctx);
  }, 50000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  const emptyPartition = () =>
    fx.createPartition({
      actionNames: [],
      parts: () => [part("Anyone", "true")],
    });

  it("gives an action created in a partitioned suite the grid's optional flag, and refuses its own rule", async () => {
    const { suite } = await emptyPartition();
    const created = await createActionAsAdmin(ctx, {
      name: "Created",
      suiteId: suite.id,
      optional: true,
    }).expect(201);
    expect(created.body.optional).toBe(false);
    expect(await optionalOf(created.body.id)).toBe(false);

    await createActionAsAdmin(ctx, {
      name: "Ruled",
      suiteId: suite.id,
      cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
    }).expect(400);
  });

  it("gives an action imported into a partitioned suite the grid's optional flag, and refuses its own rule or launch", async () => {
    const { suite } = await emptyPartition();
    const source = await createActionAsAdmin(ctx, { name: "Source" }).expect(
      201,
    );
    const exported = (
      await request(server())
        .get(`/actions/export/${source.body.id}`)
        .set("Authorization", auth())
        .expect(200)
    ).body;
    const importAs = (changes: Record<string, unknown>) =>
      request(server())
        .post("/actions/pasteJson")
        .set("Authorization", auth())
        .send({
          body: JSON.stringify({
            ...exported,
            suite: { name: suite.name },
            ...changes,
          }),
        });

    const imported = await importAs({ optional: true }).expect(201);
    expect(await optionalOf(imported.body.id)).toBe(false);
    await importAs({
      cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
    }).expect(400);
    await importAs({ events: [launchEvent()] }).expect(409);
  });

  it("refuses a suite-wide event edit that launches a partitioned suite", async () => {
    const { suite } = await emptyPartition();
    const created = await createActionAsAdmin(ctx, {
      name: "Edited",
      suiteId: suite.id,
    }).expect(201);
    const added = await request(server())
      .post(`/actions/suite/${suite.id}/events`)
      .set("Authorization", auth())
      .send({ ...launchEvent(), newStatus: ActionStatus.OfficeAction })
      .expect(201);
    const event = added.body.actions
      .find((action: { id: number }) => action.id === created.body.id)
      .events.find(
        (each: { newStatus: string }) =>
          each.newStatus === ActionStatus.OfficeAction,
      );

    await request(server())
      .patch(`/actions/suite/${suite.id}/batchUpdateSuiteEvents/${event.id}`)
      .set("Authorization", auth())
      .send({ newStatus: ActionStatus.MemberAction })
      .expect(409);
  });

  it("refuses scheduling the release of a project action whose suite uses parts", async () => {
    const project = await ctx.dataSource
      .getRepository(Project)
      .save({ name: "Partition project" });
    const created = await request(server())
      .post(`/projects/${project.id}/actions`)
      .set("Authorization", auth())
      .send({ name: "Step", shortDescription: "Step short" })
      .expect(201);
    await patchActionAsAdmin(ctx, created.body.id, {
      cohortExpression: null,
    }).expect(200);
    const { suite } = await ctx.dataSource.getRepository(Action).findOneOrFail({
      where: { id: created.body.id },
      relations: { suite: true },
    });
    if (!suite) throw new Error("project action has no suite");
    await fx.convert(suite.id).expect(201);

    await request(server())
      .post(`/actions/${created.body.id}/release`)
      .set("Authorization", auth())
      .send({ launch: launchEvent(), reminders: [] })
      .expect(409);
  });

  it("leaves the flag of an action moved out of the suite while a save waits on it", async () => {
    const { suite, actions, partition } = await fx.createPartition({
      actionNames: ["Call"],
      parts: ([call]) => [part("Anyone", "true", [required(call.id)])],
    });
    const [call] = actions;
    const { suite: other } = await fx.createSuite([]);
    const move = ctx.dataSource.createQueryRunner();
    await move.startTransaction();
    try {
      await move.manager.update(Action, call.id, {
        suite: { id: other.id },
        optional: false,
      });
      const saving = fx
        .save(
          suite.id,
          partition.versionId,
          fx.drafts(partition, [
            {
              ...partition.parts[0],
              noRequiredWorkTick: false,
              cells: [optional(call.id)],
            },
          ]),
        )
        .then((response) => response);
      await waitForLockWait(ctx.dataSource);
      await move.commitTransaction();
      expect((await saving).status).toBe(200);
    } finally {
      await move.release();
    }
    expect(await optionalOf(call.id)).toBe(false);
  });

  it("locks the suite before the action on an edit that leaves the suite alone", async () => {
    const { suite, actions } = await fx.createPartition({
      actionNames: ["Call"],
      parts: ([call]) => [part("Anyone", "true", [required(call.id)])],
    });
    const [call] = actions;
    const save = ctx.dataSource.createQueryRunner();
    await save.startTransaction();
    try {
      await save.query(`SELECT 1 FROM action_suite WHERE id = $1 FOR UPDATE`, [
        suite.id,
      ]);
      const editing = patchActionAsAdmin(ctx, call.id, {
        name: "Call members",
      }).then((response) => response);
      await waitForLockWait(ctx.dataSource);
      await save.query(`SELECT 1 FROM action WHERE id = $1 FOR UPDATE NOWAIT`, [
        call.id,
      ]);
      await save.commitTransaction();
      expect((await editing).status).toBe(200);
    } finally {
      if (save.isTransactionActive) await save.rollbackTransaction();
      await save.release();
    }
  });
});
