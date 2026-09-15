import { ActionActivityType } from "@alliance/common/actionActivity";
import type { FormSchema } from "@alliance/common/forms/form-schema";
import { milliseconds } from "date-fns";
import { ActionsService } from "src/actions/actions.service";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { ActionFormAssignment } from "src/actions/entities/action-form-assignment.entity";
import { ActionFormVariant } from "src/actions/entities/action-form-variant.entity";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
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
import type { ActionDto } from "../src/actions/dto/action.dto";
import {
  createFormWithSnapshot,
  createTestApp,
  giveActiveContract,
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

  const findInList = async (
    token: string,
    actionId: number,
  ): Promise<ActionDto | undefined> => {
    const res = await request(server())
      .get("/actions/loggedIn")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    return (res.body as ActionDto[]).find((a) => a.id === actionId);
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

  describe("visibility", () => {
    it("lists a draft action in preview for staff, marked as a preview", async () => {
      const action = await createAction({
        name: "Draft preview",
        staffPreview: true,
        events: [futureMemberAction],
      });

      const listed = await findInList(staffToken, action.id);

      expect(listed?.viewer?.staffPreview).toBe(true);
    });

    it("lists a cohort-restricted action in preview for staff outside the cohort", async () => {
      const action = await createAction({
        name: "Cohort preview",
        staffPreview: true,
        events: [pastPlanned, futureMemberAction],
        overrides: { visibilityMode: VisibilityMode.ParticipatingGroups },
      });
      const userRepo = ctx.dataSource.getRepository(User);
      const outsider = await userRepo.save(
        userRepo.create({
          email: "outsider@example.com",
          password: "pass",
          name: "Outside Cohort",
        }),
      );

      const staffView = await findInList(staffToken, action.id);

      expect(staffView?.viewer?.staffPreview).toBe(true);
      expect(
        await findInList(signAccessToken(ctx.jwtService, outsider), action.id),
      ).toBeUndefined();
    });

    it("hides a draft action in preview from non-staff members", async () => {
      const action = await createAction({
        name: "Draft preview hidden",
        staffPreview: true,
        events: [futureMemberAction],
      });

      expect(await findInList(ctx.accessToken, action.id)).toBeUndefined();
      await request(server())
        .get(`/actions/slug/${action.id}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(404);
      await request(server()).get(`/actions/slug/${action.id}`).expect(404);
    });

    it("keeps a share link from opening a draft preview for non-staff", async () => {
      const action = await createAction({
        name: "Draft preview shared",
        staffPreview: true,
        events: [futureMemberAction],
      });

      const code = await request(server())
        .post(`/actions/${action.id}/referralCode`)
        .set("Authorization", `Bearer ${staffToken}`)
        .expect(201);

      await request(server())
        .get(`/actions/${action.id}/sharePreview`)
        .query({ sid: code.body.referralCode })
        .expect(404);
      await request(server())
        .get(`/actions/slug/${action.id}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(404);
    });

    it("does not mark the preview for admins who are not staff", async () => {
      const action = await createAction({
        name: "Draft preview admin",
        staffPreview: true,
        events: [futureMemberAction],
      });

      const listed = await findInList(ctx.adminAccessToken, action.id);

      expect(listed?.viewer?.staffPreview).toBe(false);
    });

    it("marks the preview on the single-action endpoint for staff", async () => {
      const action = await createAction({
        name: "Draft preview single",
        staffPreview: true,
        events: [futureMemberAction],
      });

      const res = await request(server())
        .get(`/actions/slug/${action.id}`)
        .set("Authorization", `Bearer ${staffToken}`)
        .expect(200);

      expect(res.body.viewer.staffPreview).toBe(true);
    });

    it("keeps a draft action with preview off hidden from staff", async () => {
      const action = await createAction({
        name: "Draft no preview",
        staffPreview: false,
        events: [futureMemberAction],
      });

      expect(await findInList(staffToken, action.id)).toBeUndefined();
    });

    it("drops the preview once the member_action event starts, with the toggle still on", async () => {
      const action = await createAction({
        name: "Launched with preview on",
        staffPreview: true,
        events: [pastMemberAction],
      });

      const staffView = await findInList(staffToken, action.id);
      const memberView = await findInList(ctx.accessToken, action.id);

      expect(staffView?.viewer?.staffPreview).toBe(false);
      expect(staffView?.viewer?.canComplete).toBe(false);
      expect(memberView?.viewer?.staffPreview).toBe(false);
      expect(memberView?.viewer?.canComplete).toBe(true);
    });

    it("hides a launched cohort-restricted action from staff outside the cohort, with the toggle still on", async () => {
      const action = await createAction({
        name: "Launched cohort preview",
        staffPreview: true,
        events: [pastMemberAction],
        overrides: { visibilityMode: VisibilityMode.ParticipatingGroups },
      });

      expect(await findInList(staffToken, action.id)).toBeUndefined();
      await request(server())
        .get(`/actions/slug/${action.id}`)
        .set("Authorization", `Bearer ${staffToken}`)
        .expect(404);
    });

    it("drops the preview for archived actions", async () => {
      const action = await createAction({
        name: "Archived preview",
        staffPreview: true,
        events: [futureMemberAction],
        overrides: { archived: true },
      });

      expect(await findInList(staffToken, action.id)).toBeUndefined();
    });

    it("does not mark an archived action as a preview for admins who are staff", async () => {
      const action = await createAction({
        name: "Archived preview admin staff",
        staffPreview: true,
        events: [futureMemberAction],
        overrides: { archived: true },
      });
      const userRepo = ctx.dataSource.getRepository(User);
      const adminStaff = await userRepo.save(
        userRepo.create({
          email: "admin-staff@example.com",
          password: "pass",
          name: "Admin Staff",
          staff: true,
          admin: true,
        }),
      );

      const listed = await findInList(
        signAccessToken(ctx.jwtService, adminStaff),
        action.id,
      );

      expect(listed?.viewer?.staffPreview).toBe(false);
    });

    it("leaves a draft in preview out of reminder task lists for staff in the cohort", async () => {
      const action = await createAction({
        name: "Draft preview reminder",
        staffPreview: true,
        events: [futureMemberAction],
      });
      const userRepo = ctx.dataSource.getRepository(User);
      const cohortStaff = await userRepo.save(
        userRepo.create({
          email: "cohort-staff@example.com",
          password: "pass",
          name: "Cohort Staff",
          staff: true,
          tags: [ctx.defaultTag],
        }),
      );
      await giveActiveContract(ctx, cohortStaff.id);

      const listed = await findInList(
        signAccessToken(ctx.jwtService, cohortStaff),
        action.id,
      );
      const tasks = await actionsService.findUncompletedTasks(cohortStaff.id);

      expect(listed?.viewer?.staffPreview).toBe(true);
      expect(tasks.map((task) => task.id)).not.toContain(action.id);
    });
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
        events: [futureMemberAction],
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
        events: [futureMemberAction],
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

  describe("form variants", () => {
    const createAssignedVariant = async (params: {
      name: string;
      staffPreview: boolean;
      events: { newStatus: ActionStatus; offsetMs: number }[];
    }): Promise<{
      actionId: number;
      variantId: number;
      variantFormId: number;
      snapshotId: number;
    }> => {
      const { form, snapshot } = await createFormWithSnapshot(ctx.dataSource, {
        title: params.name,
        schema: previewFormSchema,
      });
      const action = await createAction({
        name: params.name,
        staffPreview: params.staffPreview,
        events: params.events,
        overrides: { taskFormId: form.id },
      });
      const variant = await request(server())
        .post(`/actions/${action.id}/form-variants`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ name: "B", splitValue: 1 })
        .expect(201);
      await ctx.dataSource.getRepository(ActionFormAssignment).insert({
        actionId: action.id,
        userId: staffUserId,
        variantId: variant.body.id,
      });
      return {
        actionId: action.id,
        variantId: variant.body.id,
        variantFormId: variant.body.formId,
        snapshotId: snapshot.id,
      };
    };

    it("deletes a variant and its assignments during preview", async () => {
      const { actionId, variantId } = await createAssignedVariant({
        name: "Preview variant delete",
        staffPreview: true,
        events: [futureMemberAction],
      });

      await request(server())
        .delete(`/actions/form-variants/${variantId}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      expect(
        await ctx.dataSource
          .getRepository(ActionFormAssignment)
          .countBy({ actionId }),
      ).toBe(0);
      expect(
        await ctx.dataSource
          .getRepository(ActionFormVariant)
          .countBy({ id: variantId }),
      ).toBe(0);
    });

    it("keeps a variant with assignments once the member_action event starts, with the toggle still on", async () => {
      const { variantId } = await createAssignedVariant({
        name: "Launched variant delete",
        staffPreview: true,
        events: [pastMemberAction],
      });

      await request(server())
        .delete(`/actions/form-variants/${variantId}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(400);
    });

    it("deletes a variant and its assignments before launch when preview is off", async () => {
      const { actionId, variantId } = await createAssignedVariant({
        name: "Unpreviewed variant delete",
        staffPreview: false,
        events: [futureMemberAction],
      });

      await request(server())
        .delete(`/actions/form-variants/${variantId}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      expect(
        await ctx.dataSource
          .getRepository(ActionFormAssignment)
          .countBy({ actionId }),
      ).toBe(0);
    });

    it("keeps a variant whose form has responses during preview", async () => {
      const { actionId, variantId, variantFormId, snapshotId } =
        await createAssignedVariant({
          name: "Relaunched variant delete",
          staffPreview: true,
          events: [futureMemberAction],
        });
      await formResponseRepo.save(
        formResponseRepo.create({
          formId: variantFormId,
          user: { id: staffUserId },
          answers: { answer: "submitted" },
          formSnapshotId: snapshotId,
        }),
      );

      await request(server())
        .delete(`/actions/form-variants/${variantId}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(400);

      expect(
        await ctx.dataSource
          .getRepository(ActionFormAssignment)
          .countBy({ actionId }),
      ).toBe(1);
    });
  });
});
