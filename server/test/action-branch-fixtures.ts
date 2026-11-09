import type { CohortExpression } from "@alliance/common/cohort-expression";
import request from "supertest";
import { CohortDecisionService } from "../src/actions/cohort-decision.service";
import { ActionBranch } from "../src/actions/entities/action-branch.entity";
import { ActionFormAssignment } from "../src/actions/entities/action-form-assignment.entity";
import { ActionFormVariant } from "../src/actions/entities/action-form-variant.entity";
import { Action } from "../src/actions/entities/action.entity";
import { NotificationCategory } from "../src/notifs/entities/notification.entity";
import { TasksModule } from "../src/tasks/tasks.module";
import type { User } from "../src/user/entities/user.entity";
import { addDays, cohortDecisionFixtures } from "./cohort-decision-fixtures";
import { createFormWithSnapshot, createTestApp } from "./e2e-test-utils";

export async function actionBranchFixtures() {
  const ctx = await createTestApp([TasksModule]);
  const now = new Date();
  const actionRepo = ctx.dataSource.getRepository(Action);
  const branchRepo = ctx.dataSource.getRepository(ActionBranch);
  const variantRepo = ctx.dataSource.getRepository(ActionFormVariant);
  const assignmentRepo = ctx.dataSource.getRepository(ActionFormAssignment);
  const cohort = cohortDecisionFixtures(ctx);

  const admin = () => request(ctx.app.getHttpServer());

  const newForm = async () =>
    (
      await createFormWithSnapshot(ctx.dataSource, {
        title: "Form",
        schema: { pages: [], outputViews: [] },
      })
    ).form;

  return {
    ctx,
    now,
    signedAt: addDays(now, -30),
    decisions: ctx.app.get(CohortDecisionService),
    actionRepo,
    branchRepo,
    variantRepo,
    assignmentRepo,
    createUser: cohort.createUser,
    createAction: cohort.createAction,
    newForm,
    decisionsFor: cohort.decisionsFor,
    admin,

    manual: (...users: User[]): CohortExpression => ({
      type: "Manual",
      userIds: users.map((u) => u.id),
    }),

    launchedAction: async () => {
      const action = await cohort.createAction({
        start: addDays(now, -1),
        deadline: addDays(now, 5),
      });
      await actionRepo.update(action.id, { taskFormId: (await newForm()).id });
      return action;
    },

    addBranch: async (params: {
      actionId: number;
      name: string;
      rule: CohortExpression;
      nameOverride?: string;
    }) => {
      const { actionId, ...body } = params;
      const res = await admin()
        .post(`/actions/${actionId}/branches`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send(body);
      expect(res.status).toBe(201);
      return res.body as ActionBranch;
    },

    branchOf: async (actionId: number, userId: number) =>
      (await assignmentRepo.findOne({ where: { actionId, userId } }))?.branchId,

    cleanUp: async () => {
      await assignmentRepo.query("DELETE FROM action_form_assignment");
      await branchRepo.query("DELETE FROM action_branch");
      await variantRepo.query("DELETE FROM action_form_variant");
      await ctx.dataSource.query(
        `DELETE FROM notification WHERE category = '${NotificationCategory.ActionBranchMoved}'`,
      );
      await cohort.cleanUp();
    },
  };
}

export type ActionBranchFixtures = Awaited<
  ReturnType<typeof actionBranchFixtures>
>;
