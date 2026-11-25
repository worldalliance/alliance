import type { FormSchema } from "@alliance/common/forms/form-schema";
import type { CreateActionDto } from "src/actions/dto/action.dto";
import { ActionFormVariant } from "src/actions/entities/action-form-variant.entity";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
import { TasksModule } from "src/tasks/tasks.module";
import request from "supertest";
import type { Repository } from "typeorm";
import {
  closeTestApp,
  createTestApp,
  type TestContext,
} from "./e2e-test-utils";

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [{ id: "name", type: "input", kind: "text", label: "Name" }],
    },
  ],
  outputViews: [],
};

describe("The admin form endpoint (e2e)", () => {
  let ctx: TestContext;
  let actionRepo: Repository<Action>;
  let variantRepo: Repository<ActionFormVariant>;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    actionRepo = ctx.dataSource.getRepository(Action);
    variantRepo = ctx.dataSource.getRepository(ActionFormVariant);
  }, 50000);

  afterEach(async () => {
    await actionRepo.query("DELETE FROM action_form_variant");
    await actionRepo.query("DELETE FROM action");
    await actionRepo.query("DELETE FROM form");
  });

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  const createForm = async (): Promise<number> => {
    const created = await request(server())
      .post("/tasks/createForm")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ title: "Form", schema })
      .expect(201);
    return created.body.id;
  };

  const createAction = (name: string, taskFormId: number | null) =>
    actionRepo.save(
      actionRepo.create({
        name,
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
        taskFormId,
      } satisfies CreateActionDto & { taskFormId: number | null }),
    );

  const adminForm = (formId: number) =>
    request(server())
      .get(`/tasks/adminForm/${formId}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);

  it("names the action whose task form it is", async () => {
    const formId = await createForm();
    const action = await createAction("Owner", formId);

    const served = await adminForm(formId);

    expect(served.body.usedInAction).toEqual({ id: action.id, name: "Owner" });
    expect(served.body.schema).toEqual(schema);
  });

  it("names the action whose task form variant it is", async () => {
    const formId = await createForm();
    const action = await createAction("Variant owner", null);
    await variantRepo.save(
      variantRepo.create({
        actionId: action.id,
        formId,
        name: "B",
        splitValue: 0.5,
      }),
    );

    const served = await adminForm(formId);

    expect(served.body.usedInAction).toEqual({
      id: action.id,
      name: "Variant owner",
    });
  });

  it("names no action for a form no action uses as its task form", async () => {
    const formId = await createForm();

    const served = await adminForm(formId);

    expect(served.body.usedInAction).toBeUndefined();
  });
});
