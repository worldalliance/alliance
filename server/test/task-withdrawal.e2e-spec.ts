import {
  ActionActivityType,
  FORM_ALREADY_SUBMITTED,
} from "@alliance/common/actionActivity";
import type { FormSchema } from "@alliance/common/forms/form-schema";
import { milliseconds } from "date-fns";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { Action } from "src/actions/entities/action.entity";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { TasksModule } from "src/tasks/tasks.module";
import request from "supertest";
import { createActionDefaults } from "./action-requests";
import {
  closeTestApp,
  createFormWithSnapshot,
  createTestApp,
  type TestContext,
} from "./e2e-test-utils";

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

describe("Task withdrawal (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
  }, 50000);

  afterEach(async () => {
    const repo = ctx.dataSource.getRepository(Action);
    await repo.query("DELETE FROM action_activity");
    await repo.query("DELETE FROM form_response");
    await repo.query("DELETE FROM action_event");
    await repo.query("DELETE FROM action_form_variant");
    await repo.query("DELETE FROM action");
    await repo.query("DELETE FROM form");
  });

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  const responses = (formId: number) =>
    ctx.dataSource.getRepository(FormResponse).countBy({ formId });

  const createFormAction = async (name: string) => {
    const { form, snapshot } = await createFormWithSnapshot(ctx.dataSource, {
      title: `${name} form`,
      schema,
    });
    const actionRepo = ctx.dataSource.getRepository(Action);
    const action = await actionRepo.save(
      actionRepo.create({
        ...createActionDefaults,
        name,
        taskFormId: form.id,
        cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
      }),
    );
    const eventRepo = ctx.dataSource.getRepository(ActionEvent);
    await eventRepo.save(
      eventRepo.create({
        title: "Live",
        description: "Live",
        newStatus: ActionStatus.MemberAction,
        date: new Date(Date.now() - milliseconds({ seconds: 1 })),
        action,
      }),
    );
    const formSnapshotId = snapshot.id;
    const submit = () =>
      request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${form.id}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          answers: { note: "done" },
          formSnapshotId,
          actionId: action.id,
          deviceType: "desktop",
        });
    const withdraw = (params: { formId: number; actionId: number }) =>
      request(ctx.app.getHttpServer())
        .post(`/tasks/optout/${params.formId}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          actionId: params.actionId,
          reason: "",
          outOfTime: true,
          isMoral: false,
          partialFormData: {
            answers: {},
            formSnapshotId,
            actionId: params.actionId,
            deviceType: "desktop",
          },
        });
    return { formId: form.id, actionId: action.id, submit, withdraw };
  };

  it("refuses a withdrawal from a submitted form without saving it", async () => {
    const { formId, actionId, submit, withdraw } =
      await createFormAction("Submitted action");
    await submit().expect(201);

    const refused = await withdraw({ formId, actionId }).expect(400);

    expect(refused.body.message).toBe(FORM_ALREADY_SUBMITTED);
    expect(await responses(formId)).toBe(1);
  });

  it("refuses a second withdrawal without saving it", async () => {
    const { formId, actionId, withdraw } =
      await createFormAction("Withdrawn action");
    await withdraw({ formId, actionId }).expect(201);

    const refused = await withdraw({ formId, actionId }).expect(400);

    expect(refused.body.message).toBe(FORM_ALREADY_SUBMITTED);
    expect(await responses(formId)).toBe(1);
  });

  it("refuses a withdrawal naming another action's form", async () => {
    const submitted = await createFormAction("Submitted action");
    const other = await createFormAction("Other action");
    await submitted.submit().expect(201);

    await submitted
      .withdraw({ formId: submitted.formId, actionId: other.actionId })
      .expect(403);

    expect(await responses(submitted.formId)).toBe(1);
    expect(
      await ctx.dataSource.getRepository(ActionActivity).countBy({
        action: { id: other.actionId },
        type: ActionActivityType.USER_WONT_COMPLETE,
      }),
    ).toBe(0);
  });
});
