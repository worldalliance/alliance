import type { FormSchema } from "@alliance/common/forms/form-schema";
import { milliseconds } from "date-fns";
import type { ActionDto, CreateActionDto } from "src/actions/dto/action.dto";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { ActionFormAssignment } from "src/actions/entities/action-form-assignment.entity";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
import { TasksModule } from "src/tasks/tasks.module";
import request from "supertest";
import type { Repository } from "typeorm";
import { KeepSubmittersOnTaskForm1791762748605 } from "../migrations/1791762748605-KeepSubmittersOnTaskForm";
import { createTestApp, TestContext } from "./e2e-test-utils";

const schema: FormSchema = {
  pages: [
    {
      id: "page-1",
      fields: [{ id: "note", type: "input", kind: "text", label: "Note" }],
    },
  ],
  outputViews: [],
  aggregateViews: [],
};

describe("Form variant assignment (e2e)", () => {
  let ctx: TestContext;
  let actionRepo: Repository<Action>;
  let assignmentRepo: Repository<ActionFormAssignment>;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    actionRepo = ctx.dataSource.getRepository(Action);
    assignmentRepo = ctx.dataSource.getRepository(ActionFormAssignment);
  }, 50000);

  afterEach(async () => {
    await actionRepo.query("DELETE FROM action_form_assignment");
    await actionRepo.query("DELETE FROM form_response");
    await actionRepo.query("DELETE FROM action_form_variant");
    await actionRepo.query("DELETE FROM action");
    await actionRepo.query("DELETE FROM form");
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  /** A live action on a task form, with a variant every new member draws. */
  const createActionAddingVariant = async (params: { submitted: boolean }) => {
    const action = await actionRepo.save(
      actionRepo.create({
        name: "Variant Later",
        category: [],
        body: "Body copy",
        shortDescription: "Short copy",
        isForumParticipationAction: false,
        shouldCompleteAfterDeadline: false,
        visibilityMode: VisibilityMode.Public,
        preventCompletion: false,
        optional: false,
        publicOnly: false,
        isContractSigningAction: false,
        onboarding: false,
        cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
      } satisfies CreateActionDto),
    );
    await ctx.dataSource.getRepository(ActionEvent).save({
      title: "Member phase",
      description: "Member phase",
      newStatus: ActionStatus.MemberAction,
      date: new Date(Date.now() - milliseconds({ hours: 1 })),
      action,
    });
    const form = await request(server())
      .post("/tasks/createForm")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ title: "Task form", schema })
      .expect(201);
    const taskFormId: number = form.body.id;
    await actionRepo.update(action.id, { taskFormId });

    if (params.submitted) {
      await request(server())
        .post(`/tasks/submitForm/${taskFormId}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          answers: { note: "Before the variant" },
          formSnapshotId: form.body.formSnapshotId,
          actionId: action.id,
          deviceType: "desktop" as const,
        })
        .expect(201);
    }

    const variant = await request(server())
      .post(`/actions/${action.id}/form-variants`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ name: "B", splitValue: 1 })
      .expect(201);

    return {
      actionId: action.id,
      taskFormId,
      variantId: variant.body.id as number,
      variantFormId: variant.body.formId as number,
    };
  };

  const assignedVariantId = async (actionId: number) =>
    (
      await assignmentRepo.findOneByOrFail({
        actionId,
        userId: ctx.testUserId,
      })
    ).variantId;

  const listedTaskFormId = async (actionId: number) => {
    const listed = await request(server())
      .get("/actions/loggedIn")
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(200);
    return (listed.body as ActionDto[]).find((a) => a.id === actionId)
      ?.taskFormId;
  };

  it("keeps a member who submitted the task form on it when a variant is added", async () => {
    const { actionId, taskFormId } = await createActionAddingVariant({
      submitted: true,
    });

    expect(await listedTaskFormId(actionId)).toBe(taskFormId);
    expect(await assignedVariantId(actionId)).toBeNull();
  });

  it("keeps a member who submitted the task form on it when they next open the form", async () => {
    const { actionId, taskFormId } = await createActionAddingVariant({
      submitted: true,
    });

    const refused = await request(server())
      .put(`/tasks/formDraft/${taskFormId}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send({ actionId, formSnapshotId: 0, answers: {} })
      .expect(400);

    expect(refused.body.message).toBe("Form already submitted");
    expect(await assignedVariantId(actionId)).toBeNull();
  });

  it("still draws a variant for a member who has not submitted", async () => {
    const { actionId, variantId, variantFormId } =
      await createActionAddingVariant({ submitted: false });

    expect(await listedTaskFormId(actionId)).toBe(variantFormId);
    expect(await assignedVariantId(actionId)).toBe(variantId);
  });

  it("moves members already drawn into a variant after submitting the task form back to it", async () => {
    const submittedAction = await createActionAddingVariant({
      submitted: true,
    });
    const unsubmittedAction = await createActionAddingVariant({
      submitted: false,
    });
    await assignmentRepo.insert([
      {
        actionId: submittedAction.actionId,
        userId: ctx.testUserId,
        variantId: submittedAction.variantId,
      },
      {
        actionId: submittedAction.actionId,
        userId: ctx.adminUserId,
        variantId: submittedAction.variantId,
      },
      {
        actionId: unsubmittedAction.actionId,
        userId: ctx.testUserId,
        variantId: unsubmittedAction.variantId,
      },
    ]);

    const runner = ctx.dataSource.createQueryRunner();
    try {
      await new KeepSubmittersOnTaskForm1791762748605().up(runner);
    } finally {
      await runner.release();
    }

    expect(await assignedVariantId(submittedAction.actionId)).toBeNull();
    expect(
      (
        await assignmentRepo.findOneByOrFail({
          actionId: submittedAction.actionId,
          userId: ctx.adminUserId,
        })
      ).variantId,
    ).toBe(submittedAction.variantId);
    expect(await assignedVariantId(unsubmittedAction.actionId)).toBe(
      unsubmittedAction.variantId,
    );
  });
});
