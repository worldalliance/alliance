import { ActionActivityType } from "@alliance/common/actionActivity";
import type { CohortExpression } from "@alliance/common/cohort-expression";
import { Logger } from "@nestjs/common";
import { millisecondsInDay } from "date-fns/constants";
import request from "supertest";
import type { Repository } from "typeorm";
import { ActionsService } from "../src/actions/actions.service";
import { CohortDecisionService } from "../src/actions/cohort-decision.service";
import { CohortDivergenceService } from "../src/actions/cohort-divergence.service";
import { ActionActivity } from "../src/actions/entities/action-activity.entity";
import {
  ActionCohortDecision,
  CohortDecisionReason,
} from "../src/actions/entities/action-cohort-decision.entity";
import {
  ActionEvent,
  ActionStatus,
} from "../src/actions/entities/action-event.entity";
import { Action, VisibilityMode } from "../src/actions/entities/action.entity";
import { ActionEventRecipientService } from "../src/notifs/action-event-recipient.service";
import { TasksModule } from "../src/tasks/tasks.module";
import {
  ContractEvent,
  ContractEventType,
} from "../src/user/entities/contract-event.entity";
import { User } from "../src/user/entities/user.entity";
import {
  createFormWithSnapshot,
  createTestApp,
  eventually,
  signAccessToken,
  TestContext,
} from "./e2e-test-utils";

const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * millisecondsInDay);

