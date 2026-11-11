import { ActionActivityType } from "@alliance/common/actionActivity";
import type { FormSchema } from "@alliance/common/forms/form-schema";
import { Form } from "src/tasks/entities/form.entity";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
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
      fields: [
        { id: "photos", type: "input", kind: "file", label: "Photos" },
        { id: "agree", type: "input", kind: "checkbox", label: "Agree" },
        {
          id: "jobs",
          type: "input",
          kind: "list",
          label: "Jobs",
          fields: [
            { id: "title", type: "input", kind: "text", label: "Title" },
          ],
        },
      ],
    },
  ],
  outputViews: [],
};

describe("Members who answered (e2e)", () => {
  let ctx: TestContext;
  let formRepo: Repository<Form>;
  let responseRepo: Repository<FormResponse>;
  let nextMember = 0;

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    formRepo = ctx.dataSource.getRepository(Form);
    responseRepo = ctx.dataSource.getRepository(FormResponse);
  }, 50000);

  afterEach(async () => {
    await responseRepo.query("DELETE FROM action_activity");
    await responseRepo.query("DELETE FROM action");
    await responseRepo.query("DELETE FROM form_response");
    await formRepo.query("DELETE FROM form");
    await responseRepo.query(
      `DELETE FROM "user" WHERE email LIKE 'answered-member-%'`,
    );
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const createMember = async (): Promise<number> => {
    nextMember += 1;
    const [{ id }] = await responseRepo.query(
      `INSERT INTO "user" (name, email, "referralCode") VALUES ($1, $2, $3) RETURNING id`,
      [
        `Member ${nextMember}`,
        `answered-member-${nextMember}@example.test`,
        `answered-${nextMember}`,
      ],
    );
    return id;
  };

  const day = (n: number) => new Date(Date.UTC(2026, 0, n));

  it("counts members whose latest eligible submission answered each question", async () => {
    const { form, snapshot } = await createFormWithSnapshot(ctx.dataSource, {
      title: "Source",
      schema: sourceSchema,
    });
    const respond = async (params: {
      userId: number;
      answers: Record<string, unknown>;
      createdAt: Date;
    }): Promise<number> => {
      const [{ id }] = await responseRepo.query(
        `INSERT INTO form_response ("formId", "formSnapshotId", "userId", answers, "createdAt")
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [form.id, snapshot.id, params.userId, params.answers, params.createdAt],
      );
      return id;
    };
    const [uploaded, cleared, blank, emptyList, withdrew, twice] =
      await Promise.all([1, 2, 3, 4, 5, 6].map(() => createMember()));
    const upload = [{ url: "https://example.test/a.jpg" }];

    await respond({
      userId: uploaded,
      answers: { photos: upload, agree: true, jobs: [{ title: "x" }] },
      createdAt: day(1),
    });
    await respond({
      userId: cleared,
      answers: { photos: upload },
      createdAt: day(1),
    });
    await respond({
      userId: cleared,
      answers: { agree: false },
      createdAt: day(2),
    });
    await respond({
      userId: blank,
      answers: { photos: "  " },
      createdAt: day(1),
    });
    await respond({
      userId: emptyList,
      answers: { photos: [], jobs: [] },
      createdAt: day(1),
    });
    await respond({
      userId: withdrew,
      answers: { photos: upload },
      createdAt: day(1),
    });
    const withdrawal = await respond({
      userId: withdrew,
      answers: {},
      createdAt: day(2),
    });
    const [{ id: actionId }] = await responseRepo.query(
      `INSERT INTO action (name, slug, category, body) VALUES ('Action', 'action', '{}', 'Body') RETURNING id`,
    );
    await responseRepo.query(
      `INSERT INTO action_activity ("actionId", "userId", type, "taskFormResponseId") VALUES ($1, $2, $3, $4)`,
      [actionId, withdrew, ActionActivityType.USER_WONT_COMPLETE, withdrawal],
    );
    await respond({
      userId: twice,
      answers: { photos: upload },
      createdAt: day(1),
    });
    await respond({
      userId: twice,
      answers: { photos: upload },
      createdAt: day(2),
    });

    const at = (fieldId: string) => ({ sourceFormId: form.id, fieldId });
    const response = await request(ctx.app.getHttpServer())
      .post("/tasks/variableAggregates")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({
        sources: [],
        answeredSources: [
          at("photos"),
          at("agree"),
          at("jobs"),
          at("title"),
          { sourceFormId: form.id + 1000, fieldId: "photos" },
        ],
      })
      .expect(201);

    expect(response.body).toEqual({
      aggregates: [],
      answered: [
        { ...at("photos"), count: 3 },
        { ...at("agree"), count: 1 },
        { ...at("jobs"), count: 1 },
        { ...at("title"), count: null },
        { sourceFormId: form.id + 1000, fieldId: "photos", count: null },
      ],
    });
  });

  it("serves a form version's members-who-answered counts to anyone", async () => {
    const { form: source } = await createFormWithSnapshot(ctx.dataSource, {
      title: "Source",
      schema: sourceSchema,
    });
    const { form, snapshot } = await createFormWithSnapshot(ctx.dataSource, {
      title: "Destination",
      schema: {
        pages: [{ id: "p1", fields: [] }],
        outputViews: [],
        variables: [
          {
            name: "num_completions",
            inputs: {
              input1: {
                kind: "answeredCount",
                sourceFormId: source.id,
                fieldId: "photos",
              },
            },
            formula: "input1",
          },
        ],
      },
    });

    const response = await request(ctx.app.getHttpServer())
      .get(`/tasks/variableAggregates/${form.id}/snapshot/${snapshot.id}`)
      .expect(200);

    expect(response.body).toEqual({
      aggregates: [],
      answered: [{ sourceFormId: source.id, fieldId: "photos", count: 0 }],
    });
  });
});
