import { ExceptionEvent } from "@alliance/common/analytics";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { CohortDecisionService } from "../src/actions/cohort-decision.service";
import { ActionCohortDecision } from "../src/actions/entities/action-cohort-decision.entity";
import {
  ActionEvent,
  ActionStatus,
} from "../src/actions/entities/action-event.entity";
import { Action, parseAction } from "../src/actions/entities/action.entity";
import { CohortDecisionReason } from "../src/actions/entities/cohort-decision-reason";
import { MemberActionsService } from "../src/actions/member-actions.service";
import { FormulasModule } from "../src/formulas/formulas.module";
import { MemberListVersion } from "../src/member-lists/entities/member-list-version.entity";
import { MemberList } from "../src/member-lists/entities/member-list.entity";
import { MemberListsModule } from "../src/member-lists/member-lists.module";
import { PosthogService } from "../src/posthog/posthog.service";
import { SuiteSplitPin } from "../src/suite-splits/entities/suite-split-pin.entity";
import { SuiteSplitPlacement } from "../src/suite-splits/entities/suite-split-placement.entity";
import { SuiteSplitVersion } from "../src/suite-splits/entities/suite-split-version.entity";
import { TraceOutcome } from "../src/suite-splits/split-resolve";
import { SuiteSplitsModule } from "../src/suite-splits/suite-splits.module";
import { TasksModule } from "../src/tasks/tasks.module";
import { addDays, cohortDecisionFixtures } from "./cohort-decision-fixtures";
import {
  closeTestApp,
  createTestApp,
  type TestContext,
} from "./e2e-test-utils";
import {
  group,
  optional,
  required,
  suiteSplitFixtures,
} from "./suite-split-fixtures";

