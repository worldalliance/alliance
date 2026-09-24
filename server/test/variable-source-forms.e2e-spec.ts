import type { FormSchema } from "@alliance/common/forms/form-schema";
import type { FormVariable } from "@alliance/common/forms/variables";
import { Form } from "src/tasks/entities/form.entity";
import { TasksModule } from "src/tasks/tasks.module";
import request from "supertest";
import type { Repository } from "typeorm";
import {
  createFormWithSnapshot,
  createTestApp,
  type TestContext,
} from "./e2e-test-utils";

const sourceSchema: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [{ id: "score", type: "input", kind: "number", label: "Score" }],
    },
  ],
  outputViews: [],
};

const readsScore = (sourceFormId: number): FormVariable => ({
  name: "scores",
  inputs: { input1: { kind: "sourceField", fieldId: "score", sourceFormId } },
  formula: 'input1.map(n => n ?? "-").join(",")',
});

const destinationSchema = (
  variable: FormVariable,
  overrides: Partial<FormSchema> = {},
): FormSchema => ({
  pages: [
    {
      id: "p1",
      fields: [{ id: "intro", type: "display", kind: "text", text: "Hi" }],
    },
  ],
  outputViews: [],
  variables: [variable],
  ...overrides,
});

describe("Variables reading another form (e2e)", () => {
  let ctx: TestContext;
  let formRepo: Repository<Form>;

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    formRepo = ctx.dataSource.getRepository(Form);
  }, 50000);

  afterEach(async () => {
    await formRepo.query("DELETE FROM form");
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const createSource = async () => {
    const { form } = await createFormWithSnapshot(ctx.dataSource, {
      title: "Source",
      schema: sourceSchema,
    });
    return form;
  };

  const create = (schema: FormSchema) =>
    request(ctx.app.getHttpServer())
      .post("/tasks/createForm")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ title: "Destination", schema });

  describe("saving a form whose variable reads another form", () => {
    it("accepts a reference to a question the source form has", async () => {
      const form = await createSource();
      await create(destinationSchema(readsScore(form.id))).expect(201);
    });

    it("rejects a source form that doesn't exist", async () => {
      const form = await createSource();
      await formRepo.delete(form.id);
      const response = await create(
        destinationSchema(readsScore(form.id)),
      ).expect(400);
      expect(response.body.errors).toEqual([
        {
          blockId: "variable:scores",
          message: `Input "input1" reads form ${form.id}, which doesn't exist or couldn't be loaded`,
        },
      ]);
    });

    it("rejects a form id too large for a Postgres integer", async () => {
      await create(destinationSchema(readsScore(3_000_000_000))).expect(400);
    });

    it("rejects a question the source form doesn't have", async () => {
      const form = await createSource();
      const variable = readsScore(form.id);
      const response = await create(
        destinationSchema({
          ...variable,
          inputs: {
            input1: { ...variable.inputs.input1, fieldId: "missing" },
          },
        }),
      ).expect(400);
      expect(response.body.errors[0].message).toBe(
        `Input "input1" references field "missing", which form ${form.id} no longer has`,
      );
    });

    it("rejects a form reading itself as a source", async () => {
      const form = await createSource();
      const created = await create(destinationSchema(readsScore(form.id)));
      const ownId: number = created.body.id;
      const response = await request(ctx.app.getHttpServer())
        .put(`/tasks/updateForm/${ownId}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ schema: destinationSchema(readsScore(ownId)) })
        .expect(400);
      expect(response.body.errors[0].message).toBe(
        `Input "input1" reads this form as another form. Pick "This form" instead`,
      );
    });

    it("rejects the variable in an output view", async () => {
      const form = await createSource();
      const response = await create(
        destinationSchema(readsScore(form.id), {
          outputViews: [
            {
              id: "view",
              type: "default",
              blocks: [
                {
                  id: "summary",
                  type: "display",
                  kind: "text",
                  text: "Scores: #{scores}",
                },
              ],
            },
          ],
        }),
      ).expect(400);
      expect(response.body.errors).toEqual([
        {
          viewId: "view",
          blockId: "summary.text",
          message:
            "Output views can't show #{scores}, which reads answers from another form",
        },
      ]);
    });
  });

  describe("deleting a form another form reads", () => {
    const remove = (formId: number) =>
      request(ctx.app.getHttpServer())
        .delete(`/tasks/${formId}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

    it("refuses while a form's current version reads it, naming that form", async () => {
      const source = await createSource();
      const created = await create(
        destinationSchema(readsScore(source.id)),
      ).expect(201);
      const destinationId: number = created.body.id;

      const refused = await remove(source.id).expect(409);
      expect(refused.body.message).toBe(
        `Variables in "Destination" (#${destinationId}) read this form's answers. Change them to stop reading it, then delete it`,
      );
      expect(await formRepo.findOneBy({ id: source.id })).not.toBeNull();

      await request(ctx.app.getHttpServer())
        .put(`/tasks/updateForm/${destinationId}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ schema: { ...sourceSchema, variables: undefined } })
        .expect(200);
      await remove(source.id).expect(200);
    });

    it("allows deleting a form while variables read only a different form", async () => {
      const source = await createSource();
      const other = await createSource();
      await create(destinationSchema(readsScore(other.id))).expect(201);

      await remove(source.id).expect(200);
    });
  });
});
