import type {
  ConversationField,
  FormSchema,
} from "@alliance/common/forms/form-schema";
import { milliseconds } from "date-fns";
import type { CreateActionDto } from "src/actions/dto/action.dto";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { TasksModule } from "src/tasks/tasks.module";
import request from "supertest";
import type { Repository } from "typeorm";
import {
  closeTestApp,
  createTestApp,
  type TestContext,
} from "./e2e-test-utils";

const conversation: ConversationField = {
  id: "aware",
  type: "input",
  kind: "conversation",
  label: "Aware of statements",
  required: true,
  expert: { userId: 1, userName: "Dr Maria" },
  message: "Were you aware of these statements?",
  options: [
    { label: "Yes, and I accept them", value: "accept" },
    {
      label: "Not convinced",
      value: "skeptic",
      reply: "Please leave a note",
      note: { required: true },
    },
    { label: "No", value: "unaware", note: {} },
  ],
  noteId: "aware_note",
};

const schemaWith = (field: ConversationField): FormSchema => ({
  pages: [{ id: "p1", fields: [field] }],
  outputViews: [],
});
const schema = schemaWith(conversation);

describe("Conversation fields (e2e)", () => {
  let ctx: TestContext;
  let actionRepo: Repository<Action>;
  let responseRepo: Repository<FormResponse>;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    actionRepo = ctx.dataSource.getRepository(Action);
    responseRepo = ctx.dataSource.getRepository(FormResponse);
  }, 50000);

  afterEach(async () => {
    await actionRepo.query("DELETE FROM form_response_draft");
    await actionRepo.query("DELETE FROM form_response");
    await actionRepo.query("DELETE FROM action");
    await actionRepo.query("DELETE FROM form");
  });

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  const createForm = (schema: FormSchema) =>
    request(server())
      .post("/tasks/createForm")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ title: "Conversation", schema });

  const createAction = async (schema: FormSchema) => {
    const form = await createForm(schema).expect(201);
    const action = await actionRepo.save(
      actionRepo.create({
        name: "Conversation",
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
        taskFormId: form.body.id,
      } satisfies CreateActionDto),
    );
    await ctx.dataSource.getRepository(ActionEvent).save({
      title: "Member phase",
      description: "Member phase",
      newStatus: ActionStatus.MemberAction,
      date: new Date(Date.now() - milliseconds({ hours: 1 })),
      action,
    });
    return {
      actionId: action.id,
      formId: form.body.id as number,
      formSnapshotId: form.body.formSnapshotId as number,
    };
  };

  const submit = async (answers: Record<string, string>) => {
    const { formId, formSnapshotId, actionId } = await createAction(schema);
    const response = await request(server())
      .post(`/tasks/submitForm/${formId}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send({
        answers,
        formSnapshotId,
        actionId,
        deviceType: "desktop" as const,
      });
    return { formId, response };
  };

  it("refuses a form whose conversation has no expert", async () => {
    const response = await createForm(
      schemaWith({ ...conversation, expert: null }),
    ).expect(400);
    expect(response.body.errors).toContainEqual({
      blockId: "aware",
      message: "Conversation has no expert. Pick one",
    });
  });

  it("refuses a submission missing a note the chosen option requires", async () => {
    const { response } = await submit({ aware: "skeptic" });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Field Aware of statements requires a note.",
    );
  });

  it("stores the choice and its note", async () => {
    const { formId, response } = await submit({
      aware: "skeptic",
      aware_note: "I doubt the second one",
    });
    expect(response.status).toBe(201);
    const stored = await responseRepo.findOneByOrFail({ formId });
    expect(stored.answers).toEqual({
      aware: "skeptic",
      aware_note: "I doubt the second one",
    });
  });

  it("drops a note the chosen option doesn't ask for", async () => {
    const { formId, response } = await submit({
      aware: "accept",
      aware_note: "left over from another pick",
    });
    expect(response.status).toBe(201);
    const stored = await responseRepo.findOneByOrFail({ formId });
    expect(stored.answers).toEqual({ aware: "accept" });
  });

  it("keeps the note in a draft", async () => {
    const { formId, formSnapshotId, actionId } = await createAction(schema);
    const saved = await request(server())
      .put(`/tasks/formDraft/${formId}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send({
        actionId,
        formSnapshotId,
        answers: { aware: "unaware", aware_note: "half typed" },
      })
      .expect(200);
    expect(saved.body.answers).toEqual({
      aware: "unaware",
      aware_note: "half typed",
    });
  });
});
