import { ActionActivityType } from "@alliance/common/actionActivity";
import type { CohortExpression } from "@alliance/common/cohort-expression";
import type { FormSchema } from "@alliance/common/forms/form-schema";
import request from "supertest";
import type { Repository } from "typeorm";
import { CohortDecisionService } from "../src/actions/cohort-decision.service";
import { ActionActivity } from "../src/actions/entities/action-activity.entity";
import { ActionCohortDecision } from "../src/actions/entities/action-cohort-decision.entity";
import {
  ActionEvent,
  ActionStatus,
} from "../src/actions/entities/action-event.entity";
import { ActionFormAssignment } from "../src/actions/entities/action-form-assignment.entity";
import { ActionFormVariant } from "../src/actions/entities/action-form-variant.entity";
import { Action } from "../src/actions/entities/action.entity";
import { CohortDecisionReason } from "../src/actions/entities/cohort-decision-reason";
import { ActionEventRecipientService } from "../src/notifs/action-event-recipient.service";
import { TasksModule } from "../src/tasks/tasks.module";
import type { User } from "../src/user/entities/user.entity";
import {
  addDays,
  cohortDecisionFixtures,
  type CohortDecisionFixtures,
} from "./cohort-decision-fixtures";
import {
  createFormWithSnapshot,
  createTestApp,
  signAccessToken,
  type TestContext,
} from "./e2e-test-utils";

