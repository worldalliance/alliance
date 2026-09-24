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

const destinationSchema = (variable: FormVariable): FormSchema => ({
  pages: [
    {
      id: "p1",
      fields: [{ id: "intro", type: "display", kind: "text", text: "Hi" }],
    },
  ],
  outputViews: [],
  variables: [variable],
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

  // Seeded directly: until the server checks source forms on save, it refuses
  // a variable reading another form.
  const createReader = async (sourceFormId: number) => {
    const { form } = await createFormWithSnapshot(ctx.dataSource, {
      title: "Destination",
      schema: destinationSchema(readsScore(sourceFormId)),
    });
    return form;
  };

  describe("deleting a form another form reads", () => {
    const remove = (formId: number) =>
      request(ctx.app.getHttpServer())
        .delete(`/tasks/${formId}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

    it("refuses while a form's current version reads it, naming that form", async () => {
      const source = await createSource();
      const destination = await createReader(source.id);

      const refused = await remove(source.id).expect(409);
      expect(refused.body.message).toBe(
        `Variables in "Destination" (#${destination.id}) read this form's answers. Change them to stop reading it, then delete it`,
      );
      expect(await formRepo.findOneBy({ id: source.id })).not.toBeNull();

      await request(ctx.app.getHttpServer())
        .put(`/tasks/updateForm/${destination.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ schema: { ...sourceSchema, variables: undefined } })
        .expect(200);
      await remove(source.id).expect(200);
    });

    it("allows deleting a form while variables read only a different form", async () => {
      const source = await createSource();
      const other = await createSource();
      await createReader(other.id);

      await remove(source.id).expect(200);
    });
  });
});
