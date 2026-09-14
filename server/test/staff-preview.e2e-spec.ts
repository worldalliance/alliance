import { ActionActivityType } from "@alliance/common/actionActivity";
import type { FormSchema } from "@alliance/common/forms/form-schema";
import { milliseconds } from "date-fns";
import { ActionsService } from "src/actions/actions.service";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import {
  Action,
  ActionTaskType,
  VisibilityMode,
} from "src/actions/entities/action.entity";
import {
  Comment,
  CommentParentObject,
} from "src/forum/entities/comment.entity";
import { EditableContent } from "src/forum/entities/editablecontent.entity";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { TasksModule } from "src/tasks/tasks.module";
import { User } from "src/user/entities/user.entity";
import request from "supertest";
import type { Repository } from "typeorm";
import {
  createFormWithSnapshot,
  createTestApp,
  signAccessToken,
  type TestContext,
} from "./e2e-test-utils";

const previewFormSchema: FormSchema = {
  pages: [
    {
      id: "page-1",
      fields: [
        {
          id: "answer",
          type: "input",
          kind: "text",
          label: "Answer",
          required: true,
        },
      ],
    },
  ],
  outputViews: [],
  aggregateViews: [],
};

const previewRefusal = {
  statusCode: 403,
  error: "Forbidden",
  message: "This action is in staff preview",
};

