import { ActionActivityType } from "@alliance/common/actionActivity";
import type { CohortExpression } from "@alliance/common/cohort-expression";
import { ActionFormAssignmentService } from "../src/actions/action-form-assignment.service";
import { ActionActivity } from "../src/actions/entities/action-activity.entity";
import { ActionFormVariant } from "../src/actions/entities/action-form-variant.entity";
import {
  Notification,
  NotificationCategory,
} from "../src/notifs/entities/notification.entity";
import { FormResponse } from "../src/tasks/entities/formresponse.entity";
import {
  type ActionBranchFixtures,
  actionBranchFixtures,
} from "./action-branch-fixtures";
import { addDays } from "./cohort-decision-fixtures";
import { signAccessToken } from "./e2e-test-utils";
describe("Action branches: moves and re-routes (e2e)", () => {
  let ctx: ActionBranchFixtures["ctx"];
  let now: ActionBranchFixtures["now"];
  let signedAt: ActionBranchFixtures["signedAt"];
  let decisions: ActionBranchFixtures["decisions"];
  let actionRepo: ActionBranchFixtures["actionRepo"];
  let branchRepo: ActionBranchFixtures["branchRepo"];
  let assignmentRepo: ActionBranchFixtures["assignmentRepo"];
  let createUser: ActionBranchFixtures["createUser"];
  let admin: ActionBranchFixtures["admin"];
  let manual: ActionBranchFixtures["manual"];
  let launchedAction: ActionBranchFixtures["launchedAction"];
  let addBranch: ActionBranchFixtures["addBranch"];
  let branchOf: ActionBranchFixtures["branchOf"];
  let createAction: ActionBranchFixtures["createAction"];
  let cleanUp: ActionBranchFixtures["cleanUp"];

  beforeAll(async () => {
    ({
      ctx,
      createAction,
      now,
      signedAt,
      decisions,
      actionRepo,
      branchRepo,
      assignmentRepo,
      createUser,
      admin,
      manual,
      launchedAction,
      addBranch,
      branchOf,
      cleanUp,
    } = await actionBranchFixtures());
  }, 50000);

  afterEach(() => cleanUp());

  afterAll(async () => {
    await ctx.app.close();
  });

  describe("staff moves", () => {
    const move = (actionId: number, body: object) =>
      admin()
        .post(`/actions/${actionId}/branches/move`)
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
        branchId: b.id,
        notify: true,
      });

      expect(res.status).toBe(201);
      const assignment = await assignmentRepo.findOneOrFail({
        where: { actionId: action.id, userId: member.id },
      });
      expect(assignment).toMatchObject({
        branchId: b.id,
        variantId: null,
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
        branchId: b.id,
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
        branchId: a.id,
        notify: false,
      });

      expect(res.status).toBe(400);
    });

    it("moves a member between a split action's variants", async () => {
      const member = await createUser({ signedAt });
      const action = await launchedAction();
      const created = await Promise.all(
        ["A", "B"].map((name) =>
          admin()
            .post(`/actions/${action.id}/form-variants`)
            .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
            .send({ name, splitValue: 0.5 }),
        ),
      );
      const [a, b] = created.map((res) => res.body as ActionFormVariant);
      await assignmentRepo.save(
        assignmentRepo.create({
          actionId: action.id,
          userId: member.id,
          variantId: a.id,
          branchId: null,
        }),
      );

      const res = await admin()
        .post(`/actions/${action.id}/form-variants/move`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ userId: member.id, variantId: b.id, notify: false });

      expect(res.status).toBe(201);
      expect(
        await assignmentRepo.findOneOrFail({
          where: { actionId: action.id, userId: member.id },
        }),
      ).toMatchObject({ variantId: b.id, overriddenById: ctx.adminUserId });
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
      const oldForm = await branchRepo.findOneByOrFail({ id: a.id });
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
        branchId: b.id,
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
        .post(`/actions/${actionId}/branches/reroute`)
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
        .post(`/actions/${action.id}/branches/move`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ userId: handMoved.id, branchId: b.id, notify: false });
      await admin()
        .patch(`/actions/branches/${a.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ rule: manual(handMoved) });
      await admin()
        .patch(`/actions/branches/${b.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ rule: manual(shifts) });

      const preview = await admin()
        .get(`/actions/${action.id}/branches/reroute`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`);
      expect(preview.body.moves).toEqual([
        { userId: shifts.id, fromBranchId: a.id, toBranchId: b.id },
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
        .post(`/actions/${actionId}/branches/routing-preview`)
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
