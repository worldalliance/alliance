import type { FormSchema } from "@alliance/common/forms/form-schema";
import request from "supertest";
import { CreateActionDto } from "../src/actions/dto/action.dto";
import { Action } from "../src/actions/entities/action.entity";
import { Form } from "../src/tasks/entities/form.entity";
import { TasksModule } from "../src/tasks/tasks.module";
import {
  createActionAsAdmin,
  getActionAsAdmin,
  patchActionAsAdmin,
} from "./action-requests";
import { closeTestApp, createTestApp, TestContext } from "./e2e-test-utils";

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

const otherSchema: FormSchema = {
  ...schema,
  pages: [
    {
      id: "page-1",
      fields: [{ id: "other", type: "input", kind: "text", label: "Other" }],
    },
  ],
};

describe("Action task form id (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
  }, 50000);

  afterEach(async () => {
    const repo = ctx.dataSource.getRepository(Action);
    await repo.query("DELETE FROM action_form_variant");
    await repo.query("DELETE FROM action");
    await repo.query("DELETE FROM form");
  });

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  const create = (body: Partial<CreateActionDto>) =>
    createActionAsAdmin(ctx, { name: "action-task-form-id e2e", ...body });

  const createForm = async (): Promise<number> => {
    const form = await request(ctx.app.getHttpServer())
      .post("/tasks/createForm")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ title: "Task form", schema })
      .expect(201);
    return form.body.id;
  };

  it("returns null for the form on an action created without one", async () => {
    const created = await create({}).expect(201);
    expect(created.body.taskFormId).toBeNull();

    const fetched = await getActionAsAdmin(ctx, created.body.id).expect(200);
    expect(fetched.body.taskFormId).toBeNull();
  });

  it("sets the form, keeps it when a patch leaves it out, and clears it with null", async () => {
    const taskFormId = await createForm();
    const created = await create({ taskFormId }).expect(201);
    expect(created.body.taskFormId).toBe(taskFormId);

    const renamed = await patchActionAsAdmin(ctx, created.body.id, {
      name: "action-task-form-id e2e renamed",
    }).expect(200);
    expect(renamed.body.taskFormId).toBe(taskFormId);

    const cleared = await patchActionAsAdmin(ctx, created.body.id, {
      taskFormId: null,
    }).expect(200);
    expect(cleared.body.taskFormId).toBeNull();

    const stored = await ctx.dataSource
      .getRepository(Action)
      .findOneByOrFail({ id: created.body.id });
    expect(stored.taskFormId).toBeNull();
  });

  it("saves a null form while another action has a form variant", async () => {
    const withVariant = await create({ taskFormId: await createForm() }).expect(
      201,
    );
    await request(ctx.app.getHttpServer())
      .post(`/actions/${withVariant.body.id}/form-variants`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ name: "B", splitValue: 1 })
      .expect(201);

    const created = await create({ taskFormId: await createForm() }).expect(
      201,
    );
    const cleared = await patchActionAsAdmin(ctx, created.body.id, {
      taskFormId: null,
    }).expect(200);
    expect(cleared.body.taskFormId).toBeNull();

    const createdWithout = await create({ taskFormId: null }).expect(201);
    expect(createdWithout.body.taskFormId).toBeNull();
  });

  it("exports no task form for an action without one", async () => {
    await createForm();
    const created = await create({}).expect(201);

    const exported = await request(ctx.app.getHttpServer())
      .get(`/actions/export/${created.body.id}?taskForm=true`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);
    expect(exported.body.taskForm).toBeUndefined();
  });

  const exportAndPaste = async (params: {
    actionId: number;
    withForm: boolean;
    taskFormId?: number;
  }) => {
    const exported = await request(ctx.app.getHttpServer())
      .get(`/actions/export/${params.actionId}?taskForm=${params.withForm}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);
    const body = { ...exported.body };
    if (params.taskFormId !== undefined) body.taskFormId = params.taskFormId;
    return request(ctx.app.getHttpServer())
      .post("/actions/pasteJson")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ body: JSON.stringify(body) })
      .expect(201);
  };

  it("pastes an action with a copy of its form beside the original", async () => {
    const taskFormId = await createForm();
    const original = await create({ taskFormId }).expect(201);

    const pasted = await exportAndPaste({
      actionId: original.body.id,
      withForm: true,
    });
    expect(pasted.body.taskFormId).not.toBeNull();
    expect(pasted.body.taskFormId).not.toBe(taskFormId);
    const copied = await request(ctx.app.getHttpServer())
      .get(`/actions/export/${pasted.body.id}?taskForm=true`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);
    expect(copied.body.taskForm.formSnapshot.schema).toEqual(schema);
    const pastedForm = await ctx.dataSource.getRepository(Form).findOneOrFail({
      where: { id: copied.body.taskForm.id },
      relations: { historicalFormSnapshots: true },
    });
    expect(pastedForm.historicalFormSnapshots?.map((s) => s.id)).toContain(
      copied.body.taskForm.formSnapshotId,
    );

    const kept = await getActionAsAdmin(ctx, original.body.id).expect(200);
    expect(kept.body.taskFormId).toBe(taskFormId);
  });

  const exportWithForm = async (taskFormId: number) => {
    const original = await create({ taskFormId }).expect(201);
    const exported = await request(ctx.app.getHttpServer())
      .get(`/actions/export/${original.body.id}?taskForm=true`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);
    return exported.body;
  };

  const paste = (body: unknown) =>
    request(ctx.app.getHttpServer())
      .post("/actions/pasteJson")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ body: JSON.stringify(body) });

  it("pastes a form's content even when its snapshot id names another form's snapshot", async () => {
    const exported = await exportWithForm(await createForm());
    const other = await request(ctx.app.getHttpServer())
      .post("/tasks/createForm")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ title: "Other form", schema: otherSchema })
      .expect(201);
    const otherSnapshotId = other.body.formSnapshotId;
    exported.taskForm.formSnapshotId = otherSnapshotId;
    exported.taskForm.formSnapshot.id = otherSnapshotId;

    const pasted = await paste(exported).expect(201);
    const copied = await request(ctx.app.getHttpServer())
      .get(`/actions/export/${pasted.body.id}?taskForm=true`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);
    expect(copied.body.taskForm.formSnapshot.schema).toEqual(schema);
    expect(copied.body.taskForm.formSnapshotId).not.toBe(otherSnapshotId);
  });

  it("refuses a pasted form without its content", async () => {
    const exported = await exportWithForm(await createForm());
    delete exported.taskForm.formSnapshot;

    await paste(exported).expect(400);
    expect(await ctx.dataSource.getRepository(Action).count()).toBe(1);
  });

  it("refuses a pasted form whose content is not a valid form", async () => {
    const exported = await exportWithForm(await createForm());
    exported.taskForm.formSnapshot.schema = { pages: "not pages" };

    await paste(exported).expect(400);
  });

  it("pastes an action exported without its form with no form", async () => {
    const original = await create({ taskFormId: await createForm() }).expect(
      201,
    );

    const pasted = await exportAndPaste({
      actionId: original.body.id,
      withForm: false,
      taskFormId: 999_999,
    });
    expect(pasted.body.taskFormId).toBeNull();
  });

  it.each(["", "5", 1.5, 0, -1, 2_147_483_648, true])(
    "rejects a form id of %p",
    async (taskFormId) => {
      const created = await create({}).expect(201);
      await patchActionAsAdmin(ctx, created.body.id, { taskFormId }).expect(
        400,
      );
    },
  );
});
