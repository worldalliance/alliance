import { randomUUID } from "node:crypto";
import request from "supertest";
import { ActionCohortDecision } from "../src/actions/entities/action-cohort-decision.entity";
import {
  ActionEvent,
  ActionStatus,
} from "../src/actions/entities/action-event.entity";
import { Action } from "../src/actions/entities/action.entity";
import { CohortDecisionReason } from "../src/actions/entities/cohort-decision-reason";
import { FormulasModule } from "../src/formulas/formulas.module";
import { MemberListsModule } from "../src/member-lists/member-lists.module";
import { SuiteSplit } from "../src/suite-splits/entities/suite-split.entity";
import { GroupFallback } from "../src/suite-splits/split-groups";
import { SuiteSplitsModule } from "../src/suite-splits/suite-splits.module";
import { User } from "../src/user/entities/user.entity";
import {
  closeTestApp,
  createTestApp,
  giveActiveContract,
  type TestContext,
  waitForLockWait,
} from "./e2e-test-utils";
import {
  group,
  optional,
  required,
  suiteSplitFixtures,
} from "./suite-split-fixtures";

const UNDECIDED =
  'This is undecided for members when `maybe` has no value. Pick what happens to those members: "Put them here" or "Continue to the next group".';

describe("Suite splits (e2e)", () => {
  let ctx: TestContext;
  let fx: ReturnType<typeof suiteSplitFixtures>;
  const auth = () => `Bearer ${ctx.adminAccessToken}`;

  beforeAll(async () => {
    ctx = await createTestApp([
      FormulasModule,
      MemberListsModule,
      SuiteSplitsModule,
    ]);
    fx = suiteSplitFixtures(ctx);
  }, 50000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  const member = async (name: string) => {
    const users = ctx.dataSource.getRepository(User);
    const user = await users.save(
      users.create({
        email: `${name}-${randomUUID()}@example.com`,
        password: "pass",
        name,
      }),
    );
    await giveActiveContract(ctx, user.id);
    return user;
  };

  it("converts a suite whose actions have no rules of their own, once", async () => {
    const { suite, actions } = await fx.createSuite(["Call", "Write"]);
    await ctx.dataSource
      .getRepository(Action)
      .update(actions[0].id, { prerequisiteActionIds: [actions[1].id] });
    const refused = await fx.convert(suite.id).expect(400);
    expect(refused.body.message).toContain("Clear them first on: Call.");

    await ctx.dataSource
      .getRepository(Action)
      .update(actions[0].id, { prerequisiteActionIds: [] });
    const converted = await fx.convert(suite.id).expect(201);
    expect(converted.body.groups).toEqual([
      expect.objectContaining({ name: "Everyone else", text: null, cells: [] }),
    ]);
    await fx.convert(suite.id).expect(409);
  });

  it("refuses a group that can be undecided until its fallback is picked", async () => {
    const list = await fx.createList(`Maybe list ${randomUUID()}`, []);
    await fx
      .saveFormulas({
        edits: [
          {
            id: randomUUID(),
            baseVersionId: null,
            name: "maybe",
            text: `isOnList("${list.name}") ? true : null`,
            notes: null,
          },
        ],
      })
      .expect(200);
    const { suite, actions } = await fx.createSuite(["Call"]);
    await fx.convert(suite.id).expect(201);
    const split = await fx.get(suite.id);
    const maybe = group("Maybe", "maybe", [required(actions[0].id)]);

    const refused = await fx
      .save(suite.id, split.versionId, fx.drafts(split, [maybe]))
      .expect(200);
    expect(refused.body.problems).toEqual([
      {
        groupId: maybe.id,
        text: "maybe",
        diagnostics: [{ message: UNDECIDED, start: 0, end: 5 }],
      },
    ]);
    expect((await fx.get(suite.id)).versionId).toBe(split.versionId);

    const saved = await fx
      .save(
        suite.id,
        split.versionId,
        fx.drafts(split, [{ ...maybe, fallback: GroupFallback.Continue }]),
      )
      .expect(200);
    expect(saved.body.problems).toEqual([]);
    expect((await fx.get(suite.id)).groups[0]).toMatchObject({
      name: "Maybe",
      text: "maybe",
      fallback: GroupFallback.Continue,
    });
  });

  it("drops a fallback the condition can't need and sets each action's optional flag from the grid", async () => {
    const { suite, actions, split } = await fx.createSplit({
      actionNames: ["Call", "Write", "Read"],
      groups: ([call, write]) => [
        group(
          "Everyone first",
          "true",
          [optional(call.id), required(write.id)],
          GroupFallback.PutHere,
        ),
      ],
      everyoneElse: ([call, write]) => [optional(call.id), optional(write.id)],
    });
    expect(split.groups[0].fallback).toBeNull();
    const stored = await ctx.dataSource
      .getRepository(Action)
      .findBy({ suite: { id: suite.id } });
    const flag = (id: number) =>
      stored.find((each) => each.id === id)?.optional;
    expect(flag(actions[0].id)).toBe(true);
    expect(flag(actions[1].id)).toBe(false);
    expect(flag(actions[2].id)).toBe(false);
  });

  it("warns about a missing tick, a covered group and an empty group, and saves anyway", async () => {
    const { suite, actions } = await fx.createSuite(["Call"]);
    await fx.convert(suite.id).expect(201);
    const split = await fx.get(suite.id);
    const first = group("First", "true", [required(actions[0].id)]);
    const second = group("Second", "true && false", [required(actions[0].id)]);
    const saved = await fx
      .save(suite.id, split.versionId, fx.drafts(split, [first, second]))
      .expect(200);
    const everyoneElse = split.groups[0].id;
    expect(saved.body.problems).toEqual([]);
    expect(saved.body.warnings).toEqual(
      expect.arrayContaining([
        {
          groupId: second.id,
          message:
            'No member can reach "Second": everyone it matches is placed in "First" first.',
        },
        { groupId: second.id, message: 'No member is in "Second" today.' },
        {
          groupId: everyoneElse,
          message:
            '"Everyone else" has no required work. Tick "This group intentionally has no required work" if that\'s intended.',
        },
      ]),
    );
  });

  it("stores names trimmed, and adds no version for a save that changes nothing", async () => {
    const list = await fx.createList(`Resaved ${randomUUID()}`, []);
    const { suite, split } = await fx.createSplit({
      actionNames: ["Call"],
      groups: ([call]) => [
        group("  Listed ", `isOnList("${list.name}")`, [required(call.id)]),
      ],
    });
    expect(split.groups[0].name).toBe("Listed");
    const unchanged = split.groups.map((each) => ({
      ...each,
      noRequiredWorkTick: each.noRequiredWorkTick !== null,
    }));
    await fx.save(suite.id, split.versionId, unchanged).expect(200);
    expect((await fx.get(suite.id)).versionId).toBe(split.versionId);
  });

  it("refuses a save based on an older version", async () => {
    const { suite, split } = await fx.createSplit({
      actionNames: ["Call"],
      groups: () => [group("Anyone", "true")],
    });
    const stale = split.versionId - 1;
    await fx.save(suite.id, stale, fx.drafts(split, [])).expect(409);
  });

  it("previews where members land, with branches no member took", async () => {
    const [on, off] = [await member("On list"), await member("Off list")];
    const list = await fx.createList(`Preview list ${randomUUID()}`, [on.id]);
    const { suite, actions } = await fx.createSuite(["Call"]);
    await fx.convert(suite.id).expect(201);
    const split = await fx.get(suite.id);
    const listed = group("Listed", `isOnList("${list.name}") ? true : 1 > 2`, [
      required(actions[0].id),
    ]);
    const result = await fx
      .preview(suite.id, fx.drafts(split, [listed]))
      .expect(200);
    const { preview } = result.body;
    expect(preview.groups).toEqual([
      { groupId: listed.id, count: 1 },
      { groupId: split.groups[0].id, count: preview.population - 1 },
    ]);
    expect(preview.byWork.required).toBe(1);
    expect(preview.couldNotDecide).toBe(0);
    expect(preview.untakenBranches).toEqual([]);
    expect(off.id).not.toBe(on.id);

    const nobody = await fx.createList(`Empty list ${randomUUID()}`, []);
    const untaken = await fx
      .preview(
        suite.id,
        fx.drafts(split, [
          group("Nobody", `isOnList("${nobody.name}") ? 1 > 0 : false`),
        ]),
      )
      .expect(200);
    expect(untaken.body.preview.untakenBranches).toEqual([
      { where: "Nobody", text: "1 > 0" },
    ]);
  });

  it("refuses scheduling a split suite, its actions' own rules, and correcting one decision", async () => {
    const { suite, actions } = await fx.createSplit({
      actionNames: ["Call"],
      groups: ([call]) => [group("Anyone", "true", [required(call.id)])],
    });
    const scheduled = await request(ctx.app.getHttpServer())
      .post(`/actions/suite/${suite.id}/events`)
      .set("Authorization", auth())
      .send({
        title: "Launch",
        description: "",
        newStatus: ActionStatus.MemberAction,
        date: new Date(Date.now() + 86_400_000),
      })
      .expect(409);
    expect(scheduled.body.message).toContain("can't launch yet");

    for (const body of [
      { optional: true },
      { cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id } },
    ]) {
      await request(ctx.app.getHttpServer())
        .patch(`/actions/${actions[0].id}`)
        .set("Authorization", auth())
        .send(body)
        .expect(400);
    }

    const decided = await member("Decided");
    await ctx.dataSource.getRepository(ActionCohortDecision).insert({
      actionId: actions[0].id,
      userId: decided.id,
      included: true,
      optional: false,
      reason: CohortDecisionReason.Launch,
      resolvedAt: new Date(),
    });
    await request(ctx.app.getHttpServer())
      .post(
        `/cohort-decisions/action/${actions[0].id}/user/${decided.id}/correction`,
      )
      .set("Authorization", auth())
      .send({ included: false, note: "wrong group" })
      .expect(409);
  });

  it("refuses scheduling a suite that started using groups while the schedule waited", async () => {
    const { suite } = await fx.createSuite(["Call"]);
    const converting = ctx.dataSource.createQueryRunner();
    await converting.startTransaction();
    try {
      await converting.query(
        "SELECT id FROM action_suite WHERE id = $1 FOR UPDATE",
        [suite.id],
      );
      const scheduled = request(ctx.app.getHttpServer())
        .post(`/actions/suite/${suite.id}/events`)
        .set("Authorization", auth())
        .send({
          title: "Launch",
          description: "",
          newStatus: ActionStatus.MemberAction,
          date: new Date(Date.now() + 86_400_000),
        })
        .then((response) => response.status);
      await waitForLockWait(ctx.dataSource);
      await converting.manager.insert(SuiteSplit, { suiteId: suite.id });
      await converting.commitTransaction();
      expect(await scheduled).toBe(409);
    } finally {
      if (converting.isTransactionActive) {
        await converting.rollbackTransaction();
      }
      await converting.release();
    }
  });

  it("leaves out the cells of an action that moved out, so the next save goes through", async () => {
    const { suite, actions } = await fx.createSplit({
      actionNames: ["Call", "Write"],
      groups: ([call, write]) => [
        group("Anyone", "true", [required(call.id), required(write.id)]),
      ],
    });
    const { suite: other } = await fx.createSuite([]);
    await request(ctx.app.getHttpServer())
      .patch(`/actions/${actions[1].id}`)
      .set("Authorization", auth())
      .send({ suiteId: other.id })
      .expect(200);

    const split = await fx.get(suite.id);
    expect(split.groups[0].cells).toEqual([required(actions[0].id)]);
    await fx
      .save(
        suite.id,
        split.versionId,
        split.groups.map((each) => ({ ...each, noRequiredWorkTick: false })),
      )
      .expect(200);
  });

  it("lapses a tick when an action moving out changes the group's work, so the next save warns", async () => {
    const { suite, actions, split } = await fx.createSplit({
      actionNames: ["Call", "Write"],
      groups: () => [],
      everyoneElse: ([, write]) => [optional(write.id)],
    });
    const ticked = await fx
      .save(suite.id, split.versionId, [
        { ...split.groups[0], noRequiredWorkTick: true },
      ])
      .expect(200);
    const noRequiredWork = {
      groupId: split.groups[0].id,
      message:
        '"Everyone else" has no required work. Tick "This group intentionally has no required work" if that\'s intended.',
    };
    expect(ticked.body.warnings).not.toContainEqual(noRequiredWork);
    const { suite: other } = await fx.createSuite([]);
    await request(ctx.app.getHttpServer())
      .patch(`/actions/${actions[1].id}`)
      .set("Authorization", auth())
      .send({ suiteId: other.id })
      .expect(200);

    const moved = await fx.get(suite.id);
    expect(moved.groups[0].noRequiredWorkTick).toBeNull();
    const resaved = await fx
      .save(suite.id, moved.versionId, [
        { ...moved.groups[0], noRequiredWorkTick: false },
      ])
      .expect(200);
    expect(resaved.body.warnings).toContainEqual(noRequiredWork);
  });

  it("gives an action moved in the grid's optional flag, and refuses its own rules or launch", async () => {
    const { suite } = await fx.createSplit({
      actionNames: [],
      groups: () => [group("Anyone", "true")],
    });
    const {
      actions: [flagged, ruled, scheduled],
    } = await fx.createSuite(["Flagged", "Ruled", "Scheduled"]);
    const actionRepo = ctx.dataSource.getRepository(Action);
    await actionRepo.update(flagged.id, { optional: true });
    await actionRepo.update(ruled.id, {
      cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
    });
    await ctx.dataSource.getRepository(ActionEvent).save({
      title: "Members act",
      description: "Member phase",
      newStatus: ActionStatus.MemberAction,
      date: new Date(Date.now() + 86_400_000),
      action: { id: scheduled.id },
    });
    const move = (actionId: number) =>
      request(ctx.app.getHttpServer())
        .patch(`/actions/${actionId}`)
        .set("Authorization", auth())
        .send({ suiteId: suite.id });

    await move(flagged.id).expect(200);
    expect(
      (await actionRepo.findOneByOrFail({ id: flagged.id })).optional,
    ).toBe(false);
    await move(ruled.id).expect(400);
    await move(scheduled.id).expect(409);
  });
});
