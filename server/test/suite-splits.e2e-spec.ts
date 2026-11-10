import { ActionActivityType } from "@alliance/common/actionActivity";
import type { CohortExpression } from "@alliance/common/cohort-expression";
import request from "supertest";
import { In, type Repository } from "typeorm";
import { CohortDecisionService } from "../src/actions/cohort-decision.service";
import { ActionActivity } from "../src/actions/entities/action-activity.entity";
import {
  ActionEvent,
  ActionStatus,
} from "../src/actions/entities/action-event.entity";
import { SplitVisibilityMode } from "../src/actions/entities/action-suite-split.entity";
import { ActionSuite } from "../src/actions/entities/action-suite.entity";
import { Action, VisibilityMode } from "../src/actions/entities/action.entity";
import { CohortDecisionReason } from "../src/actions/entities/cohort-decision-reason";
import { isActionOptional } from "../src/actions/suite-split";
import { TasksModule } from "../src/tasks/tasks.module";
import {
  addDays,
  cohortDecisionFixtures,
  type CohortDecisionFixtures,
} from "./cohort-decision-fixtures";
import { createTestApp, signAccessToken, TestContext } from "./e2e-test-utils";

describe("Suite splits (e2e)", () => {
  let ctx: TestContext;
  let service: CohortDecisionService;
  let actionRepo: Repository<Action>;
  let eventRepo: Repository<ActionEvent>;
  let suiteRepo: Repository<ActionSuite>;
  let activityRepo: Repository<ActionActivity>;
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
    activityRepo = ctx.dataSource.getRepository(ActionActivity);
    ({ createUser, createAction, decisionsFor, cleanUp } =
      cohortDecisionFixtures(ctx));
  }, 50000);

  afterEach(async () => {
    await ctx.dataSource.query("DELETE FROM action_suite_split_arm");
    await ctx.dataSource.query("DELETE FROM action_suite_split");
    await cleanUp();
    await suiteRepo.delete({ name: "suite-splits e2e" });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const admin = (req: request.Test) =>
    req.set("Authorization", `Bearer ${ctx.adminAccessToken}`);

  const tagged: CohortExpression = { type: "Tag", tagId: "" };

  /** Two arms in one suite, launching tomorrow so the split can be saved. */
  const createArms = async (
    params: { count?: number; prerequisiteActionIds?: number[][] } = {},
  ) => {
    const { count = 2, prerequisiteActionIds = [] } = params;
    const suite = await suiteRepo.save({ name: "suite-splits e2e" });
    const arms: Action[] = [];
    for (let index = 0; index < count; index++) {
      const action = await createAction({
        start: addDays(now, 1),
        deadline: addDays(now, 5),
        prerequisiteActionIds: prerequisiteActionIds[index] ?? [],
      });
      await actionRepo.update(action.id, {
        suite: { id: suite.id },
        name: `Arm ${index}`,
      });
      arms.push(action);
    }
    return { suite, arms };
  };

  const saveSplit = (params: {
    suiteId: number;
    arms: {
      actionId: number;
      rule: CohortExpression | null;
      optional?: boolean;
    }[];
    visibilityMode?: SplitVisibilityMode;
    filterExpression?: CohortExpression | null;
  }) =>
    admin(
      request(ctx.app.getHttpServer())
        .post(`/actions/suite/${params.suiteId}/splits`)
        .send({
          title: "Split title",
          visibilityMode: params.visibilityMode ?? SplitVisibilityMode.Combined,
          filterExpression: params.filterExpression ?? null,
          arms: params.arms.map((arm) => ({ optional: false, ...arm })),
        }),
    );

  const launch = (actions: Action[]) =>
    eventRepo.update(
      {
        action: { id: In(actions.map((action) => action.id)) },
        newStatus: ActionStatus.MemberAction,
      },
      { date: addDays(now, -1) },
    );

  const tagRule = (): CohortExpression => ({
    ...tagged,
    tagId: ctx.defaultTag.id,
  });

  it("writes each arm's routing expression and keeps the arm's optional flag on the arm", async () => {
    const { suite, arms } = await createArms();
    const res = await saveSplit({
      suiteId: suite.id,
      arms: [
        { actionId: arms[0].id, rule: tagRule(), optional: true },
        { actionId: arms[1].id, rule: null },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body[0]).toMatchObject({
      title: "Split title",
      launched: false,
    });

    const [first, second] = await Promise.all(
      arms.map((arm) => actionRepo.findOneOrFail({ where: { id: arm.id } })),
    );
    expect(first.cohortExpression).toEqual(tagRule());
    expect(second.cohortExpression).toEqual({ type: "NOT", child: tagRule() });
    expect(first.optional).toBe(false);
    expect(isActionOptional(first)).toBe(true);
    expect(isActionOptional(second)).toBe(false);
  });

  it("rejects a rule on the last arm, an action from another suite, and arms that don't share a deadline", async () => {
    const { suite, arms } = await createArms();
    const other = await createArms({ count: 1 });

    const ruledLast = await saveSplit({
      suiteId: suite.id,
      arms: [
        { actionId: arms[0].id, rule: tagRule() },
        { actionId: arms[1].id, rule: tagRule() },
      ],
    });
    expect(ruledLast.status).toBe(400);

    const foreign = await saveSplit({
      suiteId: suite.id,
      arms: [
        { actionId: arms[0].id, rule: tagRule() },
        { actionId: other.arms[0].id, rule: null },
      ],
    });
    expect(foreign.status).toBe(400);

    await eventRepo.update(
      { action: { id: arms[1].id }, newStatus: ActionStatus.Resolution },
      { date: addDays(now, 6) },
    );
    const mismatched = await saveSplit({
      suiteId: suite.id,
      arms: [
        { actionId: arms[0].id, rule: tagRule() },
        { actionId: arms[1].id, rule: null },
      ],
    });
    expect(mismatched.status).toBe(400);
    expect(mismatched.body.message).toContain("must share");
  });

  it("routes each member to exactly one arm once every arm's prerequisites have settled", async () => {
    const upstream = await createAction({
      start: addDays(now, -3),
      deadline: addDays(now, 3),
    });
    const { suite, arms } = await createArms({
      prerequisiteActionIds: [[], [upstream.id]],
    });
    expect(
      (
        await saveSplit({
          suiteId: suite.id,
          arms: [
            { actionId: arms[0].id, rule: tagRule() },
            { actionId: arms[1].id, rule: null },
          ],
        })
      ).status,
    ).toBe(201);
    await launch(arms);
    const member = await createUser({ signedAt });
    const untagged = await createUser({ signedAt, tagged: false });

    await service.resolveAll(now);
    for (const arm of arms) {
      expect((await decisionsFor(arm.id)).has(member.id)).toBe(false);
    }

    for (const user of [member, untagged]) {
      await activityRepo.save({
        actionId: upstream.id,
        userId: user.id,
        type: ActionActivityType.USER_COMPLETED,
      });
    }
    await service.resolveAll(now);

    const [first, second] = await Promise.all(
      arms.map((arm) => decisionsFor(arm.id)),
    );
    expect(first.get(member.id)).toMatchObject({
      included: true,
      reason: CohortDecisionReason.PrerequisitesResolved,
    });
    expect(second.get(member.id)?.included).toBe(false);
    expect(first.get(untagged.id)?.included).toBe(false);
    expect(second.get(untagged.id)?.included).toBe(true);
  });

  it("routes a member deciding one arm through their own reads onto every arm", async () => {
    const { suite, arms } = await createArms();
    await saveSplit({
      suiteId: suite.id,
      arms: [
        { actionId: arms[0].id, rule: tagRule() },
        { actionId: arms[1].id, rule: null },
      ],
    });
    await launch(arms);
    const member = await createUser({ signedAt });

    await service.resolveForUser(member.id, now);

    expect((await decisionsFor(arms[0].id)).get(member.id)?.included).toBe(
      true,
    );
    expect((await decisionsFor(arms[1].id)).get(member.id)?.included).toBe(
      false,
    );
  });

  it("moves a member between arms and removes them from the split, refusing a plain flip", async () => {
    const { suite, arms } = await createArms();
    await saveSplit({
      suiteId: suite.id,
      arms: [
        { actionId: arms[0].id, rule: tagRule() },
        { actionId: arms[1].id, rule: null },
      ],
    });
    await launch(arms);
    const member = await createUser({ signedAt });
    await service.resolveAll(now);
    const decisions = (actionId: number, userId: number, path: string) =>
      admin(
        request(ctx.app.getHttpServer())
          .post(`/cohort-decisions/action/${actionId}/user/${userId}/${path}`)
          .send({ note: "Asked to switch", included: false }),
      );

    expect((await decisions(arms[0].id, member.id, "correction")).status).toBe(
      400,
    );

    expect((await decisions(arms[1].id, member.id, "move-to-arm")).status).toBe(
      201,
    );
    expect((await decisionsFor(arms[0].id)).get(member.id)).toMatchObject({
      included: false,
      reason: CohortDecisionReason.StaffCorrection,
    });
    expect((await decisionsFor(arms[1].id)).get(member.id)?.included).toBe(
      true,
    );

    expect(
      (await decisions(arms[1].id, member.id, "remove-from-split")).status,
    ).toBe(201);
    for (const arm of arms) {
      expect((await decisionsFor(arm.id)).get(member.id)?.included).toBe(false);
    }
  });

  it("opens a combined arm's page only to members routed to it, and sums its counts", async () => {
    const { suite, arms } = await createArms();
    await saveSplit({
      suiteId: suite.id,
      arms: [
        { actionId: arms[0].id, rule: tagRule() },
        { actionId: arms[1].id, rule: null },
      ],
    });
    await launch(arms);
    const member = await createUser({ signedAt });
    await service.resolveAll(now);
    await actionRepo.update(arms[0].id, {
      visibilityMode: VisibilityMode.AllMembers,
      usersJoined: 3,
    });
    await actionRepo.update(arms[1].id, { usersJoined: 4 });
    const token = signAccessToken(ctx.jwtService, member);
    const open = (actionId: number) =>
      request(ctx.app.getHttpServer())
        .get(`/actions/slug/${actionId}`)
        .set("Authorization", `Bearer ${token}`);

    const own = await open(arms[0].id);
    expect(own.status).toBe(200);
    expect(own.body.usersJoined).toBe(7);
    expect((await open(arms[1].id)).status).toBe(404);
  });

  it("shows a combined split's activity in the global feed as one group under its title", async () => {
    const { suite, arms } = await createArms();
    await saveSplit({
      suiteId: suite.id,
      arms: [
        { actionId: arms[0].id, rule: tagRule() },
        { actionId: arms[1].id, rule: null },
      ],
    });
    await launch(arms);
    const routedToFirst = await createUser({ signedAt });
    const routedToSecond = await createUser({ signedAt, tagged: false });
    await service.resolveAll(now);
    for (const [user, arm] of [
      [routedToFirst, arms[0]],
      [routedToSecond, arms[1]],
    ] as const) {
      await activityRepo.save({
        actionId: arm.id,
        userId: user.id,
        type: ActionActivityType.USER_COMPLETED,
      });
    }

    const res = await request(ctx.app.getHttpServer())
      .get("/actions/globalFeed")
      .set(
        "Authorization",
        `Bearer ${signAccessToken(ctx.jwtService, routedToFirst)}`,
      );

    expect(res.status).toBe(200);
    const groups = res.body
      .flatMap((item: { activityGroup?: unknown }) =>
        item.activityGroup ? [item.activityGroup] : [],
      )
      .filter(
        (group: { combinedSplitId: number | null }) =>
          group.combinedSplitId !== null,
      );
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ actionName: "Split title", count: 2 });
  });

  it("refuses to delete an arm action", async () => {
    const { suite, arms } = await createArms();
    await saveSplit({
      suiteId: suite.id,
      arms: [
        { actionId: arms[0].id, rule: tagRule() },
        { actionId: arms[1].id, rule: null },
      ],
    });

    const res = await admin(
      request(ctx.app.getHttpServer()).delete(`/actions/${arms[0].id}`),
    );
    expect(res.status).toBe(400);
  });
});
