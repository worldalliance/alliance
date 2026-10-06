import { ActionActivityType } from "@alliance/common/actionActivity";
import type { FormSchema } from "@alliance/common/forms/form-schema";
import { milliseconds } from "date-fns";
import { CreateActionDto } from "src/actions/dto/action.dto";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
import { FollowUpForm } from "src/actions/entities/follow-up-form.entity";
import { FormSnapshot } from "src/tasks/entities/formsnapshot.entity";
import { FormSnapshotService } from "src/tasks/formsnapshot.service";
import { TasksModule } from "src/tasks/tasks.module";
import request from "supertest";
import type { Repository } from "typeorm";
import { createTestApp, type TestContext } from "./e2e-test-utils";

// BACKCOMPAT(form-snapshot): clients from before the cutover submit the schema they were served.
describe("Legacy schemaSnapshot submissions (e2e)", () => {
  let ctx: TestContext;
  let actionRepo: Repository<Action>;
  let eventRepo: Repository<ActionEvent>;
  let actionActivityRepo: Repository<ActionActivity>;

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    actionRepo = ctx.dataSource.getRepository(Action);
    eventRepo = ctx.dataSource.getRepository(ActionEvent);
    actionActivityRepo = ctx.dataSource.getRepository(ActionActivity);
  }, 50000);

  afterEach(async () => {
    jest.restoreAllMocks();
    await actionRepo.query("DELETE FROM form_response");
    await actionRepo.query("DELETE FROM action_activity");
    await actionRepo.query("DELETE FROM follow_up_form");
    await actionRepo.query("DELETE FROM action_event");
    await actionRepo.query("DELETE FROM action");
    await actionRepo.query("DELETE FROM form");
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  /** A live (non-draft) member action; link a form via actionRepo.update(id, { taskFormId }). */
  const createAction = async (name: string): Promise<Action> => {
    const action = await actionRepo.save(
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
        cohortExpression: {
          type: "Tag",
          tagId: ctx.defaultTag.id,
        },
      } satisfies CreateActionDto),
    );

    await eventRepo.save(
      eventRepo.create({
        title: `${name} Event`,
        description: `${name} Event`,
        newStatus: ActionStatus.MemberAction,
        date: new Date(Date.now() - milliseconds({ seconds: 1 })),
        action,
      }),
    );

    return action;
  };

  const videoSchema = (description: string): FormSchema => ({
    description,
    pages: [
      {
        id: "page-1",
        fields: [
          {
            id: "uploaded",
            type: "display",
            kind: "video",
            src: "https://dj92mxbdjuclo.cloudfront.net/videos/1777426220647",
            videoId: 7,
          },
        ],
      },
    ],
    outputViews: [],
  });

  const openForm = async (name: string, schema = videoSchema(name)) => {
    const form = await request(ctx.app.getHttpServer())
      .post("/tasks/createForm")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ title: name, schema })
      .expect(201);
    const action = await createAction(name);
    await actionRepo.update(action.id, { taskFormId: form.body.id });
    const served = await request(ctx.app.getHttpServer())
      .get(`/tasks/slug/${form.body.id}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(200);
    const submit = (schemaSnapshot = served.body.schema) =>
      request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${form.body.id}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          answers: {},
          schemaSnapshot,
          actionId: action.id,
          deviceType: "desktop" as const,
        });
    return {
      formId: form.body.id as number,
      served: served.body.schema,
      submit,
    };
  };

  describe("a legacy submission echoing a served video saved as a storage url", () => {
    it("is accepted", async () => {
      const { submit } = await openForm("Legacy video form");

      await submit().expect(201);
    });

    it("is accepted after the form is edited", async () => {
      const { formId, submit } = await openForm("Edited legacy video form");
      await request(ctx.app.getHttpServer())
        .put(`/tasks/updateForm/${formId}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          title: "Edited legacy video form",
          schema: videoSchema("Edited since it was opened"),
        })
        .expect(200);

      await submit().expect(201);
    });

    it("is served by its key and accepted when it sits in an output view", async () => {
      const { served, submit } = await openForm("Output view video form", {
        pages: [{ id: "page-1", fields: [] }],
        outputViews: [
          {
            type: "default",
            id: "summary",
            blocks: [
              {
                id: "outro",
                type: "display",
                kind: "video",
                src: "https://dj92mxbdjuclo.cloudfront.net/videos/1777426220647",
                videoId: 7,
              },
            ],
          },
        ],
      });

      expect(served.outputViews[0].blocks[0].src).toBe("videos/1777426220647");
      await submit().expect(201);
    });
  });

  it("accepts a legacy submission echoing videos served as storage urls before the cutover", async () => {
    const storageUrl =
      "https://dj92mxbdjuclo.cloudfront.net/videos/1777426220647";
    const { served, submit } = await openForm("Pre-cutover video form", {
      pages: [
        {
          id: "page-1",
          fields: [
            {
              id: "hero",
              type: "display",
              kind: "images",
              images: [{ src: "legacy-image-key", alt: "Hero" }],
            },
            {
              id: "by-key",
              type: "display",
              kind: "video",
              src: "videos/1777426220647",
              videoId: 7,
            },
            {
              id: "by-url",
              type: "display",
              kind: "video",
              src: storageUrl,
              videoId: 7,
            },
          ],
        },
      ],
      outputViews: [],
    });
    const echoed = structuredClone(served);
    echoed.pages[0].fields[1].src = storageUrl;
    echoed.pages[0].fields[2].src = storageUrl;

    await submit(echoed).expect(201);
  });

  it("accepts a legacy submission echoing the contract the form was served with", async () => {
    const form = await request(ctx.app.getHttpServer())
      .post("/tasks/createForm")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({
        title: "Legacy contract form",
        schema: {
          pages: [
            {
              id: "page-1",
              fields: [
                {
                  id: "contract",
                  type: "input",
                  kind: "contract",
                  label: null,
                  contractId: ctx.defaultContractId,
                  signQuestion: "Sign?",
                  yesLabel: "Yes",
                  noLabel: "No",
                },
              ],
            },
          ],
          outputViews: [],
        } satisfies FormSchema,
      })
      .expect(201);
    const action = await createAction("Legacy contract form");
    await actionRepo.update(action.id, { taskFormId: form.body.id });
    const served = await request(ctx.app.getHttpServer())
      .get(`/tasks/slug/${form.body.id}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(200);

    await request(ctx.app.getHttpServer())
      .post(`/tasks/submitForm/${form.body.id}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send({
        answers: {},
        schemaSnapshot: served.body.schema,
        actionId: action.id,
        deviceType: "desktop" as const,
      })
      .expect(201);
  });

  it("accepts a legacy submission echoing an earlier version's served images", async () => {
    const schema = (description: string): FormSchema => ({
      description,
      pages: [
        {
          id: "page-1",
          fields: [
            {
              id: "hero",
              type: "display",
              kind: "images",
              images: [{ src: "legacy-image-key", alt: "Hero" }],
            },
          ],
        },
      ],
      outputViews: [],
    });
    const form = await request(ctx.app.getHttpServer())
      .post("/tasks/createForm")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ title: "Legacy image form", schema: schema("Opened") })
      .expect(201);
    const action = await createAction("Legacy image form");
    await actionRepo.update(action.id, { taskFormId: form.body.id });
    const served = await request(ctx.app.getHttpServer())
      .get(`/tasks/slug/${form.body.id}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(200);
    await request(ctx.app.getHttpServer())
      .put(`/tasks/updateForm/${form.body.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ title: "Legacy image form", schema: schema("Edited") })
      .expect(200);

    await request(ctx.app.getHttpServer())
      .post(`/tasks/submitForm/${form.body.id}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send({
        answers: {},
        schemaSnapshot: served.body.schema,
        actionId: action.id,
        deviceType: "desktop" as const,
      })
      .expect(201);
  });

  it("refuses a legacy submission whose schema matches nothing served", async () => {
    const form = await request(ctx.app.getHttpServer())
      .post("/tasks/createForm")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({
        title: "Tampered legacy form",
        schema: {
          pages: [
            {
              id: "page-1",
              fields: [
                {
                  id: "hero",
                  type: "display",
                  kind: "images",
                  images: [{ src: "tampered-image-key", alt: "Hero" }],
                },
              ],
            },
          ],
          outputViews: [],
        } satisfies FormSchema,
      })
      .expect(201);
    const action = await createAction("Tampered legacy form");
    await actionRepo.update(action.id, { taskFormId: form.body.id });
    const served = await request(ctx.app.getHttpServer())
      .get(`/tasks/slug/${form.body.id}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(200);
    const tampered = structuredClone(served.body.schema);
    tampered.pages[0].fields[0].images[0].alt = "Changed";

    const refused = await request(ctx.app.getHttpServer())
      .post(`/tasks/submitForm/${form.body.id}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send({
        answers: {},
        schemaSnapshot: tampered,
        actionId: action.id,
        deviceType: "desktop" as const,
      })
      .expect(400);
    expect(refused.body.message).toBe(
      "Submitted schema does not match any historical snapshot for this form",
    );
  });

  it("hashes each served history version once across unmatched legacy submissions", async () => {
    const schema = (description: string): FormSchema => ({
      description,
      pages: [
        {
          id: "page-1",
          fields: [
            {
              id: "hero",
              type: "display",
              kind: "images",
              images: [{ src: "scanned-image-key", alt: "Hero" }],
            },
          ],
        },
      ],
      outputViews: [],
    });
    const form = await request(ctx.app.getHttpServer())
      .post("/tasks/createForm")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ title: "Scanned form", schema: schema("First") })
      .expect(201);
    await request(ctx.app.getHttpServer())
      .put(`/tasks/updateForm/${form.body.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ title: "Scanned form", schema: schema("Second") })
      .expect(200);
    const snapshots = ctx.app.get(FormSnapshotService);
    const loads = jest.spyOn(
      ctx.dataSource.getRepository(FormSnapshot),
      "findBy",
    );
    const lookUp = () =>
      snapshots.findHistoricalBySchemaOrThrow(form.body.id, {});

    await expect(lookUp()).rejects.toThrow(
      "Submitted schema does not match any historical snapshot for this form",
    );
    await expect(lookUp()).rejects.toThrow(
      "Submitted schema does not match any historical snapshot for this form",
    );
    expect(loads).toHaveBeenCalledTimes(1);
  });

  it("accepts a legacy follow-up submission echoing the contract it was served with", async () => {
    const action = await createAction("Legacy follow-up action");
    const form = await request(ctx.app.getHttpServer())
      .post("/tasks/createForm")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({
        title: "Legacy follow-up form",
        schema: {
          pages: [
            {
              id: "page-1",
              fields: [
                {
                  id: "contract",
                  type: "input",
                  kind: "contract",
                  label: null,
                  contractId: ctx.defaultContractId,
                  signQuestion: "Sign?",
                  yesLabel: "Yes",
                  noLabel: "No",
                },
              ],
            },
          ],
          outputViews: [],
        } satisfies FormSchema,
      })
      .expect(201);
    await actionActivityRepo.save(
      actionActivityRepo.create({
        actionId: action.id,
        userId: ctx.testUserId,
        type: ActionActivityType.USER_COMPLETED,
      }),
    );
    const followUp = await ctx.dataSource.getRepository(FollowUpForm).save({
      actionId: action.id,
      formId: form.body.id as number,
      startDate: new Date(Date.now() - milliseconds({ days: 1 })),
      cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
    });
    const served = await request(ctx.app.getHttpServer())
      .get(`/tasks/slug/${form.body.id}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(200);

    await request(ctx.app.getHttpServer())
      .post(`/tasks/submitFollowUpForm/${followUp.id}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send({
        answers: {},
        schemaSnapshot: served.body.schema,
        deviceType: "desktop",
      })
      .expect(201);
  });
});
