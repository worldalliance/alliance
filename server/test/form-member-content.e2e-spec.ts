import type { FormSchema } from "@alliance/common/forms/form-schema";
import { milliseconds } from "date-fns";
import type { CreateActionDto } from "src/actions/dto/action.dto";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
import { Guest } from "src/auth/entities/guest.entity";
import {
  ShareUrl,
  ShareUrlKind,
} from "src/share-urls/entities/share-url.entity";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { TasksModule } from "src/tasks/tasks.module";
import request from "supertest";
import type { Repository } from "typeorm";
import { createTestApp, type TestContext } from "./e2e-test-utils";

describe("Per-member display block content (e2e)", () => {
  let ctx: TestContext;
  let actionRepo: Repository<Action>;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    actionRepo = ctx.dataSource.getRepository(Action);
  }, 50000);

  afterEach(async () => {
    await actionRepo.query("DELETE FROM form_response");
    await actionRepo.query("DELETE FROM action");
    await actionRepo.query("DELETE FROM form");
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const personalized = (): FormSchema => {
    const greeting = {
      id: "greeting",
      type: "display" as const,
      kind: "text" as const,
      text: "Hello",
      manualPerUser: true,
      manualUserContent: {
        [ctx.testUserId]: { text: "Dear member" },
        [ctx.adminUserId]: { text: "Dear other member" },
      },
    };
    return {
      pages: [
        {
          id: "p1",
          fields: [
            greeting,
            {
              id: "note",
              type: "input",
              kind: "text",
              label: "Note",
              output: { output: true },
            },
          ],
        },
      ],
      outputViews: [
        {
          id: "v1",
          type: "default",
          blocks: [
            { ...greeting, id: "thanks" },
            { id: "b1", fieldId: "note" },
          ],
        },
      ],
    };
  };

  const createAction = async () => {
    const form = await request(server())
      .post("/tasks/createForm")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ title: "Personal note", schema: personalized() })
      .expect(201);
    const action = await actionRepo.save(
      actionRepo.create({
        name: "Personal note",
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

  const fetchAs = (formId: number, token?: string) => {
    const req = request(server()).get(`/tasks/slug/${formId}`);
    return token ? req.set("Authorization", `Bearer ${token}`) : req;
  };

  const memberEntries = (schema: FormSchema) =>
    [schema.pages[0].fields[0], schema.outputViews[0].blocks[0]].map((block) =>
      "manualUserContent" in block ? block.manualUserContent : "missing",
    );

  it("sends a member only their own entry", async () => {
    const { formId } = await createAction();
    const served = await fetchAs(formId, ctx.accessToken).expect(200);
    const own = { [ctx.testUserId]: { text: "Dear member" } };
    expect(memberEntries(served.body.schema)).toEqual([own, own]);
    expect(JSON.stringify(served.body)).not.toContain("Dear other member");
  });

  it("sends a guest no entry", async () => {
    const { formId } = await createAction();
    const served = await fetchAs(formId).expect(200);
    expect(JSON.stringify(served.body)).not.toContain("Dear");
    expect(served.body.schema.pages[0].fields[0].text).toBe("Hello");
  });

  it("gives admins every entry", async () => {
    const { formId } = await createAction();
    const stored = await request(server())
      .get(`/tasks/adminForm/${formId}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);
    expect(stored.body.schema).toEqual(personalized());
  });

  it("accepts a build echoing the schema it was served, and returns only the member's entry", async () => {
    const { formId, actionId } = await createAction();
    const served = await fetchAs(formId, ctx.accessToken).expect(200);
    const submitted = await request(server())
      .post(`/tasks/submitForm/${formId}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send({
        answers: { note: "Done" },
        schemaSnapshot: served.body.schema,
        actionId,
        deviceType: "desktop" as const,
      })
      .expect(201);
    const mine = await request(server())
      .get(`/tasks/myResponse/${formId}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(200);
    const history = await request(server())
      .get(`/tasks/myResponseHistory/${formId}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(200);

    for (const body of [submitted.body, mine.body, history.body]) {
      expect(JSON.stringify(body)).toContain("Dear member");
      expect(JSON.stringify(body)).not.toContain("Dear other member");
    }
  });

  it("accepts a build echoing the schema it was served before the form was edited", async () => {
    const { formId, actionId } = await createAction();
    const served = await fetchAs(formId, ctx.accessToken).expect(200);
    await request(server())
      .put(`/tasks/updateForm/${formId}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({
        title: "Personal note",
        schema: { ...personalized(), description: "Edited" },
      })
      .expect(200);
    const submitted = await request(server())
      .post(`/tasks/submitForm/${formId}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send({
        answers: { note: "Done" },
        schemaSnapshot: served.body.schema,
        actionId,
        deviceType: "desktop" as const,
      })
      .expect(201);
    expect(submitted.body.formSnapshotId).toBe(served.body.formSnapshotId);
  });

  it("accepts a guest build echoing the schema it was served", async () => {
    const { formId, actionId } = await createAction();
    const served = await fetchAs(formId).expect(200);
    const submitted = await request(server())
      .post(`/tasks/submitPublicForm/${formId}`)
      .send({
        answers: { note: "Done" },
        schemaSnapshot: served.body.schema,
        actionId,
        deviceType: "desktop" as const,
      })
      .expect(201);
    expect(JSON.stringify(submitted.body)).not.toContain("Dear");
  });

  it("gives a member continuing a guest's draft only their own entry", async () => {
    const { formId, formSnapshotId, actionId } = await createAction();
    const guest = await ctx.dataSource
      .getRepository(Guest)
      .save({ linkedUser: { id: ctx.testUserId } });
    await ctx.dataSource
      .getRepository(FormResponse)
      .save({ formId, formSnapshotId, answers: {}, guest });
    const draft = await request(server())
      .get(`/tasks/draft/${formId}`)
      .query({ actionId })
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(200);
    expect(JSON.stringify(draft.body)).toContain("Dear member");
    expect(JSON.stringify(draft.body)).not.toContain("Dear other member");
  });

  const submitAsMember = (
    created: { formId: number; formSnapshotId: number; actionId: number },
    sid?: string,
  ) =>
    request(server())
      .post(`/tasks/submitForm/${created.formId}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send({
        answers: { note: "Done" },
        publicAnswers: { note: true },
        formSnapshotId: created.formSnapshotId,
        actionId: created.actionId,
        deviceType: "desktop" as const,
        sid,
      })
      .expect(201);

  it("shows other members a response in the activity feed with no member's entry", async () => {
    const created = await createAction();
    await submitAsMember(created);
    const feed = await request(server())
      .get(`/actions/${created.actionId}/activities`)
      .query({ comments: true })
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);
    const outputs = feed.body
      .map(
        (activity: { formResponseOutput?: unknown }) =>
          activity.formResponseOutput,
      )
      .filter(Boolean);
    expect(outputs).toHaveLength(1);
    expect(JSON.stringify(outputs)).toContain("Done");
    expect(JSON.stringify(feed.body)).not.toContain("Dear");
  });

  it("gives admins each response with only its respondent's entry", async () => {
    const created = await createAction();
    await submitAsMember(created);
    await request(server())
      .post(`/tasks/submitPublicForm/${created.formId}`)
      .send({
        answers: { note: "Done" },
        formSnapshotId: created.formSnapshotId,
        actionId: created.actionId,
        deviceType: "desktop" as const,
      })
      .expect(201);
    const responses = await request(server())
      .get(`/tasks/responses/${created.formId}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);
    expect(responses.body).toHaveLength(2);
    const [guest, member] = [false, true].map((isMember) =>
      JSON.stringify(
        responses.body.find(
          (response: { user: unknown }) => (response.user != null) === isMember,
        ),
      ),
    );
    expect(member).toContain("Dear member");
    expect(member).not.toContain("Dear other member");
    expect(guest).not.toContain("Dear");
  });

  it("gives admins a member's response history with only that member's entry", async () => {
    const created = await createAction();
    await submitAsMember(created);
    const history = await request(server())
      .get(`/tasks/responseHistory/${created.formId}/user/${ctx.testUserId}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);
    expect(JSON.stringify(history.body)).toContain("Dear member");
    expect(JSON.stringify(history.body)).not.toContain("Dear other member");
  });

  it("gives admins an inviter's invited submissions with only each respondent's entry", async () => {
    const created = await createAction();
    await ctx.dataSource.getRepository(ShareUrl).save({
      url: "https://example.com/invite",
      kind: ShareUrlKind.Action,
      userId: ctx.adminUserId,
      actionId: created.actionId,
      sid: "inviter-sid",
    });
    await submitAsMember(created, "inviter-sid");
    const responses = await request(server())
      .post(`/tasks/formsForUserSID/${ctx.adminUserId}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(201);
    expect(responses.body).toHaveLength(1);
    expect(JSON.stringify(responses.body)).toContain("Dear member");
    expect(JSON.stringify(responses.body)).not.toContain("Dear other member");
  });
});
