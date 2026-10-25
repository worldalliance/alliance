import type { FormSchema } from "@alliance/common/forms/form-schema";
import { RowConditionKind } from "@alliance/common/forms/row-list-schema";
import { milliseconds } from "date-fns";
import type { CreateActionDto } from "src/actions/dto/action.dto";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
import { FormRowAssignment } from "src/tasks/entities/form-row-assignment.entity";
import { TasksModule } from "src/tasks/tasks.module";
import request from "supertest";
import type { Repository } from "typeorm";
import { createTestApp, type TestContext } from "./e2e-test-utils";

const websiteRow = {
  jurisdiction: "Springfield",
  type: "City",
  prrFilingMode: "Website",
  prrWebsite: "https://springfield.example.gov/requests/new",
  email: null,
};
const emailRow = {
  jurisdiction: "Springfield",
  type: "County",
  prrFilingMode: "Email",
  prrWebsite: "https://county.example.gov/records",
  email: "records@county.example.gov",
};

const schemaWithRows = (rows: Record<string, string | null>[]): FormSchema => ({
  pages: [
    {
      id: "p1",
      fields: [
        {
          id: "intro",
          type: "display",
          kind: "text",
          text: "File with #{row.jurisdiction} #{row.type}",
        },
        {
          id: "sentTo",
          type: "input",
          kind: "email",
          label: "Emailed to",
          defaultValue: "#{row.email}",
          required: true,
          rowCondition: { kind: RowConditionKind.HasValue, field: "email" },
        },
        { id: "note", type: "input", kind: "text", label: "Note" },
      ],
    },
  ],
  outputViews: [],
  rowList: { rows, keyFields: ["jurisdiction", "type"] },
});

describe("Forms with a row list (e2e)", () => {
  let ctx: TestContext;
  let actionRepo: Repository<Action>;
  let assignmentRepo: Repository<FormRowAssignment>;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    actionRepo = ctx.dataSource.getRepository(Action);
    assignmentRepo = ctx.dataSource.getRepository(FormRowAssignment);
  }, 50000);

  afterEach(async () => {
    await actionRepo.query("DELETE FROM form_row_assignment");
    await actionRepo.query("DELETE FROM form_response");
    await actionRepo.query("DELETE FROM action");
    await actionRepo.query("DELETE FROM form");
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const createForm = (schema: FormSchema) =>
    request(server())
      .post("/tasks/createForm")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ title: "Records request", schema });

  const createAction = async (schema: FormSchema) => {
    const form = await createForm(schema).expect(201);
    const action = await actionRepo.save(
      actionRepo.create({
        name: "Records request",
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

  const servedIntro = (body: { schema: FormSchema }) => {
    const intro = body.schema.pages[0].fields[0];
    return intro.type === "display" && intro.kind === "text"
      ? intro.text
      : undefined;
  };

  it("rejects a list whose rows share a key", async () => {
    const response = await createForm(
      schemaWithRows([websiteRow, { ...websiteRow, email: "x@example.gov" }]),
    ).expect(400);
    expect(response.body.errors).toContainEqual({
      blockId: "rowList",
      message: 'Two rows share the key ["Springfield","City"]',
    });
  });

  it("refuses the form to anyone not signed in", async () => {
    const { formId } = await createAction(schemaWithRows([websiteRow]));
    await fetchAs(formId).expect(403);
  });

  it("serves each member their own filled row, the same one every time", async () => {
    const { formId } = await createAction(
      schemaWithRows([websiteRow, emailRow]),
    );

    const first = await fetchAs(formId, ctx.accessToken).expect(200);
    const again = await fetchAs(formId, ctx.accessToken).expect(200);
    const other = await fetchAs(formId, ctx.adminAccessToken).expect(200);

    expect(first.body.schema.rowList).toBeUndefined();
    expect(JSON.stringify(first.body.schema)).not.toContain("rowCondition");
    expect(JSON.stringify(first.body.schema)).not.toContain("#{row.");
    expect(servedIntro(again.body)).toBe(servedIntro(first.body));
    expect([servedIntro(first.body), servedIntro(other.body)].sort()).toEqual([
      "File with Springfield City",
      "File with Springfield County",
    ]);
  });

  it("gives admins the stored form, unfilled", async () => {
    const { formId } = await createAction(schemaWithRows([websiteRow]));
    const stored = await request(server())
      .get(`/tasks/adminForm/${formId}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);
    expect(stored.body.schema.rowList.rows).toEqual([websiteRow]);
    await request(server())
      .get(`/tasks/adminForm/${formId}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(401);
  });

  describe("submitting", () => {
    const submit = (params: {
      formId: number;
      formSnapshotId: number;
      actionId: number;
      answers: Record<string, string>;
    }) =>
      request(server())
        .post(`/tasks/submitForm/${params.formId}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          answers: params.answers,
          formSnapshotId: params.formSnapshotId,
          actionId: params.actionId,
          deviceType: "desktop" as const,
        });

    it("saves the row and skips a required field the row hides", async () => {
      const created = await createAction(schemaWithRows([websiteRow]));
      await fetchAs(created.formId, ctx.accessToken).expect(200);
      const response = await submit({
        ...created,
        answers: { note: "Filed" },
      }).expect(201);
      expect(response.body.assignedRow).toEqual({
        key: '["Springfield","City"]',
        values: websiteRow,
      });

      const mine = await request(server())
        .get(`/tasks/myResponse/${created.formId}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);
      expect(servedIntro({ schema: mine.body.schemaSnapshot })).toBe(
        "File with Springfield City",
      );
      expect(mine.body.schemaSnapshot.rowList).toBeUndefined();
    });

    it("accepts a build that echoes the schema it was served", async () => {
      const created = await createAction(schemaWithRows([emailRow]));
      const served = await fetchAs(created.formId, ctx.accessToken).expect(200);
      const response = await request(server())
        .post(`/tasks/submitForm/${created.formId}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          answers: { sentTo: "records@county.example.gov", note: "Filed" },
          schemaSnapshot: served.body.schema,
          actionId: created.actionId,
          deviceType: "desktop" as const,
        })
        .expect(201);
      expect(response.body.assignedRow.values).toEqual(emailRow);
    });

    it("requires a field the row shows", async () => {
      const created = await createAction(schemaWithRows([emailRow]));
      await submit({ ...created, answers: { note: "Filed" } }).expect(400);
    });

    it("refuses a guest submission", async () => {
      const created = await createAction(schemaWithRows([websiteRow]));
      await request(server())
        .post(`/tasks/submitPublicForm/${created.formId}`)
        .send({
          answers: { note: "Filed" },
          formSnapshotId: created.formSnapshotId,
          actionId: created.actionId,
          deviceType: "desktop" as const,
        })
        .expect(403);
    });
  });

  it("reassigns an unsubmitted member whose row the admin removed", async () => {
    const { formId } = await createAction(schemaWithRows([websiteRow]));
    await fetchAs(formId, ctx.accessToken).expect(200);

    await request(server())
      .put(`/tasks/updateForm/${formId}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ schema: schemaWithRows([emailRow]) })
      .expect(200);

    const served = await fetchAs(formId, ctx.accessToken).expect(200);
    expect(servedIntro(served.body)).toBe("File with Springfield County");
    const assignment = await assignmentRepo.findOneByOrFail({
      formId,
      userId: ctx.testUserId,
    });
    expect(assignment.rowKey).toBe('["Springfield","County"]');
  });
});
