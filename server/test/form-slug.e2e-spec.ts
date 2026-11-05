import { ActionFormVariantService } from "src/actions/action-form-variant.service";
import { ActionsService } from "src/actions/actions.service";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
import { FollowUpFormsService } from "src/actions/follow-up-forms.service";
import { Form } from "src/tasks/entities/form.entity";
import type { FormSummaryDto } from "src/tasks/form.dto";
import { TasksModule } from "src/tasks/tasks.module";
import { TasksService } from "src/tasks/tasks.service";
import request from "supertest";
import { createTestApp, type TestContext } from "./e2e-test-utils";

const SCHEMA = { pages: [], outputViews: [] };

describe("Form slugs (e2e)", () => {
  let ctx: TestContext;
  let tasks: TasksService;
  let actions: ActionsService;
  let followUps: FollowUpFormsService;
  let variants: ActionFormVariantService;

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    tasks = ctx.app.get(TasksService);
    actions = ctx.app.get(ActionsService);
    followUps = ctx.app.get(FollowUpFormsService);
    variants = ctx.app.get(ActionFormVariantService);
  }, 50000);

  afterEach(async () => {
    await ctx.dataSource.query("DELETE FROM follow_up_form");
    await ctx.dataSource.query("DELETE FROM action_form_variant");
    await ctx.dataSource.query("DELETE FROM action");
    await ctx.dataSource.query("DELETE FROM form");
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const newForm = (title = "Form") =>
    tasks.createForm({ title, schema: SCHEMA });

  const newAction = (slug: string) =>
    ctx.dataSource.getRepository(Action).save({
      name: slug,
      slug,
      category: [],
      body: "Body",
      shortDescription: "Short",
      isForumParticipationAction: false,
      shouldCompleteAfterDeadline: false,
      visibilityMode: VisibilityMode.Public,
      preventCompletion: false,
      optional: false,
      publicOnly: false,
      isContractSigningAction: false,
      onboarding: false,
    });

  const slugOf = async (formId: number) =>
    (await ctx.dataSource.getRepository(Form).findOneByOrFail({ id: formId }))
      .slug;

  const setTaskForm = (actionId: number, taskFormId: number) =>
    actions.update(actionId, { taskFormId }, ctx.adminUserId);

  const listForms = async (): Promise<FormSummaryDto[]> =>
    (
      await request(ctx.app.getHttpServer())
        .get("/tasks/listForms")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200)
    ).body as FormSummaryDto[];

  const renameSlug = (formId: number, slug: string) =>
    request(ctx.app.getHttpServer())
      .patch(`/tasks/forms/${formId}/slug`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ slug });

  it("gives a form with no action its id in base36", async () => {
    const form = await newForm();
    expect(form.slug).toBe(form.id.toString(36));
  });

  it("numbers the task form and its variants, and follow-ups apart", async () => {
    const action = await newAction("grantmaking-prep");
    const taskForm = await newForm();
    await setTaskForm(action.id, taskForm.id);
    const variant = await variants.createVariant(action.id, {
      name: "B",
      splitValue: 0.5,
    });
    const followUpForm = await newForm();
    await followUps.createFollowUpForm(action.id, {
      actionId: action.id,
      formId: followUpForm.id,
    });

    expect(await slugOf(taskForm.id)).toBe("v1");
    expect(await slugOf(variant.formId)).toBe("v2");
    expect(await slugOf(followUpForm.id)).toBe("f1");

    const byId = new Map((await listForms()).map((f) => [f.id, f.displaySlug]));
    expect(byId.get(taskForm.id)).toBe("grantmaking-prep::v1");
    expect(byId.get(variant.formId)).toBe("grantmaking-prep::v2");
    expect(byId.get(followUpForm.id)).toBe("grantmaking-prep::f1");
  });

  it("takes one past the highest live number, skipping renamed slugs", async () => {
    const action = await newAction("numbering");
    const taskForm = await newForm();
    await setTaskForm(action.id, taskForm.id);
    await renameSlug(taskForm.id, "v7").expect(200);
    const variant = await variants.createVariant(action.id, {
      name: "B",
      splitValue: 0.5,
    });
    await renameSlug(variant.formId, "control").expect(200);
    const next = await variants.createVariant(action.id, {
      name: "C",
      splitValue: 0.1,
    });
    expect(await slugOf(next.formId)).toBe("v8");
  });

  it("numbers follow-ups created at the same time without deadlocking", async () => {
    const action = await newAction("concurrent");
    const forms = await Promise.all(Array.from({ length: 6 }, () => newForm()));

    const results = await Promise.allSettled(
      forms.map((form) =>
        followUps.createFollowUpForm(action.id, {
          actionId: action.id,
          formId: form.id,
        }),
      ),
    );

    expect(results.filter((r) => r.status === "rejected")).toEqual([]);
    const slugs = await Promise.all(forms.map((form) => slugOf(form.id)));
    expect(slugs.sort()).toEqual(["f1", "f2", "f3", "f4", "f5", "f6"]);
  });

  it("keeps a renamed slug on attach, and refuses one taken in the action", async () => {
    const action = await newAction("keep");
    const taskForm = await newForm();
    await renameSlug(taskForm.id, "intake").expect(200);
    await setTaskForm(action.id, taskForm.id);
    expect(await slugOf(taskForm.id)).toBe("intake");

    const clash = await newForm();
    await renameSlug(clash.id, "intake").expect(200);
    await expect(
      followUps.createFollowUpForm(action.id, {
        actionId: action.id,
        formId: clash.id,
      }),
    ).rejects.toThrow('The slug "intake" is already taken');
  });

  it("keeps forms with no action unique among themselves", async () => {
    const a = await newForm();
    const b = await newForm();
    await renameSlug(a.id, "draft").expect(200);
    await renameSlug(b.id, "draft").expect(409);
  });

  it("checks a default slug among forms with no action on create", async () => {
    const taker = await newForm();
    const nextId = taker.id + 1;
    await renameSlug(taker.id, nextId.toString(36)).expect(200);
    const next = await newForm();
    expect(next.id).toBe(nextId);
    expect(next.slug).toBe(`${nextId.toString(36)}-2`);
  });

  it("re-slugs an attached form whose default was suffixed", async () => {
    const action = await newAction("suffixed");
    const taker = await newForm();
    await renameSlug(taker.id, (taker.id + 1).toString(36)).expect(200);
    const form = await newForm();
    await setTaskForm(action.id, form.id);
    expect(await slugOf(form.id)).toBe("v1");
  });

  it("lets two actions share a slug, but not two forms of one action", async () => {
    const first = await newAction("first");
    const second = await newAction("second");
    const a = await newForm();
    const b = await newForm();
    await setTaskForm(first.id, a.id);
    await setTaskForm(second.id, b.id);
    expect([await slugOf(a.id), await slugOf(b.id)]).toEqual(["v1", "v1"]);

    const variant = await variants.createVariant(first.id, {
      name: "B",
      splitValue: 0.5,
    });
    await renameSlug(variant.formId, "v1").expect(409);
  });

  it("rejects a slug that breaks the pattern", async () => {
    const form = await newForm();
    await renameSlug(form.id, "Not A Slug").expect(400);
  });
});
