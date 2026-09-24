import type { FormSchema } from "@alliance/common/forms/form-schema";
import { Form } from "src/tasks/entities/form.entity";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { FormResponseDraft } from "src/tasks/entities/formresponsedraft.entity";
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

const sourceSchema = (label: string): FormSchema => ({
  pages: [
    {
      id: "p1",
      fields: [{ id: "score", type: "input", kind: "number", label }],
    },
  ],
  outputViews: [],
});

describe("Form response history (e2e)", () => {
  let ctx: TestContext;
  let formRepo: Repository<Form>;
  let responseRepo: Repository<FormResponse>;
  let draftRepo: Repository<FormResponseDraft>;

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    formRepo = ctx.dataSource.getRepository(Form);
    responseRepo = ctx.dataSource.getRepository(FormResponse);
    draftRepo = ctx.dataSource.getRepository(FormResponseDraft);
  }, 50000);

  afterEach(async () => {
    await draftRepo.query("DELETE FROM form_response_draft");
    await responseRepo.query("DELETE FROM form_response");
    await formRepo.query("DELETE FROM form");
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const respond = async (params: {
    formId: number;
    formSnapshotId: number;
    userId: number;
    answers: Record<string, unknown>;
    createdAt: Date;
  }): Promise<FormResponse> => {
    const saved = await responseRepo.save(
      responseRepo.create({
        formId: params.formId,
        formSnapshotId: params.formSnapshotId,
        user: { id: params.userId },
        answers: params.answers,
        publicAnswers: {},
      }),
    );
    await responseRepo.update(saved.id, { createdAt: params.createdAt });
    return saved;
  };

  // TypeORM drops an explicit id on a generated column, so this inserts with
  // SQL to put rows in storage out of id order.
  const respondWithId = (params: {
    id: number;
    formId: number;
    formSnapshotId: number;
    answers: Record<string, unknown>;
    createdAt: Date;
  }) =>
    responseRepo.query(
      `INSERT INTO form_response (id, "formId", "formSnapshotId", "userId", answers, "createdAt") VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        params.id,
        params.formId,
        params.formSnapshotId,
        ctx.testUserId,
        params.answers,
        params.createdAt,
      ],
    );

  const createSource = async () => {
    const { form, snapshot: original } = await createFormWithSnapshot(
      ctx.dataSource,
      { title: "Source", schema: sourceSchema("Score") },
    );
    const current = await createFormSnapshot(
      ctx.dataSource,
      sourceSchema("Score, renamed"),
    );
    await formRepo.update(form.id, { formSnapshotId: current.id });
    await attachFormSnapshot(ctx.dataSource, form.id, current.id);
    return { form, original, current };
  };

  const historyOf = (formId: number, token: string) =>
    request(ctx.app.getHttpServer())
      .get(`/tasks/myResponseHistory/${formId}`)
      .set("Authorization", `Bearer ${token}`);

  it("returns the member's own submissions oldest first, each with its form version", async () => {
    const { form, original, current } = await createSource();
    const tie = new Date("2026-01-02T00:00:00Z");
    const later = await respond({
      formId: form.id,
      formSnapshotId: current.id,
      userId: ctx.testUserId,
      answers: { score: 8 },
      createdAt: new Date("2026-01-03T00:00:00Z"),
    });
    const first = { id: 900001 };
    const second = { id: 900002 };
    await respondWithId({
      id: second.id,
      formId: form.id,
      formSnapshotId: original.id,
      answers: {},
      createdAt: tie,
    });
    await respondWithId({
      id: first.id,
      formId: form.id,
      formSnapshotId: original.id,
      answers: { score: 5 },
      createdAt: tie,
    });
    await respond({
      formId: form.id,
      formSnapshotId: current.id,
      userId: ctx.adminUserId,
      answers: { score: 99 },
      createdAt: tie,
    });
    await draftRepo.save(
      draftRepo.create({
        userId: ctx.testUserId,
        formId: form.id,
        actionId: 0,
        formSnapshotId: current.id,
        answers: { score: 1 },
        updatedAt: new Date(),
      }),
    );

    const response = await historyOf(form.id, ctx.accessToken).expect(200);

    expect(response.body.schema).toEqual(sourceSchema("Score, renamed"));
    expect(
      response.body.responses.map(
        (entry: { id: number; answers: unknown; schemaSnapshot: unknown }) => [
          entry.id,
          entry.answers,
          entry.schemaSnapshot,
        ],
      ),
    ).toEqual([
      [first.id, { score: 5 }, sourceSchema("Score")],
      [second.id, {}, sourceSchema("Score")],
      [later.id, { score: 8 }, sourceSchema("Score, renamed")],
    ]);
  });

  it("returns an empty history when the member hasn't submitted", async () => {
    const { form } = await createSource();
    const response = await historyOf(form.id, ctx.accessToken).expect(200);
    expect(response.body.responses).toEqual([]);
  });

  it("fails for a form that no longer exists", async () => {
    const { form } = await createSource();
    await formRepo.delete(form.id);
    await historyOf(form.id, ctx.accessToken).expect(404);
  });

  it("turns away a signed-out caller", async () => {
    const { form } = await createSource();
    await request(ctx.app.getHttpServer())
      .get(`/tasks/myResponseHistory/${form.id}`)
      .expect(401);
  });

  it("lets an admin read the selected member's history, and only an admin", async () => {
    const { form, current } = await createSource();
    await respond({
      formId: form.id,
      formSnapshotId: current.id,
      userId: ctx.testUserId,
      answers: { score: 3 },
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    await respond({
      formId: form.id,
      formSnapshotId: current.id,
      userId: ctx.adminUserId,
      answers: { score: 4 },
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    const path = `/tasks/responseHistory/${form.id}/user/${ctx.testUserId}`;

    const response = await request(ctx.app.getHttpServer())
      .get(path)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);
    expect(
      response.body.responses.map(
        (entry: { answers: unknown }) => entry.answers,
      ),
    ).toEqual([{ score: 3 }]);

    await request(ctx.app.getHttpServer())
      .get(path)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(401);
  });
});