describe("Suite split decisions (e2e)", () => {
  let ctx: TestContext;
  let fx: ReturnType<typeof suiteSplitFixtures>;
  let createUser: ReturnType<typeof cohortDecisionFixtures>["createUser"];

  beforeAll(async () => {
    ctx = await createTestApp([
      TasksModule,
      FormulasModule,
      MemberListsModule,
      SuiteSplitsModule,
    ]);
    fx = suiteSplitFixtures(ctx);
    ({ createUser } = cohortDecisionFixtures(ctx));
  }, 50000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  const signedAt = addDays(new Date(), -30);

  /** Schedules the actions straight in the db, past the launch refusal. */
  const goLive = async (actions: Action[], at: Date) => {
    const events = ctx.dataSource.getRepository(ActionEvent);
    for (const action of actions) {
      await events.save([
        events.create({
          title: "Member action",
          description: "",
          newStatus: ActionStatus.MemberAction,
          date: at,
          action,
          suiteManaged: true,
        }),
        events.create({
          title: "Resolution",
          description: "",
          newStatus: ActionStatus.Resolution,
          date: addDays(at, 7),
          action,
          suiteManaged: true,
        }),
      ]);
    }
  };

  const decisions = async (actionId: number) =>
    new Map(
      (
        await ctx.dataSource
          .getRepository(ActionCohortDecision)
          .findBy({ actionId })
      ).map((row) => [row.userId, row]),
    );

  it("places members against the versions at go-live and writes each grid cell as their decision", async () => {
    const [listed, other, joinsLate] = [
      await createUser({ signedAt }),
      await createUser({ signedAt }),
      await createUser({ signedAt }),
    ];
    const list = await fx.createList(`Listed ${randomUUID()}`, [listed.id]);
    const { suite, actions } = await fx.createSplit({
      actionNames: ["Call", "Write"],
      groups: ([call, write]) => [
        group("Listed", `isOnList("${list.name}")`, [
          required(call.id),
          optional(write.id),
        ]),
      ],
      everyoneElse: ([, write]) => [required(write.id)],
    });
    const [call, write] = actions;
    const live = new Date();
    await goLive(actions, live);
    await Bun.sleep(5);
    await request(ctx.app.getHttpServer())
      .put(`/member-lists/${list.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({
        name: list.name,
        baseName: list.name,
        baseVersionId: list.versionId,
        userIds: [listed.id, joinsLate.id],
      })
      .expect(200);

    await ctx.app.get(CohortDecisionService).resolveAll(new Date());

    const pin = await ctx.dataSource
      .getRepository(SuiteSplitPin)
      .findOneByOrFail({ suiteId: suite.id });
    expect(pin.pinnedAt).toEqual(live);
    expect(pin.listVersionIds).toEqual([list.versionId]);
    const placements = new Map(
      (
        await ctx.dataSource
          .getRepository(SuiteSplitPlacement)
          .findBy({ suiteId: suite.id })
      ).map((row) => [row.userId, row]),
    );
    const [listedGroup, everyoneElse] = (await fx.get(suite.id)).groups;
    expect(placements.get(listed.id)?.groupId).toBe(listedGroup.id);
    expect(placements.get(other.id)?.groupId).toBe(everyoneElse.id);
    expect(placements.get(joinsLate.id)?.groupId).toBe(everyoneElse.id);
    expect(placements.get(listed.id)?.trace).toEqual({
      steps: [{ groupId: listedGroup.id, outcome: TraceOutcome.Matched }],
      lists: [{ listId: list.id, on: true }],
    });

    const calls = await decisions(call.id);
    const writes = await decisions(write.id);
    expect(calls.get(listed.id)).toMatchObject({
      included: true,
      optional: false,
    });
    expect(calls.get(other.id)).toMatchObject({ included: false });
    expect(writes.get(listed.id)).toMatchObject({
      included: true,
      optional: true,
    });
    expect(writes.get(other.id)).toMatchObject({
      included: true,
      optional: false,
    });

    const tasks = await ctx.app
      .get(MemberActionsService)
      .findUncompletedTasks(listed.id);
    expect(
      tasks
        .filter((task) => [call.id, write.id].includes(task.id))
        .map((task) => [task.name, task.viewer?.optional]),
    ).toEqual(
      expect.arrayContaining([
        ["Call", false],
        ["Write", true],
      ]),
    );
  });

  it("pins each formula the split reads, through another formula too, as saved by go-live", async () => {
    const member = await createUser({ signedAt });
    const list = await fx.createList(`Read ${randomUUID()}`, [member.id]);
    const [outer, inner] = [randomUUID(), randomUUID()];
    const names = { outer: `outer${Date.now()}`, inner: `inner${Date.now()}` };
    const edit = (id: string, name: string, text: string) => ({
      id,
      baseVersionId: null,
      name,
      text,
      notes: null,
    });
    await fx
      .saveFormulas({
        edits: [edit(inner, names.inner, `isOnList("${list.name}")`)],
      })
      .expect(200, { problems: [] });
    await fx
      .saveFormulas({ edits: [edit(outer, names.outer, names.inner)] })
      .expect(200, { problems: [] });
    const { suite, actions } = await fx.createSplit({
      actionNames: ["Call"],
      groups: ([call]) => [group("Read", names.outer, [required(call.id)])],
    });
    const atGoLive = {
      outer: await fx.formulaVersion(outer),
      inner: await fx.formulaVersion(inner),
    };
    await Bun.sleep(5);
    await goLive(actions, new Date());
    await Bun.sleep(5);
    await fx
      .saveFormulas({
        edits: [
          {
            ...edit(inner, names.inner, "false"),
            baseVersionId: atGoLive.inner,
          },
        ],
      })
      .expect(200, { problems: [] });

    await ctx.app.get(CohortDecisionService).resolveAll(new Date());

    const pin = await ctx.dataSource
      .getRepository(SuiteSplitPin)
      .findOneByOrFail({ suiteId: suite.id });
    expect(pin.formulaVersionIds.toSorted((a, b) => a - b)).toEqual(
      [atGoLive.outer, atGoLive.inner].toSorted((a, b) => a - b),
    );
    const [readGroup] = (await fx.get(suite.id)).groups;
    expect(
      (
        await ctx.dataSource
          .getRepository(SuiteSplitPlacement)
          .findOneByOrFail({ suiteId: suite.id, userId: member.id })
      ).groupId,
    ).toBe(readGroup.id);
  });

  /** Dates the suite's split versions to `at`, as if saved then. */
  const savedAt = (suiteId: number, at: Date) =>
    ctx.dataSource
      .getRepository(SuiteSplitVersion)
      .update({ suiteId }, { createdAt: at });

  it("pins at the suite's earliest member_action, whichever action is decided first", async () => {
    await createUser({ signedAt });
    const { suite, actions } = await fx.createSplit({
      actionNames: ["Call", "Write"],
      groups: () => [],
      everyoneElse: ([call, write]) => [required(call.id), required(write.id)],
    });
    const [call, write] = actions;
    const now = new Date();
    const earlier = addDays(now, -2);
    await savedAt(suite.id, addDays(now, -3));
    await goLive([call], earlier);
    await goLive([write], addDays(now, -1));

    await ctx.app.get(CohortDecisionService).decideOpenAction(
      parseAction(
        await ctx.dataSource.getRepository(Action).findOneOrFail({
          where: { id: write.id },
          relations: { events: true },
        }),
      ),
      now,
    );

    const pin = await ctx.dataSource
      .getRepository(SuiteSplitPin)
      .findOneByOrFail({ suiteId: suite.id });
    expect(pin.pinnedAt).toEqual(earlier);
  });

  it("keeps the whole suite from going live when its split fails validation", async () => {
    const member = await createUser({ signedAt });
    const list = await fx.createList(`Gone ${randomUUID()}`, [member.id]);
    const { suite, actions } = await fx.createSplit({
      actionNames: ["Call"],
      groups: ([call]) => [
        group("Anyone", `isOnList("${list.name}")`, [required(call.id)]),
      ],
    });
    // Past the list-delete check, which only a bug would get by.
    await ctx.dataSource.getRepository(MemberList).softDelete(list.id);
    await Bun.sleep(5);
    await goLive(actions, new Date());
    const report = jest.spyOn(ctx.app.get(PosthogService), "captureException");

    try {
      await ctx.app.get(CohortDecisionService).resolveAll(new Date());
      await ctx.app.get(CohortDecisionService).resolveAll(new Date());
      expect(report).toHaveBeenCalledTimes(1);
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({
          event: ExceptionEvent.SplitLaunchFailed,
          properties: { suiteId: suite.id },
        }),
      );
    } finally {
      report.mockRestore();
    }

    expect((await decisions(actions[0].id)).get(member.id)).toBeUndefined();
    expect(
      await ctx.dataSource
        .getRepository(SuiteSplitPin)
        .existsBy({ suiteId: suite.id }),
    ).toBe(false);
    const failed = await fx.get(suite.id);
    expect(failed.launchFailedAt).not.toBeNull();
    expect(failed.launchFailure).toContain(
      '"Anyone": This uses a list that no longer exists.',
    );
  });

  it("pins the split saved by go-live and refuses fixing it after", async () => {
    const { suite, actions, split } = await fx.createSplit({
      actionNames: ["Call"],
      groups: ([call]) => [group("Anyone", "true", [required(call.id)])],
    });
    await Bun.sleep(5);
    await goLive(actions, new Date());
    await fx
      .saveFormulas({
        groupFixes: [
          {
            suiteId: suite.id,
            baseVersionId: split.versionId,
            groupId: split.groups[0].id,
            text: "false",
            fallback: null,
          },
        ],
      })
      .expect(409);
    await ctx.dataSource.getRepository(SuiteSplitVersion).insert({
      suiteId: suite.id,
      groups: [],
      savedById: null,
    });

    await ctx.app.get(CohortDecisionService).resolveAll(new Date());

    const pin = await ctx.dataSource
      .getRepository(SuiteSplitPin)
      .findOneByOrFail({ suiteId: suite.id });
    expect(pin.splitVersionId).toBe(split.versionId);
  });

  it("decides members after the deadline from their cells, and leaves one whose group errors undecided", async () => {
    const [anyone, broken] = [
      await createUser({ signedAt }),
      await createUser({ signedAt }),
    ];
    const list = await fx.createList(`Broken ${randomUUID()}`, [broken.id]);
    const { suite, actions } = await fx.createSplit({
      actionNames: ["Call", "Write"],
      groups: ([call, write]) => [
        group("Broken", `isOnList("${list.name}") ? 1 / 0 > 1 : false`, [
          required(call.id),
        ]),
        group("Anyone", "true", [required(call.id), optional(write.id)]),
      ],
    });
    const live = addDays(new Date(), -10);
    await savedAt(suite.id, addDays(live, -1));
    await ctx.dataSource
      .getRepository(MemberListVersion)
      .update({ listId: list.id }, { createdAt: addDays(live, -1) });
    await goLive(actions, live);
    // A suite launched after the resolver's cutover is caught up, not
    // backfilled; one earlier decision stands in for that.
    const earlier = await createUser({ signedAt });
    await ctx.dataSource.getRepository(ActionCohortDecision).insert(
      actions.map((action) => ({
        actionId: action.id,
        userId: earlier.id,
        included: false,
        optional: null,
        reason: CohortDecisionReason.Launch,
        resolvedAt: live,
      })),
    );

    await ctx.app.get(CohortDecisionService).resolveAll(new Date());

    const [call, write] = actions;
    expect((await decisions(call.id)).get(anyone.id)).toMatchObject({
      included: false,
      reason: CohortDecisionReason.ResolvedAfterDeadline,
    });
    expect((await decisions(write.id)).get(anyone.id)).toMatchObject({
      included: true,
      optional: true,
    });
    expect((await decisions(call.id)).get(broken.id)).toBeUndefined();
    expect(
      await ctx.dataSource
        .getRepository(SuiteSplitPlacement)
        .existsBy({ suiteId: suite.id, userId: broken.id }),
    ).toBe(false);
  });

  it("places and decides a member the pass hasn't reached when they read their tasks", async () => {
    const { actions } = await fx.createSplit({
      actionNames: ["Call"],
      groups: ([call]) => [group("Anyone", "true", [required(call.id)])],
    });
    await Bun.sleep(5);
    await goLive(actions, new Date());
    await ctx.app.get(CohortDecisionService).resolveAll(new Date());
    const late = await createUser({ signedAt });

    await ctx.app.get(MemberActionsService).findUncompletedTasks(late.id);

    expect((await decisions(actions[0].id)).get(late.id)).toMatchObject({
      included: true,
      optional: false,
    });
  });
});
