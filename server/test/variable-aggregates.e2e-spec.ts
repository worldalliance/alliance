import { ActionActivityType } from "@alliance/common/actionActivity";
import type { FormSchema } from "@alliance/common/forms/form-schema";
import type { FormVariable } from "@alliance/common/forms/variables";
import { Form } from "src/tasks/entities/form.entity";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { TasksModule } from "src/tasks/tasks.module";
import request from "supertest";
import type { Repository } from "typeorm";
import {
  attachFormSnapshot,
  createFormSnapshot,
  createFormWithSnapshot,
  createTestApp,
  type TestContext,
} from "./e2e-test-utils";

const options = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    label: `Company ${index}`,
    value: `company-${index}`,
  }));

const sourceSchema = (optionCount = 3): FormSchema => ({
  pages: [
    {
      id: "p1",
      fields: [
        {
          id: "group",
          type: "group",
          kind: "group",
          fields: [
            {
              id: "employers",
              type: "input",
              kind: "multiselect",
              label: "Employers",
              options: options(optionCount),
            },
          ],
        },
        { id: "score", type: "input", kind: "number", label: "Score" },
      ],
    },
  ],
  outputViews: [],
});

const countsVariable = (sourceFormId: number): FormVariable => ({
  name: "count",
  inputs: {
    counts: { kind: "aggregate", sourceFormId, fieldId: "employers" },
  },
  formula: "counts['company-0'] ?? 0",
});

const destinationSchema = (variables: FormVariable[]): FormSchema => ({
  pages: [
    {
      id: "p1",
      fields: [{ id: "intro", type: "display", kind: "text", text: "Hi" }],
    },
  ],
  outputViews: [],
  variables,
});

