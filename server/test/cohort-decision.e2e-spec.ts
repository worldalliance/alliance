import type { CohortExpression } from "@alliance/common/cohort-expression";
import { Logger } from "@nestjs/common";
import { millisecondsInDay } from "date-fns/constants";
import type { Repository } from "typeorm";
import { CohortDecisionService } from "../src/actions/cohort-decision.service";
import {
  ActionCohortDecision,
  CohortDecisionReason,
} from "../src/actions/entities/action-cohort-decision.entity";
import {
  ActionEvent,
  ActionStatus,
} from "../src/actions/entities/action-event.entity";
import { Action, VisibilityMode } from "../src/actions/entities/action.entity";
import {
  ContractEvent,
  ContractEventType,
} from "../src/user/entities/contract-event.entity";
import { User } from "../src/user/entities/user.entity";
import { createTestApp, TestContext } from "./e2e-test-utils";

const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * millisecondsInDay);

describe("CohortDecisionService (e2e)", () => {
  let ctx: TestContext;
  let service: CohortDecisionService;
  let actionRepo: Repository<Action>;
  let eventRepo: Repository<ActionEvent>;
  let decisionRepo: Repository<ActionCohortDecision>;
  let contractEventRepo: Repository<ContractEvent>;
  let userRepo: Repository<User>;

  const now = new Date();

  beforeAll(async () => {
    ctx = await createTestApp([]);
    service = ctx.app.get(CohortDecisionService);
    actionRepo = ctx.dataSource.getRepository(Action);
    eventRepo = ctx.dataSource.getRepository(ActionEvent);
    decisionRepo = ctx.dataSource.getRepository(ActionCohortDecision);
    contractEventRepo = ctx.dataSource.getRepository(ContractEvent);
    userRepo = ctx.dataSource.getRepository(User);
  }, 50000);

  afterEach(async () => {
    await decisionRepo.query("DELETE FROM action_cohort_decision");
    await eventRepo.query("DELETE FROM action_event");
    await actionRepo.query("DELETE FROM action");
    await contractEventRepo.query("DELETE FROM contract_event");
    await userRepo.query(
      `DELETE FROM "user" WHERE id NOT IN (${ctx.testUserId}, ${ctx.adminUserId})`,
    );
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  let userCount = 0;
  const createUser = async (
    params: {
      signedAt?: Date;
      tagged?: boolean;
      timeZone?: string;
    } = {},
  ) => {
    const { signedAt, tagged = true, timeZone } = params;
    userCount++;
    const user = await userRepo.save(
      userRepo.create({
        email: `cohort-decision-${userCount}@example.com`,
        password: "pass",
        name: `Member ${userCount}`,
        tags: tagged ? [ctx.defaultTag] : [],
        timeZone,
      }),
    );
    if (signedAt) {
      await contractEventRepo.save({
        user: { id: user.id },
        type: ContractEventType.SIGNED,
        date: signedAt,
        contract: { id: ctx.defaultContractId },
      });
    }
    return user;
  };

  const createAction = async (params: {
    start: Date;
    deadline: Date | null;
    cohortExpression?: CohortExpression;
    onboarding?: boolean;
  }) => {
    const { start, deadline, onboarding = false } = params;
    const action = await actionRepo.save(
      actionRepo.create({
        name: "Action",
        category: [],
        body: "Body",
        shortDescription: "Short description",
        visibilityMode: VisibilityMode.Public,
        cohortExpression: params.cohortExpression ?? {
          type: "Tag",
          tagId: ctx.defaultTag.id,
        },
        onboarding,
      }),
    );
    await eventRepo.save([
      eventRepo.create({
        title: "Member action",
        description: "",
        newStatus: ActionStatus.MemberAction,
        date: start,
        action,
      }),
      ...(deadline
        ? [
            eventRepo.create({
              title: "Resolution",
              description: "",
              newStatus: ActionStatus.Resolution,
              date: deadline,
              action,
            }),
          ]
        : []),
    ]);
    return action;
  };

  const decisionsFor = async (actionId: number) =>
    new Map(
      (await decisionRepo.find({ where: { actionId } })).map((row) => [
        row.userId,
        row,
      ]),
    );

  const signedAt = addDays(now, -30);

  it("decides admissible members of an open action and skips unsigned ones", async () => {
    const tagged = await createUser({ signedAt });
    const untagged = await createUser({ signedAt, tagged: false });
    const unsigned = await createUser();
    const action = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
    });

    await service.resolveAll(now);

    const decisions = await decisionsFor(action.id);
    expect(decisions.get(tagged.id)).toMatchObject({
      included: true,
      reason: CohortDecisionReason.Launch,
    });
    expect(decisions.get(untagged.id)).toMatchObject({
      included: false,
      reason: CohortDecisionReason.Launch,
    });
    expect(decisions.has(unsigned.id)).toBe(false);
  });

  it("leaves future actions undecided", async () => {
    await createUser({ signedAt });
    const action = await createAction({
      start: addDays(now, 1),
      deadline: addDays(now, 3),
    });

    await service.resolveAll(now);

    expect((await decisionsFor(action.id)).size).toBe(0);
  });

  it("converges on one decision per member across repeated and concurrent passes", async () => {
    await createUser({ signedAt });
    await createUser({ signedAt });
    const action = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
    });

    await Promise.all([service.resolveAll(now), service.resolveAll(now)]);
    await service.resolveAll(now);

    expect(await decisionRepo.count({ where: { actionId: action.id } })).toBe(
      2,
    );
  });

  it("keeps a decision after the member's country changes", async () => {
    const member = await createUser({
      signedAt,
      timeZone: "America/New_York",
    });
    const usAction = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
      cohortExpression: { type: "USMember" },
    });
    const nonUsAction = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
      cohortExpression: { type: "NonUSMember" },
    });

    await service.resolveAll(now);
    await userRepo.update(member.id, { timeZone: "Europe/London" });
    await service.resolveAll(now);

    expect((await decisionsFor(usAction.id)).get(member.id)?.included).toBe(
      true,
    );
    expect((await decisionsFor(nonUsAction.id)).get(member.id)?.included).toBe(
      false,
    );
  });

  it("decides a member who signs mid-window on the next pass", async () => {
    const action = await createAction({
      start: addDays(now, -2),
      deadline: addDays(now, 3),
    });
    const member = await createUser({ signedAt: addDays(now, -1) });

    await service.resolveAll(now);

    expect((await decisionsFor(action.id)).get(member.id)).toMatchObject({
      included: true,
      reason: CohortDecisionReason.Signing,
    });
  });

  it("decides healthy actions when another action's cohort fails", async () => {
    const member = await createUser({ signedAt });
    await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
      cohortExpression: { type: "MissedActionDeadline", actionId: 999999 },
    });
    const healthy = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
    });
    const error = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => {});

    await service.resolveAll(now);

    expect((await decisionsFor(healthy.id)).get(member.id)?.included).toBe(
      true,
    );
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  const recordCutover = async (resolvedAt: Date) => {
    const user = await createUser();
    const action = await createAction({ start: resolvedAt, deadline: null });
    await decisionRepo.save({
      actionId: action.id,
      userId: user.id,
      included: true,
      reason: CohortDecisionReason.Launch,
      resolvedAt,
    });
  };

  it("leaves closed actions launched before the first decision to the backfill", async () => {
    await createUser({ signedAt });
    const beforeAnyDecision = await createAction({
      start: addDays(now, -3),
      deadline: addDays(now, -1),
    });

    await service.resolveAll(now);
    expect((await decisionsFor(beforeAnyDecision.id)).size).toBe(0);

    await recordCutover(addDays(now, -2));
    await service.resolveAll(now);
    expect((await decisionsFor(beforeAnyDecision.id)).size).toBe(0);
  });

  it("stops catching up a closed action a week after its deadline", async () => {
    await recordCutover(addDays(now, -20));
    const member = await createUser({ signedAt });
    const action = await createAction({
      start: addDays(now, -10),
      deadline: addDays(now, -8),
    });

    await service.resolveAll(now);

    expect((await decisionsFor(action.id)).has(member.id)).toBe(false);
  });

  it("excludes members first reached after the deadline", async () => {
    const decided = await createUser({ signedAt });
    const missed = await createUser({ signedAt });
    const signedAfterDeadline = await createUser({
      signedAt: addDays(now, -0.5),
    });
    const action = await createAction({
      start: addDays(now, -3),
      deadline: addDays(now, -1),
    });
    const neverProcessed = await createAction({
      start: addDays(now, -3),
      deadline: addDays(now, -1),
    });
    await decisionRepo.save({
      actionId: action.id,
      userId: decided.id,
      included: true,
      reason: CohortDecisionReason.Launch,
      resolvedAt: addDays(now, -3),
    });

    await service.resolveAll(now);

    const decisions = await decisionsFor(action.id);
    expect(decisions.get(decided.id)?.included).toBe(true);
    expect(decisions.get(missed.id)).toMatchObject({
      included: false,
      reason: CohortDecisionReason.ResolvedAfterDeadline,
    });
    expect(decisions.has(signedAfterDeadline.id)).toBe(false);
    expect(
      (await decisionsFor(neverProcessed.id)).get(missed.id),
    ).toMatchObject({
      included: false,
      reason: CohortDecisionReason.ResolvedAfterDeadline,
    });
  });

  it("catches up a closed action the first pass already decided", async () => {
    await createUser({ signedAt });
    const action = await createAction({
      start: addDays(now, -3),
      deadline: addDays(now, -1),
    });
    await service.resolveAll(addDays(now, -2));
    const missed = await createUser({ signedAt });

    await service.resolveAll(now);

    expect((await decisionsFor(action.id)).get(missed.id)).toMatchObject({
      included: false,
      reason: CohortDecisionReason.ResolvedAfterDeadline,
    });
  });

  it("keeps a mid-window signer first reached after the deadline optional", async () => {
    const decided = await createUser({ signedAt });
    const action = await createAction({
      start: addDays(now, -3),
      deadline: addDays(now, -1),
    });
    await decisionRepo.save({
      actionId: action.id,
      userId: decided.id,
      included: true,
      reason: CohortDecisionReason.Launch,
      resolvedAt: addDays(now, -3),
    });
    const lateSigner = await createUser({ signedAt: addDays(now, -2) });

    await service.resolveAll(now);

    expect((await decisionsFor(action.id)).get(lateSigner.id)).toMatchObject({
      included: true,
      reason: CohortDecisionReason.Signing,
    });
  });

  it("keeps a member first reached after an optional action's deadline in its cohort", async () => {
    const decided = await createUser({ signedAt });
    const action = await createAction({
      start: addDays(now, -3),
      deadline: addDays(now, -1),
    });
    await actionRepo.update(action.id, { optional: true });
    await decisionRepo.save({
      actionId: action.id,
      userId: decided.id,
      included: true,
      reason: CohortDecisionReason.Launch,
      resolvedAt: addDays(now, -3),
    });
    const missed = await createUser({ signedAt });

    await service.resolveAll(now);

    expect((await decisionsFor(action.id)).get(missed.id)).toMatchObject({
      included: true,
      reason: CohortDecisionReason.Launch,
    });
  });

  it("keeps a member who re-signed mid-window optional after the deadline", async () => {
    const decided = await createUser({ signedAt });
    const action = await createAction({
      start: addDays(now, -3),
      deadline: addDays(now, -1),
    });
    await decisionRepo.save({
      actionId: action.id,
      userId: decided.id,
      included: true,
      reason: CohortDecisionReason.Launch,
      resolvedAt: addDays(now, -3),
    });
    const resigner = await createUser({ signedAt });
    await contractEventRepo.save([
      {
        user: { id: resigner.id },
        type: ContractEventType.SUSPENDED,
        date: addDays(now, -2),
      },
      {
        user: { id: resigner.id },
        type: ContractEventType.SIGNED,
        date: addDays(now, -1.5),
        contract: { id: ctx.defaultContractId },
      },
    ]);

    await service.resolveAll(now);

    expect((await decisionsFor(action.id)).get(resigner.id)).toMatchObject({
      included: true,
      reason: CohortDecisionReason.Launch,
    });
  });

  it("waits for a recent signer's request to finish", async () => {
    const action = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
    });
    const member = await createUser({
      signedAt: new Date(now.getTime() - 60_000),
    });

    await service.resolveAll(now);
    expect((await decisionsFor(action.id)).has(member.id)).toBe(false);

    await service.resolveAll(new Date(now.getTime() + 11 * 60_000));
    expect((await decisionsFor(action.id)).get(member.id)?.included).toBe(true);
  });

  it("keeps onboarding open to unsigned and later members only", async () => {
    const unsigned = await createUser();
    const existingMember = await createUser({ signedAt });
    const action = await createAction({
      start: addDays(now, -3),
      deadline: addDays(now, -1),
      onboarding: true,
    });

    await service.resolveAll(now);

    const decisions = await decisionsFor(action.id);
    expect(decisions.get(unsigned.id)?.included).toBe(true);
    expect(decisions.has(existingMember.id)).toBe(false);
  });
});