describe("Optional branches and skipping (e2e)", () => {
  let ctx: TestContext;
  let decisions: CohortDecisionService;
  let actionRepo: Repository<Action>;
  let activityRepo: Repository<ActionActivity>;
  let createUser: CohortDecisionFixtures["createUser"];
  let createAction: CohortDecisionFixtures["createAction"];
  let decisionsFor: CohortDecisionFixtures["decisionsFor"];
  let cleanUp: CohortDecisionFixtures["cleanUp"];

  const now = new Date();
  const signedAt = addDays(now, -30);
  const reason = "You're donating food this week.";

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    decisions = ctx.app.get(CohortDecisionService);
    actionRepo = ctx.dataSource.getRepository(Action);
    activityRepo = ctx.dataSource.getRepository(ActionActivity);
    ({ createUser, createAction, decisionsFor, cleanUp } =
      cohortDecisionFixtures(ctx));
  }, 50000);

  afterEach(async () => {
    await ctx.dataSource.query("DELETE FROM action_form_assignment");
    await ctx.dataSource.query("DELETE FROM action_form_variant");
    await cleanUp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const server = () => request(ctx.app.getHttpServer());
  const tokenFor = (user: User) => signAccessToken(ctx.jwtService, user);

  const withForm = async (
    action: Action,
    schema: FormSchema = { pages: [], outputViews: [] },
  ) => {
    const { form } = await createFormWithSnapshot(ctx.dataSource, {
      title: "Form",
      schema,
    });
    await actionRepo.update(action.id, { taskFormId: form.id });
    return form;
  };

  const manual = (...users: User[]): CohortExpression => ({
    type: "Manual",
    userIds: users.map((u) => u.id),
  });

  const addBranch = async (params: {
    actionId: number;
    name: string;
    rule: CohortExpression;
    optional?: boolean;
    optionalReason?: string;
  }) => {
    const { actionId, ...body } = params;
    const res = await server()
      .post(`/actions/${actionId}/form-variants`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send(body);
    expect(res.status).toBe(201);
    return res.body as ActionFormVariant;
  };

  /** One member on an optional branch, one on a required branch. */
  const branchedAction = async (params: { start: Date; deadline: Date }) => {
    const [optionalMember, requiredMember] = await Promise.all([
      createUser({ signedAt }),
      createUser({ signedAt }),
    ]);
    const action = await createAction(params);
    await withForm(action);
    await addBranch({
      actionId: action.id,
      name: "Donating food",
      rule: manual(optionalMember),
      optional: true,
      optionalReason: reason,
    });
    await addBranch({
      actionId: action.id,
      name: "Not donating food",
      rule: manual(requiredMember),
    });
    return { action, optionalMember, requiredMember };
  };

  it("tells a member on an optional branch the action is optional for them, with the branch's reason", async () => {
    const { action, optionalMember, requiredMember } = await branchedAction({
      start: addDays(now, -1),
      deadline: addDays(now, 5),
    });
    await decisions.resolveAll(now);

    const viewerOf = async (user: User) =>
      (
        await server()
          .get(`/actions/slug/${action.id}`)
          .set("Authorization", `Bearer ${tokenFor(user)}`)
          .expect(200)
      ).body.viewer;

    expect(await viewerOf(optionalMember)).toMatchObject({
      optional: true,
      optionalReason: "branch",
      optionalReasonText: reason,
      display: "optional_task",
    });
    expect(await viewerOf(requiredMember)).toMatchObject({
      optional: false,
      optionalReason: null,
      optionalReasonText: null,
    });
  });

  it("reminds only the member on the required branch", async () => {
    const { action, optionalMember, requiredMember } = await branchedAction({
      start: addDays(now, -1),
      deadline: addDays(now, 5),
    });
    await decisions.resolveAll(now);
    const events = await ctx.dataSource.getRepository(ActionEvent).find({
      where: { action: { id: action.id } },
      relations: { action: true },
    });
    const start = events.find((e) => e.newStatus === ActionStatus.MemberAction);
    const deadline = events.find(
      (e) => e.newStatus === ActionStatus.Resolution,
    );

    const reminded = await ctx.app
      .get(ActionEventRecipientService)
      .filterForShouldRemind(
        [optionalMember, requiredMember],
        start!,
        deadline ?? null,
      );

    expect(reminded.map((user) => user.id)).toEqual([requiredMember.id]);
  });

  it("includes a member decided late onto an optional branch instead of excluding them as late", async () => {
    const upstream = await createAction({
      start: addDays(now, -3),
      deadline: addDays(now, 1),
    });
    const { action, optionalMember, requiredMember } = await branchedAction({
      start: addDays(now, -3),
      deadline: addDays(now, -1),
    });
    await actionRepo.update(action.id, {
      prerequisiteActionIds: [upstream.id],
    });
    // Seed a decision so the closed action reads as already resolving.
    const seeded = await createUser({ signedAt });
    await ctx.dataSource.getRepository(ActionCohortDecision).save({
      actionId: action.id,
      userId: seeded.id,
      included: true,
      reason: CohortDecisionReason.PrerequisitesResolved,
      resolvedAt: addDays(now, -2),
    });
    for (const member of [optionalMember, requiredMember]) {
      await activityRepo.save({
        actionId: upstream.id,
        userId: member.id,
        type: ActionActivityType.USER_COMPLETED,
      });
    }

    await decisions.resolveAll(now);

    const saved = await decisionsFor(action.id);
    expect(saved.get(optionalMember.id)).toMatchObject({ included: true });
    expect(saved.get(requiredMember.id)).toMatchObject({
      included: false,
      reason: CohortDecisionReason.ResolvedAfterDeadline,
    });
    expect(
      await ctx.dataSource
        .getRepository(ActionFormAssignment)
        .findOne({ where: { actionId: action.id, userId: optionalMember.id } }),
    ).not.toBeNull();
  });

  describe("skip if", () => {
    const skippable: FormSchema = {
      pages: [
        {
          id: "p1",
          fields: [
            { id: "fit", type: "input", kind: "text", label: "Fit" },
            {
              id: "essay",
              type: "input",
              kind: "text",
              label: "Essay",
              required: true,
            },
          ],
        },
      ],
      outputViews: [],
      skipIfFormula: {
        conditions: { c1: { kind: "equals", when: "fit", equals: "no" } },
        formula: "c1",
      },
    };

    const openActionWithMember = async () => {
      const member = await createUser({ signedAt });
      const action = await createAction({
        start: addDays(now, -1),
        deadline: addDays(now, 5),
      });
      const form = await withForm(action, skippable);
      await decisions.resolveAll(now);
      const submit = (answers: Record<string, string>) =>
        server()
          .post(`/tasks/submitForm/${form.id}`)
          .set("Authorization", `Bearer ${tokenFor(member)}`)
          .send({
            answers,
            formSnapshotId: form.formSnapshotId,
            actionId: action.id,
            deviceType: "desktop" as const,
          });
      return { member, action, submit };
    };

    it('records a "Doesn\'t apply to me" withdrawal without the required fields', async () => {
      const { member, action, submit } = await openActionWithMember();

      await submit({ fit: "no" }).expect(201);

      const activities = await activityRepo.find({
        where: { actionId: action.id, userId: member.id },
      });
      expect(activities).toEqual([
        expect.objectContaining({
          type: ActionActivityType.USER_WONT_COMPLETE,
          doesntApply: true,
        }),
      ]);
    });

    it("still requires the required fields while the formula doesn't hold", async () => {
      const { submit } = await openActionWithMember();

      await submit({ fit: "yes" }).expect(400);
    });

    it("refuses a skip formula on a contract-signing action's form", async () => {
      const action = await createAction({
        start: addDays(now, -1),
        deadline: addDays(now, 5),
      });
      const form = await withForm(action);
      await actionRepo.update(action.id, { isContractSigningAction: true });

      const res = await server()
        .put(`/tasks/updateForm/${form.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ schema: skippable });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain(
        "A contract-signing action can't be skipped",
      );
    });
  });
});
