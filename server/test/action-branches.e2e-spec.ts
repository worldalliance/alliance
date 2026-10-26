import { ActionActivityType } from "@alliance/common/actionActivity";
import type { CohortExpression } from "@alliance/common/cohort-expression";
import request from "supertest";
import type { Repository } from "typeorm";
import { ActionFormAssignmentService } from "../src/actions/action-form-assignment.service";
import { CohortDecisionStaffService } from "../src/actions/cohort-decision-staff.service";
import { CohortDecisionService } from "../src/actions/cohort-decision.service";
import { ActionActivity } from "../src/actions/entities/action-activity.entity";
import { ActionFormAssignment } from "../src/actions/entities/action-form-assignment.entity";
import { ActionFormVariant } from "../src/actions/entities/action-form-variant.entity";
import { Action } from "../src/actions/entities/action.entity";
import {
  Notification,
  NotificationCategory,
} from "../src/notifs/entities/notification.entity";
import { FormResponse } from "../src/tasks/entities/formresponse.entity";
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

describe("Rule-routed action branches (e2e)", () => {
  let ctx: TestContext;
  let decisions: CohortDecisionService;
  let actionRepo: Repository<Action>;
  let variantRepo: Repository<ActionFormVariant>;
  let assignmentRepo: Repository<ActionFormAssignment>;
  let createUser: CohortDecisionFixtures["createUser"];
  let createAction: CohortDecisionFixtures["createAction"];
  let decisionsFor: CohortDecisionFixtures["decisionsFor"];
  let cleanUp: CohortDecisionFixtures["cleanUp"];

  const now = new Date();
  const signedAt = addDays(now, -30);

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    decisions = ctx.app.get(CohortDecisionService);
    actionRepo = ctx.dataSource.getRepository(Action);
    variantRepo = ctx.dataSource.getRepository(ActionFormVariant);
    assignmentRepo = ctx.dataSource.getRepository(ActionFormAssignment);
    ({ createUser, createAction, decisionsFor, cleanUp } =
      cohortDecisionFixtures(ctx));
  }, 50000);

  afterEach(async () => {
    await assignmentRepo.query("DELETE FROM action_form_assignment");
    await variantRepo.query("DELETE FROM action_form_variant");
    await ctx.dataSource.query(
      `DELETE FROM notification WHERE category = '${NotificationCategory.ActionBranchMoved}'`,
    );
    await cleanUp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const admin = () => request(ctx.app.getHttpServer());

  const newForm = async () =>
    (
      await createFormWithSnapshot(ctx.dataSource, {
        title: "Form",
        schema: { pages: [], outputViews: [] },
      })
    ).form;

  const manual = (...users: User[]): CohortExpression => ({
    type: "Manual",
    userIds: users.map((u) => u.id),
  });

  const launchedAction = async () => {
    const action = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 5),
    });
    await actionRepo.update(action.id, { taskFormId: (await newForm()).id });
    return action;
  };

  const addBranch = async (params: {
    actionId: number;
    name: string;
    rule: CohortExpression;
    nameOverride?: string;
  }) => {
    const { actionId, ...body } = params;
    const res = await admin()
      .post(`/actions/${actionId}/form-variants`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send(body);
    expect(res.status).toBe(201);
    return res.body as ActionFormVariant;
  };

  const branchOf = async (actionId: number, userId: number) =>
    (await assignmentRepo.findOne({ where: { actionId, userId } }))?.variantId;

  describe("routing at the cohort decision", () => {
    it("routes each member to their first matching branch and excludes members matching none", async () => {
      const [both, second, neither] = await Promise.all([
        createUser({ signedAt }),
        createUser({ signedAt }),
        createUser({ signedAt }),
      ]);
      const action = await launchedAction();
      const first = await addBranch({
        actionId: action.id,
        name: "Yes",
        rule: manual(both),
      });
      const fallback = await addBranch({
        actionId: action.id,
        name: "No",
        rule: manual(both, second),
      });

      await decisions.resolveAll(now);

      const saved = await decisionsFor(action.id);
      expect(saved.get(both.id)?.included).toBe(true);
      expect(saved.get(second.id)?.included).toBe(true);
      expect(saved.get(neither.id)?.included).toBe(false);
      expect(await branchOf(action.id, both.id)).toBe(first.id);
      expect(await branchOf(action.id, second.id)).toBe(fallback.id);
      expect(await branchOf(action.id, neither.id)).toBeUndefined();
    });

    it("follows the staff-set branch order", async () => {
      const member = await createUser({ signedAt });
      const action = await launchedAction();
      const a = await addBranch({
        actionId: action.id,
        name: "A",
        rule: manual(member),
      });
      const b = await addBranch({
        actionId: action.id,
        name: "B",
        rule: manual(member),
      });
      const reorder = await admin()
        .put(`/actions/${action.id}/form-variants/order`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ variantIds: [b.id, a.id] });
      expect(reorder.status).toBe(200);

      await decisions.resolveAll(now);

      expect(await branchOf(action.id, member.id)).toBe(b.id);
    });

    it("gives a member staff include their first matching branch", async () => {
      const member = await createUser({ signedAt });
      const action = await launchedAction();
      const only = await addBranch({
        actionId: action.id,
        name: "Only",
        rule: { type: "Manual", userIds: [] },
      });
      await decisions.resolveAll(now);
      expect((await decisionsFor(action.id)).get(member.id)?.included).toBe(
        false,
      );

      await ctx.app.get(CohortDecisionStaffService).correct({
        actionId: action.id,
        userId: member.id,
        included: true,
        note: "Belongs here",
        staffUserId: ctx.adminUserId,
        now,
      });

      expect(await branchOf(action.id, member.id)).toBe(only.id);
    });
  });

  describe("branch setup", () => {
    it("rejects mixing a random split with branch rules", async () => {
      const member = await createUser({ signedAt });
      const action = await launchedAction();
      await addBranch({ actionId: action.id, name: "A", rule: manual(member) });

      const res = await admin()
        .post(`/actions/${action.id}/form-variants`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ name: "Split", splitValue: 0.5 });

      expect(res.status).toBe(400);
    });

    it("rejects branches on a public-only action", async () => {
      const action = await launchedAction();
      await actionRepo.update(action.id, { publicOnly: true });

      const res = await admin()
        .post(`/actions/${action.id}/form-variants`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ name: "A", rule: { type: "AllMembers" } });

      expect(res.status).toBe(400);
    });
  });

  describe("branch copy", () => {
    it("shows a routed member their branch's copy and form", async () => {
      const member = await createUser({ signedAt });
      const action = await launchedAction();
      const branch = await addBranch({
        actionId: action.id,
        name: "Standby",
        rule: manual(member),
        nameOverride: "Join the standby list",
      });
      await decisions.resolveAll(now);

      const res = await admin()
        .get(`/actions/slug/${action.id}`)
        .set(
          "Authorization",
          `Bearer ${signAccessToken(ctx.jwtService, member)}`,
        );

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Join the standby list");
      expect(res.body.shortDescription).toBe("Short description");
      expect(res.body.taskFormId).toBe(branch.formId);
    });

    it("assigns no branch on a view before launch", async () => {
      const member = await createUser({ signedAt });
      const action = await createAction({
        start: addDays(now, 2),
        deadline: addDays(now, 5),
      });
      await actionRepo.update(action.id, { taskFormId: (await newForm()).id });
      await addBranch({ actionId: action.id, name: "A", rule: manual(member) });

      await admin()
        .get(`/actions/slug/${action.id}`)
        .set(
          "Authorization",
          `Bearer ${signAccessToken(ctx.jwtService, member)}`,
        );

      expect(await branchOf(action.id, member.id)).toBeUndefined();
    });
  });

  describe("staff moves", () => {
    const move = (actionId: number, body: object) =>
      admin()
        .post(`/actions/${actionId}/form-assignments/move`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send(body);

    it("moves a completed member, withdraws the completion, and notifies them", async () => {
      const member = await createUser({ signedAt });
      const action = await launchedAction();
      await addBranch({ actionId: action.id, name: "A", rule: manual(member) });
      const b = await addBranch({
        actionId: action.id,
        name: "B",
        rule: { type: "Manual", userIds: [] },
        nameOverride: "Join the standby list",
      });
      await decisions.resolveAll(now);
      const activities = ctx.dataSource.getRepository(ActionActivity);
      await activities.save(
        activities.create({
          actionId: action.id,
          userId: member.id,
          type: ActionActivityType.USER_COMPLETED,
        }),
      );

      const res = await move(action.id, {
        userId: member.id,
        variantId: b.id,
        notify: true,
      });

      expect(res.status).toBe(201);
      const assignment = await assignmentRepo.findOneOrFail({
        where: { actionId: action.id, userId: member.id },
      });
      expect(assignment).toMatchObject({
        variantId: b.id,
        overriddenById: ctx.adminUserId,
        overriddenAt: expect.any(Date),
      });
      expect(
        await activities.count({
          where: { actionId: action.id, userId: member.id },
        }),
      ).toBe(0);
      const inbox = await admin()
        .get("/notifs")
        .set(
          "Authorization",
          `Bearer ${signAccessToken(ctx.jwtService, member)}`,
        );
      expect(
        (inbox.body as { category: string; message: string }[])
          .filter((n) => n.category === NotificationCategory.ActionBranchMoved)
          .map((n) => n.message),
      ).toEqual(["Your action is now Join the standby list"]);
    });

    it("skips the notice when staff untick notify", async () => {
      const member = await createUser({ signedAt });
      const action = await launchedAction();
      await addBranch({ actionId: action.id, name: "A", rule: manual(member) });
      const b = await addBranch({
        actionId: action.id,
        name: "B",
        rule: { type: "Manual", userIds: [] },
      });
      await decisions.resolveAll(now);

      await move(action.id, {
        userId: member.id,
        variantId: b.id,
        notify: false,
      });

      expect(
        await ctx.dataSource.getRepository(Notification).count({
          where: {
            user: { id: member.id },
            category: NotificationCategory.ActionBranchMoved,
          },
        }),
      ).toBe(0);
    });

    it("refuses to move a member who isn't routed to a branch", async () => {
      const member = await createUser({ signedAt });
      const action = await launchedAction();
      const a = await addBranch({
        actionId: action.id,
        name: "A",
        rule: { type: "Manual", userIds: [] },
      });
      await decisions.resolveAll(now);

      const res = await move(action.id, {
        userId: member.id,
        variantId: a.id,
        notify: false,
      });

      expect(res.status).toBe(400);
    });

    it("lets a moved member submit their new branch's form", async () => {
      const member = await createUser({ signedAt });
      const action = await launchedAction();
      const a = await addBranch({
        actionId: action.id,
        name: "A",
        rule: manual(member),
      });
      const b = await addBranch({
        actionId: action.id,
        name: "B",
        rule: { type: "Manual", userIds: [] },
      });
      await decisions.resolveAll(now);
      const responses = ctx.dataSource.getRepository(FormResponse);
      const oldForm = await variantRepo.findOneByOrFail({ id: a.id });
      const { formSnapshotId } = await ctx.dataSource
        .getRepository("form")
        .findOneByOrFail({ id: oldForm.formId });
      await responses.save(
        responses.create({
          formId: oldForm.formId,
          user: { id: member.id },
          answers: {},
          formSnapshotId,
        }),
      );
      const formAssignments = ctx.app.get(ActionFormAssignmentService);
      const params = { actionId: action.id, userId: member.id };
      expect(await formAssignments.hasSubmittedAssignedForm(params)).toBe(true);

      await move(action.id, {
        userId: member.id,
        variantId: b.id,
        notify: false,
      });

      expect(await formAssignments.hasSubmittedAssignedForm(params)).toBe(
        false,
      );
    });
  });

  describe("re-route", () => {
    const reroute = (actionId: number, notify: boolean) =>
      admin()
        .post(`/actions/${actionId}/form-assignments/reroute`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ notify });

    it("moves unsubmitted members to their new first match, leaving hand-moved and unmatched members", async () => {
      const [shifts, handMoved, unmatched] = await Promise.all([
        createUser({ signedAt }),
        createUser({ signedAt }),
        createUser({ signedAt }),
      ]);
      const action = await launchedAction();
      const a = await addBranch({
        actionId: action.id,
        name: "A",
        rule: manual(shifts, handMoved, unmatched),
      });
      const b = await addBranch({
        actionId: action.id,
        name: "B",
        rule: { type: "Manual", userIds: [] },
      });
      await decisions.resolveAll(now);
      await admin()
        .post(`/actions/${action.id}/form-assignments/move`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ userId: handMoved.id, variantId: b.id, notify: false });
      await admin()
        .patch(`/actions/form-variants/${a.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ rule: manual(handMoved) });
      await admin()
        .patch(`/actions/form-variants/${b.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ rule: manual(shifts) });

      const preview = await admin()
        .get(`/actions/${action.id}/form-assignments/reroute`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`);
      expect(preview.body.moves).toEqual([
        { userId: shifts.id, fromVariantId: a.id, toVariantId: b.id },
      ]);

      const res = await reroute(action.id, true);

      expect(res.status).toBe(201);
      expect(await branchOf(action.id, shifts.id)).toBe(b.id);
      expect(await branchOf(action.id, handMoved.id)).toBe(b.id);
      expect(await branchOf(action.id, unmatched.id)).toBe(a.id);
      expect(
        await ctx.dataSource.getRepository(Notification).count({
          where: { category: NotificationCategory.ActionBranchMoved },
        }),
      ).toBe(1);
    });
  });

  describe("routing preview", () => {
    const preview = (actionId: number, rules: CohortExpression[]) =>
      admin()
        .post(`/actions/${actionId}/form-variants/routing-preview`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ rules });

    it("gives each rule only the members no earlier rule took", async () => {
      const [a, b, c] = await Promise.all([
        createUser({ signedAt }),
        createUser({ signedAt }),
        createUser({ signedAt }),
      ]);
      const action = await launchedAction();

      const res = await preview(action.id, [
        manual(a),
        manual(a, b),
        { type: "AllMembers" },
      ]);

      expect(res.status).toBe(201);
      const [first, second, rest] = (
        res.body.branches as { userIds: number[] }[]
      ).map((branch) => new Set(branch.userIds));
      expect([...first]).toEqual([a.id]);
      expect([...second]).toEqual([b.id]);
      expect(rest.has(c.id)).toBe(true);
      expect(rest.has(a.id) || rest.has(b.id)).toBe(false);
    });

    it("leaves out members whose prerequisites haven't resolved", async () => {
      const [done, pending] = await Promise.all([
        createUser({ signedAt }),
        createUser({ signedAt }),
      ]);
      const prerequisite = await createAction({
        start: addDays(now, -3),
        deadline: addDays(now, 5),
      });
      const action = await launchedAction();
      await actionRepo.update(action.id, {
        prerequisiteActionIds: [prerequisite.id],
      });
      const activities = ctx.dataSource.getRepository(ActionActivity);
      await activities.save(
        activities.create({
          actionId: prerequisite.id,
          userId: done.id,
          type: ActionActivityType.USER_COMPLETED,
        }),
      );

      const res = await preview(action.id, [manual(done, pending)]);

      expect(res.body.branches).toEqual([{ userIds: [done.id] }]);
    });
  });
});