describe("Variable aggregates (e2e)", () => {
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
    await responseRepo.query("DELETE FROM form_response_draft");
    await responseRepo.query("DELETE FROM form_response");
    await formRepo.query("DELETE FROM form");
    await responseRepo.query(
      `DELETE FROM "user" WHERE email LIKE 'aggregate-member-%'`,
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
        `aggregate-member-${nextMember}@example.test`,
        `aggregate-${nextMember}`,
      ],
    );
    return id;
  };

  const createSource = (optionCount?: number) =>
    createFormWithSnapshot(ctx.dataSource, {
      title: "Source",
      schema: sourceSchema(optionCount),
    });

  const respond = async (params: {
    formId: number;
    formSnapshotId: number;
    userId?: number;
    guestId?: string;
    employers: unknown;
    createdAt: Date;
  }): Promise<number> => {
    const [{ id }] = await responseRepo.query(
      `INSERT INTO form_response ("formId", "formSnapshotId", "userId", "guestId", answers, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        params.formId,
        params.formSnapshotId,
        params.userId ?? null,
        params.guestId ?? null,
        params.employers === undefined ? {} : { employers: params.employers },
        params.createdAt,
      ],
    );
    return id;
  };

  const withdrawWith = async (params: {
    userId: number;
    responseId: number;
  }) => {
    const [{ id: actionId }] = await responseRepo.query(
      `INSERT INTO action (name, category, body) VALUES ('Action', '{}', 'Body') RETURNING id`,
    );
    await responseRepo.query(
      `INSERT INTO action_activity ("actionId", "userId", type, "taskFormResponseId") VALUES ($1, $2, $3, $4)`,
      [
        actionId,
        params.userId,
        ActionActivityType.USER_WONT_COMPLETE,
        params.responseId,
      ],
    );
  };

  const countAdmin = (sources: { sourceFormId: number; fieldId: string }[]) =>
    request(ctx.app.getHttpServer())
      .post("/tasks/variableAggregates")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ sources });

  const day = (n: number) => new Date(Date.UTC(2026, 0, n));

  it("counts each member's latest eligible submission once per chosen option", async () => {
    const { form, snapshot } = await createSource();
    const at = { formId: form.id, formSnapshotId: snapshot.id };
    const [emptied, changed, repeated, tied, withdrew] = await Promise.all(
      [1, 2, 3, 4, 5].map(() => createMember()),
    );

    await respond({
      ...at,
      userId: emptied,
      employers: ["company-0"],
      createdAt: day(1),
    });
    await respond({ ...at, userId: emptied, employers: [], createdAt: day(2) });

    await respond({
      ...at,
      userId: changed,
      employers: ["company-0"],
      createdAt: day(1),
    });
    await respond({
      ...at,
      userId: changed,
      employers: ["company-1", "company-2"],
      createdAt: day(2),
    });

    await respond({
      ...at,
      userId: repeated,
      employers: ["company-1", "company-1"],
      createdAt: day(1),
    });

    await respond({
      ...at,
      userId: tied,
      employers: ["company-0"],
      createdAt: day(3),
    });
    await respond({
      ...at,
      userId: tied,
      employers: ["company-2"],
      createdAt: day(3),
    });

    await respond({
      ...at,
      userId: withdrew,
      employers: ["company-0"],
      createdAt: day(1),
    });
    const withdrawal = await respond({
      ...at,
      userId: withdrew,
      employers: ["company-1"],
      createdAt: day(2),
    });
    await withdrawWith({ userId: withdrew, responseId: withdrawal });

    const [{ id: guestId }] = await responseRepo.query(
      `INSERT INTO guest DEFAULT VALUES RETURNING id`,
    );
    await respond({
      ...at,
      guestId,
      employers: ["company-0"],
      createdAt: day(4),
    });
    await responseRepo.query(
      `INSERT INTO form_response_draft ("userId", "formId", "actionId", "formSnapshotId", answers, "updatedAt") VALUES ($1, $2, 0, $3, $4, now())`,
      [repeated, form.id, snapshot.id, { employers: ["company-0"] }],
    );

    const response = await countAdmin([
      { sourceFormId: form.id, fieldId: "employers" },
    ]).expect(201);

    expect(response.body.aggregates).toEqual([
      {
        sourceFormId: form.id,
        fieldId: "employers",
        counts: { "company-0": 1, "company-1": 2, "company-2": 2 },
      },
    ]);
  });

  it("counts every option as zero without eligible responses, in one payload", async () => {
    const { form } = await createSource(140);
    const response = await countAdmin([
      { sourceFormId: form.id, fieldId: "employers" },
    ]).expect(201);
    const [aggregate] = response.body.aggregates;
    expect(Object.keys(aggregate.counts)).toHaveLength(140);
    expect(new Set(Object.values(aggregate.counts))).toEqual(new Set([0]));
  });

  it("counts an answer that isn't a list as nothing", async () => {
    const { form, snapshot } = await createSource();
    const at = { formId: form.id, formSnapshotId: snapshot.id };
    await respond({
      ...at,
      userId: await createMember(),
      employers: "company-0",
      createdAt: day(1),
    });
    await respond({
      ...at,
      userId: await createMember(),
      employers: ["company-1"],
      createdAt: day(1),
    });

    const response = await countAdmin([
      { sourceFormId: form.id, fieldId: "employers" },
    ]).expect(201);
    expect(response.body.aggregates[0].counts).toEqual({
      "company-0": 0,
      "company-1": 1,
      "company-2": 0,
    });
  });

  it("counts a question listed twice once", async () => {
    const { form, snapshot } = await createSource();
    await respond({
      formId: form.id,
      formSnapshotId: snapshot.id,
      userId: await createMember(),
      employers: ["company-0"],
      createdAt: day(1),
    });
    const source = { sourceFormId: form.id, fieldId: "employers" };
    const response = await countAdmin([source, source]).expect(201);
    expect(
      response.body.aggregates.map(
        (aggregate: { counts: Record<string, number> }) =>
          aggregate.counts["company-0"],
      ),
    ).toEqual([1, 1]);
  });

  it("returns null counts for a deleted form or a question that isn't a multiselect", async () => {
    const { form } = await createSource();
    const response = await countAdmin([
      { sourceFormId: form.id, fieldId: "score" },
      { sourceFormId: form.id + 1000, fieldId: "employers" },
    ]).expect(201);
    expect(
      response.body.aggregates.map(
        (aggregate: { counts: unknown }) => aggregate.counts,
      ),
    ).toEqual([null, null]);
  });

  it("serves a form version's own aggregates to anyone, guests included", async () => {
    const { form: source, snapshot: sourceSnapshot } = await createSource();
    await respond({
      formId: source.id,
      formSnapshotId: sourceSnapshot.id,
      userId: ctx.testUserId,
      employers: ["company-0"],
      createdAt: day(1),
    });
    const { form, snapshot } = await createFormWithSnapshot(ctx.dataSource, {
      title: "Destination",
      schema: destinationSchema([
        countsVariable(source.id),
        countsVariable(source.id),
      ]),
    });

    const response = await request(ctx.app.getHttpServer())
      .get(`/tasks/variableAggregates/${form.id}/snapshot/${snapshot.id}`)
      .expect(200);

    expect(response.body.aggregates).toEqual([
      {
        sourceFormId: source.id,
        fieldId: "employers",
        counts: { "company-0": 1, "company-1": 0, "company-2": 0 },
      },
    ]);
  });

  it("counts what an earlier version reads, not the current one", async () => {
    const { form: source } = await createSource();
    const { form, snapshot: first } = await createFormWithSnapshot(
      ctx.dataSource,
      {
        title: "Destination",
        schema: destinationSchema([countsVariable(source.id)]),
      },
    );
    const current = await createFormSnapshot(
      ctx.dataSource,
      destinationSchema([]),
    );
    await formRepo.update(form.id, { formSnapshotId: current.id });
    await attachFormSnapshot(ctx.dataSource, form.id, current.id);

    const response = await request(ctx.app.getHttpServer())
      .get(`/tasks/variableAggregates/${form.id}/snapshot/${first.id}`)
      .expect(200);

    expect(response.body.aggregates).toEqual([
      {
        sourceFormId: source.id,
        fieldId: "employers",
        counts: { "company-0": 0, "company-1": 0, "company-2": 0 },
      },
    ]);
  });

  it("won't count through a version that isn't the form's", async () => {
    const { form: source } = await createSource();
    const { snapshot: other } = await createFormWithSnapshot(ctx.dataSource, {
      title: "Other",
      schema: destinationSchema([countsVariable(source.id)]),
    });
    const { form } = await createFormWithSnapshot(ctx.dataSource, {
      title: "Destination",
      schema: destinationSchema([]),
    });
    await request(ctx.app.getHttpServer())
      .get(`/tasks/variableAggregates/${form.id}/snapshot/${other.id}`)
      .expect(400);
  });

  it("counts arbitrary questions only for an admin", async () => {
    const { form } = await createSource();
    await request(ctx.app.getHttpServer())
      .post("/tasks/variableAggregates")
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send({ sources: [{ sourceFormId: form.id, fieldId: "employers" }] })
      .expect(401);
  });
});
