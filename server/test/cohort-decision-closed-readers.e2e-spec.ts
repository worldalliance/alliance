import { Logger } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { In, type Repository } from "typeorm";
import { CohortDecisionService } from "../src/actions/cohort-decision.service";
import { ActionActivity } from "../src/actions/entities/action-activity.entity";
import { ActionCohortDecision } from "../src/actions/entities/action-cohort-decision.entity";
import { Action, parseAction } from "../src/actions/entities/action.entity";
import { CohortDecisionReason } from "../src/actions/entities/cohort-decision-reason";
import { TasksModule } from "../src/tasks/tasks.module";
import { User } from "../src/user/entities/user.entity";
import {
  addDays,
  cohortDecisionFixtures,
  type CohortDecisionFixtures,
} from "./cohort-decision-fixtures";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("CohortDecisionService closed actions read by a follow-up (e2e)", () => {
  let ctx: TestContext;
  let service: CohortDecisionService;
  let actionRepo: Repository<Action>;
  let decisionRepo: Repository<ActionCohortDecision>;
  let userRepo: Repository<User>;
  let createUser: CohortDecisionFixtures["createUser"];
  let createAction: CohortDecisionFixtures["createAction"];
  let decisionsFor: CohortDecisionFixtures["decisionsFor"];
  let failManualCohorts: CohortDecisionFixtures["failManualCohorts"];
  let cleanUp: CohortDecisionFixtures["cleanUp"];

  const now = new Date();
  const signedAt = addDays(now, -30);

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    service = ctx.app.get(CohortDecisionService);
    actionRepo = ctx.dataSource.getRepository(Action);
    decisionRepo = ctx.dataSource.getRepository(ActionCohortDecision);
    userRepo = ctx.dataSource.getRepository(User);
    ({ createUser, createAction, decisionsFor, failManualCohorts, cleanUp } =
      cohortDecisionFixtures(ctx));
  }, 50000);

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanUp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  enum Writer {
    PassFollowUpFirst = "the pass, follow-up created first",
    PassFollowUpLast = "the pass, follow-up created last",
    MemberRead = "the member's own read",
    OneShotReader = "a one-shot reader",
  }

  it.each(Object.values(Writer))(
    "decides the dependent before %s decides the follow-up",
    async (writer) => {
      const deadline = new Date(now.getTime() - 60_000);
      const missedDependent = (id: number) => ({
        type: "MissedActionDeadline" as const,
        actionId: id,
      });
      const earlyFollowUp =
        writer === Writer.PassFollowUpFirst
          ? await createAction({ start: deadline, deadline: addDays(now, 3) })
          : null;
      const member = await createUser({ signedAt });
      const upstream = await createAction({
        start: addDays(now, -3),
        deadline,
      });
      const dependent = await createAction({
        start: addDays(now, -2),
        deadline,
        prerequisiteActionIds: [upstream.id],
      });
      const decided = await createUser({ signedAt });
      await decisionRepo.save({
        actionId: dependent.id,
        userId: decided.id,
        included: true,
        reason: CohortDecisionReason.PrerequisitesResolved,
        resolvedAt: addDays(now, -2),
      });
      const followUp =
        earlyFollowUp ??
        (await createAction({ start: deadline, deadline: addDays(now, 3) }));
      await actionRepo.update(followUp.id, {
        cohortExpression: missedDependent(dependent.id),
      });
      const parsedFollowUp = parseAction(
        await actionRepo.findOneOrFail({
          where: { id: followUp.id },
          relations: { events: true },
        }),
      );

      switch (writer) {
        case Writer.PassFollowUpFirst:
        case Writer.PassFollowUpLast:
          await service.resolveAll(now);
          break;
        case Writer.MemberRead:
          await service.reconcileForUser({
            user: await userRepo.findOneOrFail({
              where: { id: member.id },
              relations: { contractEvents: true, awayRanges: true },
            }),
            actions: [parsedFollowUp],
            now,
          });
          break;
        case Writer.OneShotReader:
          await service.decideOpenAction(parsedFollowUp, now);
          break;
        default:
          throw new Error(`unknown writer: ${writer satisfies never}`);
      }

      expect((await decisionsFor(dependent.id)).get(member.id)).toMatchObject({
        included: false,
        reason: CohortDecisionReason.ResolvedAfterDeadline,
      });
      expect((await decisionsFor(followUp.id)).get(member.id)?.included).toBe(
        false,
      );
    },
  );

  it("reads only the member's prerequisite rows when deciding the dependent on their read", async () => {
    const deadline = new Date(now.getTime() - 60_000);
    const member = await createUser({ signedAt });
    const upstream = await createAction({
      start: addDays(now, -3),
      deadline,
    });
    const dependent = await createAction({
      start: addDays(now, -2),
      deadline,
      prerequisiteActionIds: [upstream.id],
    });
    const decided = await createUser({ signedAt });
    await decisionRepo.save({
      actionId: dependent.id,
      userId: decided.id,
      included: true,
      reason: CohortDecisionReason.PrerequisitesResolved,
      resolvedAt: addDays(now, -2),
    });
    const followUp = await createAction({
      start: deadline,
      deadline: addDays(now, 3),
      cohortExpression: {
        type: "MissedActionDeadline",
        actionId: dependent.id,
      },
    });
    const activityFind = jest.spyOn(
      ctx.app.get<Repository<ActionActivity>>(
        getRepositoryToken(ActionActivity),
      ),
      "find",
    );

    await service.reconcileForUser({
      user: await userRepo.findOneOrFail({
        where: { id: member.id },
        relations: { contractEvents: true, awayRanges: true },
      }),
      actions: [
        parseAction(
          await actionRepo.findOneOrFail({
            where: { id: followUp.id },
            relations: { events: true },
          }),
        ),
      ],
      now,
    });

    expect((await decisionsFor(dependent.id)).has(member.id)).toBe(true);
    const beforeDeadline = activityFind.mock.calls
      .flatMap(([options]) => options?.where ?? [])
      .filter((where) => "createdAt" in where);
    expect(beforeDeadline).toEqual([
      expect.objectContaining({ actionId: upstream.id, userId: member.id }),
    ]);
  });

  it("decides the second of two closed actions that read each other from the first's saved decision", async () => {
    const deadline = new Date(now.getTime() - 60_000);
    const second = await createAction({ start: addDays(now, -3), deadline });
    const first = await createAction({ start: addDays(now, -2), deadline });
    const member = await createUser({ signedAt: addDays(now, -2.5) });
    await createUser({ signedAt: addDays(now, -1.5) });
    const decided = await createUser({ signedAt });
    await decisionRepo.save(
      [first, second].map(({ id }) => ({
        actionId: id,
        userId: decided.id,
        included: true,
        reason: CohortDecisionReason.Launch,
        resolvedAt: addDays(now, -2),
      })),
    );
    await actionRepo.update(first.id, {
      cohortExpression: {
        type: "OR",
        children: [
          { type: "Tag", tagId: ctx.defaultTag.id },
          { type: "MissedActionDeadline", actionId: second.id },
        ],
      },
    });
    await actionRepo.update(second.id, {
      cohortExpression: { type: "MissedActionDeadline", actionId: first.id },
    });

    await service.resolveAll(now);

    expect((await decisionsFor(first.id)).get(member.id)).toMatchObject({
      included: false,
      reason: CohortDecisionReason.ResolvedAfterDeadline,
    });
    expect((await decisionsFor(second.id)).get(member.id)?.included).toBe(
      false,
    );
  });

  it.each(["low", "high"] as const)(
    "decides a read cycle in the pass's order when a backfilled action reads into it and the reader reads its %s id",
    async (entry) => {
      const deadline = new Date(now.getTime() - 60_000);
      const closed = { start: addDays(now, -2), deadline };
      const backfilled = await createAction({
        ...closed,
        start: addDays(now, -3),
      });
      const low = await createAction(closed);
      const high = await createAction(closed);
      const member = await createUser({ signedAt });
      const decided = await createUser({ signedAt });
      await decisionRepo.save(
        [low, high].map(({ id }) => ({
          actionId: id,
          userId: decided.id,
          included: true,
          reason: CohortDecisionReason.Launch,
          resolvedAt: closed.start,
        })),
      );
      const missed = (...ids: number[]) => ({
        type: "OR" as const,
        children: ids.map((actionId) => ({
          type: "MissedActionDeadline" as const,
          actionId,
        })),
      });
      await actionRepo.update(backfilled.id, {
        cohortExpression: missed(high.id),
      });
      await actionRepo.update(low.id, {
        cohortExpression: missed(backfilled.id, high.id),
      });
      await actionRepo.update(high.id, { cohortExpression: missed(low.id) });
      const reader = await createAction({
        start: deadline,
        deadline: addDays(now, 3),
        cohortExpression: missed({ low, high }[entry].id),
      });

      await service.decideOpenAction(
        parseAction(
          await actionRepo.findOneOrFail({
            where: { id: reader.id },
            relations: { events: true },
          }),
        ),
        now,
      );

      const lowDecision = (await decisionsFor(low.id)).get(member.id);
      const highDecision = (await decisionsFor(high.id)).get(member.id);
      expect(lowDecision).toBeDefined();
      expect(highDecision).toBeDefined();
      expect(lowDecision!.id).toBeGreaterThan(highDecision!.id);
      expect(
        (await decisionsFor(backfilled.id)).get(member.id),
      ).toBeUndefined();
    },
  );

  it("decides the follow-up from the dependent's decision when closed actions read each other", async () => {
    const deadline = new Date(now.getTime() - 60_000);
    const member = await createUser({ signedAt });
    await createUser({ signedAt: addDays(now, -0.5) });
    const upstream = await createAction({
      start: addDays(now, -3),
      deadline,
    });
    const dependent = await createAction({
      start: addDays(now, -2),
      deadline,
      prerequisiteActionIds: [upstream.id],
    });
    const other = await createAction({ start: addDays(now, -1), deadline });
    const decided = await createUser({ signedAt });
    await decisionRepo.save({
      actionId: dependent.id,
      userId: decided.id,
      included: true,
      reason: CohortDecisionReason.PrerequisitesResolved,
      resolvedAt: addDays(now, -2),
    });
    await actionRepo.update(dependent.id, {
      cohortExpression: {
        type: "OR",
        children: [
          { type: "Tag", tagId: ctx.defaultTag.id },
          { type: "MissedActionDeadline", actionId: other.id },
        ],
      },
    });
    await actionRepo.update(other.id, {
      cohortExpression: {
        type: "MissedActionDeadline",
        actionId: dependent.id,
      },
    });
    const followUp = await createAction({
      start: deadline,
      deadline: addDays(now, 3),
      cohortExpression: {
        type: "MissedActionDeadline",
        actionId: dependent.id,
      },
    });

    await service.resolveAll(now);

    expect((await decisionsFor(dependent.id)).get(member.id)?.reason).toBe(
      CohortDecisionReason.ResolvedAfterDeadline,
    );
    expect((await decisionsFor(followUp.id)).get(member.id)?.included).toBe(
      false,
    );
  });

  const createFailingClosedReader = async (member: User) => {
    const deadline = new Date(now.getTime() - 60_000);
    const closed = await createAction({
      start: addDays(now, -2),
      deadline,
      cohortExpression: { type: "Manual", userIds: [member.id] },
    });
    await actionRepo.update(closed.id, { optional: true });
    const decided = await createUser({ signedAt });
    await decisionRepo.save({
      actionId: closed.id,
      userId: decided.id,
      included: true,
      reason: CohortDecisionReason.Launch,
      resolvedAt: addDays(now, -2),
    });
    const followUp = await createAction({
      start: deadline,
      deadline: addDays(now, 3),
      cohortExpression: { type: "MissedActionDeadline", actionId: closed.id },
    });
    const unrelated = await createAction({
      start: deadline,
      deadline: addDays(now, 3),
    });
    failManualCohorts();
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    return { closed, followUp, unrelated };
  };

  it("leaves only the follow-up to the live cohort when deciding the closed action fails on the member's read", async () => {
    const member = await createUser({ signedAt });
    const { closed, followUp, unrelated } =
      await createFailingClosedReader(member);
    const inadmissible = await createAction({
      start: addDays(now, -0.5),
      deadline: addDays(now, 3),
      cohortExpression: { type: "MissedActionDeadline", actionId: closed.id },
    });
    await actionRepo.update(inadmissible.id, { onboarding: true });

    const live = await service.reconcileForUser({
      user: await userRepo.findOneOrFail({
        where: { id: member.id },
        relations: { contractEvents: true, awayRanges: true },
      }),
      actions: (
        await actionRepo.find({
          where: { id: In([followUp.id, unrelated.id, inadmissible.id]) },
          relations: { events: true },
        })
      ).map(parseAction),
      now,
    });

    expect(live).toEqual(new Set([followUp.id]));
    expect((await decisionsFor(followUp.id)).has(member.id)).toBe(false);
    expect((await decisionsFor(unrelated.id)).get(member.id)?.included).toBe(
      true,
    );
  });

  it("leaves the follow-up undecided when the pass fails to decide the closed action", async () => {
    const member = await createUser({ signedAt });
    const { followUp, unrelated } = await createFailingClosedReader(member);

    await service.resolveAll(now);

    expect((await decisionsFor(followUp.id)).has(member.id)).toBe(false);
    expect((await decisionsFor(unrelated.id)).get(member.id)?.included).toBe(
      true,
    );
  });

  it("fails a one-shot reader when deciding the closed action fails", async () => {
    const member = await createUser({ signedAt });
    const { followUp } = await createFailingClosedReader(member);

    await expect(
      service.decideOpenAction(
        parseAction(
          await actionRepo.findOneOrFail({
            where: { id: followUp.id },
            relations: { events: true },
          }),
        ),
        now,
      ),
    ).rejects.toThrow();
    expect((await decisionsFor(followUp.id)).has(member.id)).toBe(false);
  });

  it("decides a dependent without any decisions before the member's read", async () => {
    const deadline = new Date(now.getTime() - 60_000);
    const member = await createUser({ signedAt });
    const other = await createUser({ signedAt });
    const earlier = await createAction({
      start: addDays(now, -20),
      deadline: addDays(now, 5),
    });
    await decisionRepo.save({
      actionId: earlier.id,
      userId: other.id,
      included: true,
      reason: CohortDecisionReason.Launch,
      resolvedAt: addDays(now, -20),
    });
    const upstream = await createAction({
      start: addDays(now, -3),
      deadline,
    });
    const dependent = await createAction({
      start: addDays(now, -2),
      deadline,
      prerequisiteActionIds: [upstream.id],
    });
    const followUp = await createAction({
      start: deadline,
      deadline: addDays(now, 3),
      cohortExpression: {
        type: "MissedActionDeadline",
        actionId: dependent.id,
      },
    });

    await service.reconcileForUser({
      user: await userRepo.findOneOrFail({
        where: { id: member.id },
        relations: { contractEvents: true, awayRanges: true },
      }),
      actions: [
        parseAction(
          await actionRepo.findOneOrFail({
            where: { id: followUp.id },
            relations: { events: true },
          }),
        ),
      ],
      now,
    });

    expect((await decisionsFor(dependent.id)).get(member.id)?.reason).toBe(
      CohortDecisionReason.ResolvedAfterDeadline,
    );
    expect((await decisionsFor(followUp.id)).get(member.id)?.included).toBe(
      false,
    );
  });

  it("decides the dependent before a closed reader created earlier, then the open one", async () => {
    const deadline = new Date(now.getTime() - 60_000);
    const closedReader = await createAction({
      start: addDays(now, -1),
      deadline,
    });
    await actionRepo.update(closedReader.id, { optional: true });
    const member = await createUser({ signedAt });
    const upstream = await createAction({
      start: addDays(now, -3),
      deadline,
    });
    const dependent = await createAction({
      start: addDays(now, -2),
      deadline,
      prerequisiteActionIds: [upstream.id],
    });
    const decided = await createUser({ signedAt });
    await decisionRepo.save(
      [dependent, closedReader].map(({ id }) => ({
        actionId: id,
        userId: decided.id,
        included: false,
        reason: CohortDecisionReason.Launch,
        resolvedAt: addDays(now, -2),
      })),
    );
    const reads = {
      type: "MissedActionDeadline" as const,
      actionId: dependent.id,
    };
    await actionRepo.update(closedReader.id, { cohortExpression: reads });
    const openReader = await createAction({
      start: deadline,
      deadline: addDays(now, 3),
      cohortExpression: reads,
    });

    await service.resolveAll(now);

    for (const reader of [closedReader, openReader]) {
      expect((await decisionsFor(reader.id)).get(member.id)?.included).toBe(
        false,
      );
    }
  });
});