describe("Staff preview (e2e)", () => {
  let ctx: TestContext;
  let actionRepo: Repository<Action>;
  let eventRepo: Repository<ActionEvent>;
  let activityRepo: Repository<ActionActivity>;
  let commentRepo: Repository<Comment>;
  let editableContentRepo: Repository<EditableContent>;
  let formResponseRepo: Repository<FormResponse>;
  let actionsService: ActionsService;
  let staffToken: string;
  let staffUserId: number;

  const server = () => ctx.app.getHttpServer();

  const createAction = async (params: {
    name: string;
    staffPreview: boolean;
    events: { newStatus: ActionStatus; offsetMs: number }[];
    overrides?: Partial<Action>;
  }): Promise<Action> => {
    const action = await actionRepo.save(
      actionRepo.create({
        name: params.name,
        category: "Test",
        body: "Body",
        taskContents: "Task",
        shortDescription: "Short",
        visibilityMode: VisibilityMode.Public,
        cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
        staffPreview: params.staffPreview,
        ...params.overrides,
      }),
    );
    for (const { newStatus, offsetMs } of params.events) {
      await eventRepo.save(
        eventRepo.create({
          title: newStatus,
          description: "",
          newStatus,
          date: new Date(Date.now() + offsetMs),
          action,
        }),
      );
    }
    return action;
  };

  const futureMemberAction = {
    newStatus: ActionStatus.MemberAction,
    offsetMs: milliseconds({ days: 3 }),
  };
  const pastPlanned = {
    newStatus: ActionStatus.Planned,
    offsetMs: -milliseconds({ days: 1 }),
  };
  const pastMemberAction = {
    newStatus: ActionStatus.MemberAction,
    offsetMs: -milliseconds({ hours: 1 }),
  };

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    actionRepo = ctx.dataSource.getRepository(Action);
    eventRepo = ctx.dataSource.getRepository(ActionEvent);
    activityRepo = ctx.dataSource.getRepository(ActionActivity);
    commentRepo = ctx.dataSource.getRepository(Comment);
    editableContentRepo = ctx.dataSource.getRepository(EditableContent);
    formResponseRepo = ctx.dataSource.getRepository(FormResponse);
    actionsService = ctx.app.get(ActionsService);

    const userRepo = ctx.dataSource.getRepository(User);
    const staff = await userRepo.save(
      userRepo.create({
        email: "staff@example.com",
        password: "pass",
        name: "Staff Member",
        staff: true,
      }),
    );
    staffUserId = staff.id;
    staffToken = signAccessToken(ctx.jwtService, staff);
  });

  afterAll(async () => {
    await actionRepo.query("DELETE FROM action");
    await ctx.app.close();
  });

  describe("writes during preview", () => {
    it("refuses completion", async () => {
      const action = await createAction({
        name: "Preview complete",
        staffPreview: true,
        events: [pastPlanned, futureMemberAction],
      });

      await request(server())
        .post(`/actions/complete/${action.id}`)
        .set("Authorization", `Bearer ${staffToken}`)
        .expect(403, previewRefusal);
      await request(server())
        .post(`/actions/complete/${action.id}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(403, previewRefusal);
    });

    it("refuses dismissal", async () => {
      const action = await createAction({
        name: "Preview dismiss",
        staffPreview: true,
        events: [pastPlanned, futureMemberAction],
      });

      await request(server())
        .post(`/actions/dismiss/${action.id}`)
        .set("Authorization", `Bearer ${staffToken}`)
        .expect(403, previewRefusal);
    });

    it("refuses form submission without saving the response", async () => {
      const { form, snapshot } = await createFormWithSnapshot(ctx.dataSource, {
        title: "Preview form",
        schema: previewFormSchema,
      });
      const action = await createAction({
        name: "Preview submit",
        staffPreview: true,
        events: [pastPlanned, futureMemberAction],
        overrides: { taskFormId: form.id },
      });

      await request(server())
        .post(`/tasks/submitForm/${form.id}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          answers: { answer: "hi" },
          formSnapshotId: snapshot.id,
          actionId: action.id,
          deviceType: "desktop",
        })
        .expect(403, previewRefusal);

      expect(await formResponseRepo.count({ where: { formId: form.id } })).toBe(
        0,
      );
    });

    it("refuses withdrawal without saving the partial response", async () => {
      const { form, snapshot } = await createFormWithSnapshot(ctx.dataSource, {
        title: "Preview optout form",
        schema: previewFormSchema,
      });
      const action = await createAction({
        name: "Preview withdraw",
        staffPreview: true,
        events: [pastPlanned, futureMemberAction],
        overrides: { taskFormId: form.id },
      });

      await request(server())
        .post(`/tasks/optout/${form.id}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          actionId: action.id,
          reason: "",
          outOfTime: true,
          isMoral: false,
          partialFormData: {
            answers: {},
            formSnapshotId: snapshot.id,
            actionId: action.id,
            deviceType: "desktop",
          },
        })
        .expect(403, previewRefusal);

      expect(await formResponseRepo.count({ where: { formId: form.id } })).toBe(
        0,
      );
    });

    it("refuses donations before a payment intent is created", async () => {
      const action = await createAction({
        name: "Preview donate",
        staffPreview: true,
        events: [pastPlanned, futureMemberAction],
        overrides: { type: ActionTaskType.Funding },
      });

      await expect(
        actionsService.getPaymentAmountForAction(action.id),
      ).rejects.toThrow(previewRefusal.message);
    });

    it("refuses comments on the action and on its activities", async () => {
      const action = await createAction({
        name: "Preview comment",
        staffPreview: true,
        events: [pastPlanned, futureMemberAction],
      });
      const activity = await activityRepo.save(
        activityRepo.create({
          type: ActionActivityType.USER_COMPLETED,
          actionId: action.id,
          userId: staffUserId,
        }),
      );

      for (const parent of [
        { parentObjectType: CommentParentObject.Action, id: action.id },
        { parentObjectType: CommentParentObject.Activity, id: activity.id },
      ]) {
        await request(server())
          .post("/forum/comments")
          .set("Authorization", `Bearer ${staffToken}`)
          .send({
            editableContent: { body: "hello", attachments: [] },
            parentObjectId: parent.id,
            parentObjectType: parent.parentObjectType,
          })
          .expect(403, previewRefusal);
      }
    });

    it("refuses likes on the action's activities and comments", async () => {
      const action = await createAction({
        name: "Preview like",
        staffPreview: true,
        events: [pastPlanned, futureMemberAction],
      });
      const activity = await activityRepo.save(
        activityRepo.create({
          type: ActionActivityType.USER_COMPLETED,
          actionId: action.id,
          userId: ctx.testUserId,
        }),
      );
      const comment = await commentRepo.save(
        commentRepo.create({
          parentObjectType: CommentParentObject.Action,
          parentObjectId: action.id,
          authorId: ctx.testUserId,
          editableContent: await editableContentRepo.save(
            editableContentRepo.create({ body: "existing", attachments: [] }),
          ),
        }),
      );

      await request(server())
        .post(`/actions/likeActivity/${activity.id}`)
        .set("Authorization", `Bearer ${staffToken}`)
        .expect(403, previewRefusal);
      await request(server())
        .post(`/forum/comments/${comment.id}/like`)
        .set("Authorization", `Bearer ${staffToken}`)
        .expect(403, previewRefusal);
    });

    it("still creates share codes", async () => {
      const action = await createAction({
        name: "Preview share",
        staffPreview: true,
        events: [pastPlanned, futureMemberAction],
      });

      await request(server())
        .post(`/actions/${action.id}/referralCode`)
        .set("Authorization", `Bearer ${staffToken}`)
        .expect(201);
    });

    it("accepts writes before launch with the toggle off", async () => {
      const action = await createAction({
        name: "Toggle off writes",
        staffPreview: false,
        events: [pastPlanned, futureMemberAction],
      });
      const activity = await activityRepo.save(
        activityRepo.create({
          type: ActionActivityType.USER_COMPLETED,
          actionId: action.id,
          userId: ctx.testUserId,
        }),
      );

      await request(server())
        .post("/forum/comments")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({
          editableContent: { body: "hello", attachments: [] },
          parentObjectId: action.id,
          parentObjectType: CommentParentObject.Action,
        })
        .expect(201);
      await request(server())
        .post(`/actions/likeActivity/${activity.id}`)
        .set("Authorization", `Bearer ${staffToken}`)
        .expect(201);
    });

    it("accepts writes once the member_action event starts, with the toggle still on", async () => {
      const action = await createAction({
        name: "Launched writes",
        staffPreview: true,
        events: [pastMemberAction],
      });

      await request(server())
        .post(`/actions/complete/${action.id}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(201);
      await request(server())
        .post("/forum/comments")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: { body: "hello", attachments: [] },
          parentObjectId: action.id,
          parentObjectType: CommentParentObject.Action,
        })
        .expect(201);
    });
  });

  describe("admin toggle", () => {
    it("round-trips staffPreview through the admin endpoints", async () => {
      const action = await createAction({
        name: "Toggle",
        staffPreview: false,
        events: [futureMemberAction],
      });

      await request(server())
        .patch(`/actions/${action.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ staffPreview: true })
        .expect(200);

      const res = await request(server())
        .get(`/actions/adminslug/${action.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      expect(res.body.staffPreview).toBe(true);
    });
  });
});