describe("CohortDecisionService (e2e)", () => {
  let ctx: TestContext;
  let service: CohortDecisionService;
  let divergenceService: CohortDivergenceService;
  let actionRepo: Repository<Action>;
  let eventRepo: Repository<ActionEvent>;
  let decisionRepo: Repository<ActionCohortDecision>;
  let contractEventRepo: Repository<ContractEvent>;
  let userRepo: Repository<User>;
  let activityRepo: Repository<ActionActivity>;

  const now = new Date();

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    service = ctx.app.get(CohortDecisionService);
    divergenceService = ctx.app.get(CohortDivergenceService);
    actionRepo = ctx.dataSource.getRepository(Action);
    eventRepo = ctx.dataSource.getRepository(ActionEvent);
    decisionRepo = ctx.dataSource.getRepository(ActionCohortDecision);
    contractEventRepo = ctx.dataSource.getRepository(ContractEvent);
    userRepo = ctx.dataSource.getRepository(User);
    activityRepo = ctx.dataSource.getRepository(ActionActivity);
  }, 50000);

  afterEach(async () => {
    await decisionRepo.query("DELETE FROM action_cohort_decision");
    await activityRepo.query("DELETE FROM action_activity");
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

  it("decides a member's open action when they sign", async () => {
    const member = await createUser();
    const open = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
    });

    await request(ctx.app.getHttpServer())
      .post(`/contract/sign/${ctx.defaultContractId}`)
      .set("Authorization", `Bearer ${signAccessToken(ctx.jwtService, member)}`)
      .send({ signedName: "Member" })
      .expect(201);

    const decision = await eventually(
      async () => (await decisionsFor(open.id)).get(member.id),
      (row) => row !== undefined,
      "the signing decision",
    );
    expect(decision).toMatchObject({
      included: true,
      reason: CohortDecisionReason.Signing,
    });
  });

  it("decides a task-form signer with the answers and completion it submitted", async () => {
    const member = await createUser();
    const { form, snapshot } = await createFormWithSnapshot(ctx.dataSource, {
      title: "Join",
      schema: {
        outputViews: [],
        pages: [
          {
            id: "page-1",
            fields: [
              {
                id: "sign",
                type: "input",
                kind: "contract",
                label: null,
                contractId: ctx.defaultContractId,
                signQuestion: "Sign?",
                yesLabel: "Yes",
                noLabel: "No",
              },
            ],
          },
        ],
      },
    });
    const onboarding = await createAction({
      start: addDays(now, -1),
      deadline: null,
      onboarding: true,
    });
    await actionRepo.update(onboarding.id, {
      taskFormId: form.id,
      isContractSigningAction: true,
    });
    const downstream = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
      cohortExpression: { type: "CompletedAction", actionId: onboarding.id },
    });

    await request(ctx.app.getHttpServer())
      .post(`/tasks/submitForm/${form.id}`)
      .set("Authorization", `Bearer ${signAccessToken(ctx.jwtService, member)}`)
      .send({
        answers: { sign: true },
        formSnapshotId: snapshot.id,
        actionId: onboarding.id,
        deviceType: "desktop",
      })
      .expect(201);

    const decision = await eventually(
      async () => (await decisionsFor(downstream.id)).get(member.id),
      (row) => row !== undefined,
      "the signing decision",
    );
    expect(decision?.included).toBe(true);
  });

  describe("backfill", () => {
    const suspend = async (userId: number, date: Date) =>
      contractEventRepo.save({
        user: { id: userId },
        type: ContractEventType.SUSPENDED,
        date,
        contract: { id: ctx.defaultContractId },
      });

    const reasonsFor = async (actionId: number) =>
      new Set(
        [...(await decisionsFor(actionId)).values()].map((r) => r.reason),
      );

    it("decides members holding a contract at a closed action's deadline", async () => {
      const tagged = await createUser({ signedAt });
      const untagged = await createUser({ signedAt, tagged: false });
      const signedMidWindow = await createUser({ signedAt: addDays(now, -2) });
      await createUser({ signedAt: addDays(now, -0.5) });
      await createUser();
      const action = await createAction({
        start: addDays(now, -3),
        deadline: addDays(now, -1),
      });

      await service.resolveAll(now);

      const decisions = await decisionsFor(action.id);
      expect(
        new Map([...decisions].map(([userId, row]) => [userId, row.included])),
      ).toEqual(
        new Map([
          [tagged.id, true],
          [untagged.id, false],
          [signedMidWindow.id, true],
        ]),
      );
      expect(await reasonsFor(action.id)).toEqual(
        new Set([CohortDecisionReason.Backfill]),
      );
    });

    it("decides members whose contract lapsed during the window", async () => {
      const suspendedMidWindow = await createUser({ signedAt });
      await suspend(suspendedMidWindow.id, addDays(now, -2));
      const signedAndSuspendedMidWindow = await createUser({
        signedAt: addDays(now, -2.5),
      });
      await suspend(signedAndSuspendedMidWindow.id, addDays(now, -2));
      const suspendedBeforeLaunch = await createUser({ signedAt });
      await suspend(suspendedBeforeLaunch.id, addDays(now, -4));
      const action = await createAction({
        start: addDays(now, -3),
        deadline: addDays(now, -1),
      });

      await service.resolveAll(now);

      expect(
        new Map(
          [...(await decisionsFor(action.id))].map(([userId, row]) => [
            userId,
            row.included,
          ]),
        ),
      ).toEqual(
        new Map([
          [suspendedMidWindow.id, true],
          [signedAndSuspendedMidWindow.id, true],
        ]),
      );
    });

    it("decides actions closed long before the first pass", async () => {
      const member = await createUser({ signedAt });
      const action = await createAction({
        start: addDays(now, -20),
        deadline: addDays(now, -15),
      });

      await service.resolveAll(now);

      expect((await decisionsFor(action.id)).get(member.id)).toMatchObject({
        included: true,
        reason: CohortDecisionReason.Backfill,
      });
    });

    it("skips evaluating an action nobody held a contract for", async () => {
      await createUser();
      await createAction({
        start: addDays(now, -20),
        deadline: addDays(now, -15),
      });
      const resolveCohort = jest.spyOn(
        ctx.app.get(ActionEventRecipientService),
        "resolveCohortMemberIds",
      );

      await service.resolveAll(now);
      await service.resolveAll(addDays(now, 0.01));

      expect(resolveCohort).not.toHaveBeenCalled();
      resolveCohort.mockRestore();
    });

    it("leaves open, future, and onboarding actions to ordinary decisions", async () => {
      await createUser({ signedAt });
      const open = await createAction({
        start: addDays(now, -1),
        deadline: addDays(now, 3),
      });
      const future = await createAction({
        start: addDays(now, 1),
        deadline: addDays(now, 3),
      });
      const onboarding = await createAction({
        start: addDays(now, -3),
        deadline: addDays(now, -1),
        onboarding: true,
      });

      await service.resolveAll(now);

      for (const action of [open, future, onboarding]) {
        expect(await reasonsFor(action.id)).not.toContain(
          CohortDecisionReason.Backfill,
        );
      }
    });

    it("skips closed actions the resolver decided or launched after the cutover", async () => {
      const member = await createUser({ signedAt });
      const decided = await createAction({
        start: addDays(now, -5),
        deadline: addDays(now, -1),
      });
      await decisionRepo.save({
        actionId: decided.id,
        userId: member.id,
        included: true,
        reason: CohortDecisionReason.Launch,
        resolvedAt: addDays(now, -4),
      });
      const afterCutover = await createAction({
        start: addDays(now, -3),
        deadline: addDays(now, -1),
      });
      const beforeCutover = await createAction({
        start: addDays(now, -5),
        deadline: addDays(now, -2),
      });

      await service.resolveAll(now);

      expect(await reasonsFor(decided.id)).not.toContain(
        CohortDecisionReason.Backfill,
      );
      expect(await reasonsFor(afterCutover.id)).not.toContain(
        CohortDecisionReason.Backfill,
      );
      expect(await reasonsFor(beforeCutover.id)).toEqual(
        new Set([CohortDecisionReason.Backfill]),
      );
    });

    it("waits out a member who just re-signed, then backfills once", async () => {
      const member = await createUser({ signedAt });
      const reSigned = await createUser({ signedAt });
      await suspend(reSigned.id, addDays(now, -2));
      await contractEventRepo.save({
        user: { id: reSigned.id },
        type: ContractEventType.SIGNED,
        date: new Date(now.getTime() - 60_000),
        contract: { id: ctx.defaultContractId },
      });
      const action = await createAction({
        start: addDays(now, -3),
        deadline: addDays(now, -1),
      });

      await service.resolveAll(now);
      expect((await decisionsFor(action.id)).size).toBe(0);

      await service.resolveAll(addDays(now, 0.01));
      await service.resolveAll(addDays(now, 0.02));

      const decisions = await decisionsFor(action.id);
      expect([...decisions.keys()].sort()).toEqual(
        [member.id, reSigned.id].sort(),
      );
      expect(await reasonsFor(action.id)).toEqual(
        new Set([CohortDecisionReason.Backfill]),
      );
    });
  });

  describe("backfill path comparison", () => {
    let warn: jest.SpyInstance;
    let error: jest.SpyInstance;
    let singleMember: jest.SpyInstance;
    beforeEach(() => {
      warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
      error = jest
        .spyOn(Logger.prototype, "error")
        .mockImplementation(() => {});
      singleMember = jest.spyOn(
        ctx.app.get(ActionsService),
        "computeIsInCohortExpression",
      );
    });
    afterEach(() => {
      warn.mockRestore();
      error.mockRestore();
      singleMember.mockRestore();
    });

    const createClosedAction = () =>
      createAction({ start: addDays(now, -3), deadline: addDays(now, -1) });

    it("stays quiet when the single-member path agrees", async () => {
      await createUser({ signedAt });
      await createUser({ signedAt, tagged: false });
      await createClosedAction();

      await service.resolveAll(now);

      expect(singleMember).toHaveBeenCalledTimes(2);
      expect(warn).not.toHaveBeenCalledWith(
        expect.stringContaining("single-member cohort path"),
      );
    });

    it("logs members the single-member path places differently", async () => {
      const member = await createUser({ signedAt });
      const action = await createClosedAction();
      singleMember.mockResolvedValue(false);

      await service.resolveAll(now);

      expect(warn).toHaveBeenCalledWith(
        `single-member cohort path disagrees with the backfill of action ${action.id} on member(s) 1 [${member.id}]`,
      );
    });

    it("still saves the backfill when the comparison fails", async () => {
      const member = await createUser({ signedAt });
      const action = await createClosedAction();
      singleMember.mockRejectedValue(new Error("boom"));

      await service.resolveAll(now);

      expect(error).toHaveBeenCalledWith(
        `Failed to compare cohort paths for action ${action.id}`,
        expect.any(Error),
      );
      expect((await decisionsFor(action.id)).get(member.id)).toMatchObject({
        included: true,
        reason: CohortDecisionReason.Backfill,
      });
    });
  });

  describe("logDivergences", () => {
    let warn: jest.SpyInstance;
    beforeEach(() => {
      warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    });
    afterEach(() => warn.mockRestore());

    it("logs members who left a profile-only cohort", async () => {
      const member = await createUser({ signedAt });
      const action = await createAction({
        start: addDays(now, -1),
        deadline: addDays(now, 3),
      });
      await service.resolveAll(now);
      await userRepo.save({ id: member.id, tags: [] });

      await divergenceService.logDivergences(now);

      expect(warn).toHaveBeenCalledWith(
        `cohort decisions for action ${action.id} diverge from the live cohort (profile-only expression): now in 0 [], now out 1 [${member.id}]`,
      );
    });

    it("logs members who joined an activity cohort", async () => {
      const member = await createUser({ signedAt });
      const upstream = await createAction({
        start: addDays(now, -2),
        deadline: addDays(now, 3),
      });
      const action = await createAction({
        start: addDays(now, -1),
        deadline: addDays(now, 3),
        cohortExpression: { type: "CompletedAction", actionId: upstream.id },
      });
      await service.resolveAll(now);
      await activityRepo.save({
        actionId: upstream.id,
        userId: member.id,
        type: ActionActivityType.USER_COMPLETED,
      });

      await divergenceService.logDivergences(now);

      expect(warn).toHaveBeenCalledWith(
        `cohort decisions for action ${action.id} diverge from the live cohort (activity-dependent expression): now in 1 [${member.id}], now out 0 []`,
      );
    });

    it("keeps checking other actions when one cohort fails", async () => {
      const member = await createUser({ signedAt });
      const broken = await createAction({
        start: addDays(now, -1),
        deadline: addDays(now, 3),
        cohortExpression: { type: "MissedActionDeadline", actionId: 999999 },
      });
      await decisionRepo.save({
        actionId: broken.id,
        userId: member.id,
        included: false,
        reason: CohortDecisionReason.Launch,
        resolvedAt: now,
      });
      const action = await createAction({
        start: addDays(now, -1),
        deadline: addDays(now, 3),
      });
      await decisionRepo.save({
        actionId: action.id,
        userId: member.id,
        included: false,
        reason: CohortDecisionReason.Launch,
        resolvedAt: now,
      });
      const error = jest
        .spyOn(Logger.prototype, "error")
        .mockImplementation(() => {});

      await divergenceService.logDivergences(now);

      expect(error).toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(
        `cohort decisions for action ${action.id} diverge from the live cohort (profile-only expression): now in 1 [${member.id}], now out 0 []`,
      );
      error.mockRestore();
    });

    it("stays quiet when decisions match the live cohort", async () => {
      await createUser({ signedAt });
      await createAction({
        start: addDays(now, -1),
        deadline: addDays(now, 3),
      });
      await service.resolveAll(now);

      await divergenceService.logDivergences(now);

      expect(warn).not.toHaveBeenCalled();
    });

    it("ignores resolved-after-deadline exclusions", async () => {
      const member = await createUser({ signedAt });
      const action = await createAction({
        start: addDays(now, -3),
        deadline: addDays(now, -1),
      });
      await decisionRepo.save({
        actionId: action.id,
        userId: member.id,
        included: false,
        reason: CohortDecisionReason.ResolvedAfterDeadline,
        resolvedAt: now,
      });

      await divergenceService.logDivergences(now);

      expect(warn).not.toHaveBeenCalled();
    });
  });
});
