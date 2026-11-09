import { CohortDecisionStaffService } from "../src/actions/cohort-decision-staff.service";
import {
  type ActionBranchFixtures,
  actionBranchFixtures,
} from "./action-branch-fixtures";
import { addDays } from "./cohort-decision-fixtures";
import { signAccessToken } from "./e2e-test-utils";
describe("Action branches: routing and copy (e2e)", () => {
  let ctx: ActionBranchFixtures["ctx"];
  let now: ActionBranchFixtures["now"];
  let signedAt: ActionBranchFixtures["signedAt"];
  let decisions: ActionBranchFixtures["decisions"];
  let actionRepo: ActionBranchFixtures["actionRepo"];
  let createUser: ActionBranchFixtures["createUser"];
  let decisionsFor: ActionBranchFixtures["decisionsFor"];
  let admin: ActionBranchFixtures["admin"];
  let manual: ActionBranchFixtures["manual"];
  let launchedAction: ActionBranchFixtures["launchedAction"];
  let addBranch: ActionBranchFixtures["addBranch"];
  let branchOf: ActionBranchFixtures["branchOf"];
  let createAction: ActionBranchFixtures["createAction"];
  let newForm: ActionBranchFixtures["newForm"];
  let cleanUp: ActionBranchFixtures["cleanUp"];

  beforeAll(async () => {
    ({
      ctx,
      newForm,
      createAction,
      now,
      signedAt,
      decisions,
      actionRepo,
      createUser,
      decisionsFor,
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
        .put(`/actions/${action.id}/branches/order`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ branchIds: [b.id, a.id] });
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

    it("rejects branches on an action with a random split", async () => {
      const action = await launchedAction();
      const split = await admin()
        .post(`/actions/${action.id}/form-variants`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ name: "Split", splitValue: 0.5 });
      expect(split.status).toBe(201);

      const res = await admin()
        .post(`/actions/${action.id}/branches`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ name: "A", rule: { type: "AllMembers" } });

      expect(res.status).toBe(400);
    });

    it("numbers each branch's form after the action's other forms", async () => {
      const action = await launchedAction();
      const first = await addBranch({
        actionId: action.id,
        name: "A",
        rule: { type: "AllMembers" },
      });
      const second = await addBranch({
        actionId: action.id,
        name: "B",
        rule: { type: "AllMembers" },
      });

      const slugs = await ctx.dataSource.query<{ id: number; slug: string }[]>(
        `SELECT id, slug FROM form WHERE id = ANY($1)`,
        [[first.formId, second.formId]],
      );
      expect(new Set(slugs.map((form) => form.slug)).size).toBe(2);
    });

    it("refuses a branch's form as another action's task form", async () => {
      const action = await launchedAction();
      const other = await launchedAction();
      const added = await addBranch({
        actionId: action.id,
        name: "A",
        rule: { type: "AllMembers" },
      });

      const res = await admin()
        .patch(`/actions/${other.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ taskFormId: added.formId });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("branch form");
    });

    it("rejects branches on a public-only action", async () => {
      const action = await launchedAction();
      await actionRepo.update(action.id, { publicOnly: true });

      const res = await admin()
        .post(`/actions/${action.id}/branches`)
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
});
