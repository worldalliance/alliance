import { ActionActivityType } from "@alliance/common/actionActivity";
import { ActionsService } from "src/actions/actions.service";
import type { ActionActivity } from "src/actions/entities/action-activity.entity";
import { ActionFormAssignment } from "src/actions/entities/action-form-assignment.entity";
import { ActionFormVariant } from "src/actions/entities/action-form-variant.entity";
import { StaffPreviewService } from "src/actions/staff-preview.service";
import { ContractService } from "src/contract/contract.service";
import { CreateCommentDto } from "src/forum/dto/comment.dto";
import {
  Comment,
  CommentParentObject,
} from "src/forum/entities/comment.entity";
import { City } from "src/geo/city.entity";
import { ActionEventRecipientService } from "src/notifs/action-event-recipient.service";
import {
  Notification,
  NotificationCategory,
} from "src/notifs/entities/notification.entity";
import {
  UnreadContent,
  UnreadContentType,
} from "src/notifs/entities/unread-content.entity";
import { NotifsService } from "src/notifs/notifs.service";
import { ShareUrl } from "src/share-urls/entities/share-url.entity";
import type { Form } from "src/tasks/entities/form.entity";
import type { FormResponse } from "src/tasks/entities/formresponse.entity";
import { ContractEventType } from "src/user/entities/contract-event.entity";
import {
  UserAwayRange,
  UserAwayRangeReason,
} from "src/user/entities/user-away-range.entity";
import { UserService } from "src/user/user.service";
import request from "supertest";
import type { Repository } from "typeorm";
import {
  ActionActivityDto,
  ActionDto,
  ActionEventDto,
  CreateActionDto,
  CreateActionEventDto,
  GlobalFeedItemType,
} from "../src/actions/dto/action.dto";
import {
  ActionEvent,
  ActionStatus,
} from "../src/actions/entities/action-event.entity";
import {
  ActionReviewer,
  ActionReviewerIcon,
} from "../src/actions/entities/action-reviewer.entity";
import {
  Action,
  ActionTaskType,
  VisibilityMode,
} from "../src/actions/entities/action.entity";
import { FollowUpForm } from "../src/actions/entities/follow-up-form.entity";
import type { Community } from "../src/community/entities/community.entity";
import { getImageSource } from "../src/images/images.service";
import { User } from "../src/user/entities/user.entity";
import {
  createFormWithSnapshot,
  createTestApp,
  TestContext,
} from "./e2e-test-utils";

describe("Actions (e2e)", () => {
  let ctx: TestContext;
  let testAction: Action;
  let testDraftAction: Action;
  let actionRepo: Repository<Action>;
  let eventRepo: Repository<ActionEvent>;
  let userService: UserService;
  let contractService: ContractService;
  let staffPreviewService: StaffPreviewService;
  let actionsService: ActionsService;
  let userRepo: Repository<User>;
  let commentRepo: Repository<Comment>;
  let notifRepo: Repository<Notification>;
  let unreadContentRepo: Repository<UnreadContent>;
  let activityRepo: Repository<ActionActivity>;
  let communityRepo: Repository<Community>;
  let formRepo: Repository<Form>;
  let formResponseRepo: Repository<FormResponse>;
  let formVariantRepo: Repository<ActionFormVariant>;
  let formAssignmentRepo: Repository<ActionFormAssignment>;
  let shareUrlRepo: Repository<ShareUrl>;
  let outsiderToken: string;

  const createPublishedAction = async (
    name: string,
    options: {
      status?: ActionStatus;
      actionOverrides?: Partial<Action>;
    } = {},
  ) => {
    const action = await actionRepo.save(
      actionRepo.create({
        name,
        category: "Test",
        body: "Body copy",
        taskContents: "Task copy",
        shortDescription: `${name} short description`,
        visibilityMode: VisibilityMode.Public,
        cohortExpression: {
          type: "Tag",
          tagId: ctx.defaultTag.id,
        },
        ...options.actionOverrides,
      }),
    );

    const event = await eventRepo.save(
      eventRepo.create({
        title: `${name} launch`,
        description: "Action live",
        newStatus: options.status ?? ActionStatus.MemberAction,
        date: new Date(Date.now() - 1000),
        action,
      }),
    );

    return { action, event };
  };

  beforeAll(async () => {
    ctx = await createTestApp([]);
    actionRepo = ctx.dataSource.getRepository(Action);
    eventRepo = ctx.dataSource.getRepository(ActionEvent);
    userService = ctx.app.get(UserService);
    contractService = ctx.app.get(ContractService);
    staffPreviewService = ctx.app.get(StaffPreviewService);
    actionsService = ctx.app.get(ActionsService);
    userRepo = ctx.dataSource.getRepository(User);
    commentRepo = ctx.dataSource.getRepository(Comment);
    notifRepo = ctx.dataSource.getRepository(Notification);
    unreadContentRepo = ctx.dataSource.getRepository(UnreadContent);
    activityRepo = ctx.dataSource.getRepository(
      "ActionActivity",
    ) as Repository<ActionActivity>;
    communityRepo = ctx.dataSource.getRepository(
      "Community",
    ) as Repository<Community>;
    formRepo = ctx.dataSource.getRepository("Form") as Repository<Form>;
    formResponseRepo = ctx.dataSource.getRepository(
      "FormResponse",
    ) as Repository<FormResponse>;
    formVariantRepo = ctx.dataSource.getRepository(ActionFormVariant);
    formAssignmentRepo = ctx.dataSource.getRepository(ActionFormAssignment);
    shareUrlRepo = ctx.dataSource.getRepository(ShareUrl);

    // Create test action with MemberAction status
    testAction = actionRepo.create({
      name: "Test Action",
      category: "Test",
      body: "Test action for forum tests",
      taskContents: "Test action for forum tests",
      visibilityMode: VisibilityMode.Public,
      cohortExpression: {
        type: "Tag",
        tagId: ctx.defaultTag.id,
      },
    });

    testDraftAction = actionRepo.create({
      name: "Test Draft Action",
      category: "Test",
      body: "Test action for forum tests",
      visibilityMode: VisibilityMode.Public,
      cohortExpression: {
        type: "Tag",
        tagId: ctx.defaultTag.id,
      },
    });

    await actionRepo.save(testAction);
    await actionRepo.save(testDraftAction);

    // Create event to set status for testAction to MemberAction
    const gatheringEvent = eventRepo.create({
      title: "Action Started",
      description: "Action is now in gathering commitments phase",
      newStatus: ActionStatus.MemberAction,
      date: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      action: testAction,
    });
    await eventRepo.save(gatheringEvent);

    // testDraftAction has no events, so it defaults to Draft status

    const defaultUser = await userRepo.findOneOrFail({
      where: { id: ctx.testUserId },
    });
    await contractService.signContract({
      userId: defaultUser.id,
      signedName: "Test Name",
      contractId: ctx.defaultContractId,
    });

    const outsider = await userRepo.save(
      userRepo.create({
        email: "outsider@example.com",
        password: "pass",
        name: "Outsider",
      }),
    );

    outsiderToken = ctx.jwtService.sign(
      { sub: outsider.id, email: outsider.email, name: outsider.name },
      { secret: process.env.JWT_SECRET },
    );

    await createPublishedAction("Group Restricted Action", {
      status: ActionStatus.MemberAction,
      actionOverrides: {
        visibilityMode: VisibilityMode.Public,
        cohortExpression: {
          type: "Tag",
          tagId: ctx.defaultTag.id,
        },
      },
    });

    await createPublishedAction("Group Restricted Hidden Action", {
      status: ActionStatus.MemberAction,
      actionOverrides: {
        visibilityMode: VisibilityMode.ParticipatingGroups,
        cohortExpression: {
          type: "Tag",
          tagId: ctx.defaultTag.id,
        },
      },
    });
  }, 50000);

  describe("Actions", () => {
    it("admin can create a valid action", async () => {
      const newAction: CreateActionDto = {
        name: "Test Action",
        body: "Do something important",
        category: "category",
        image: "",
        timeEstimate: 5,
        shortDescription: "Do something important",
        visibilityMode: VisibilityMode.Public,
        type: ActionTaskType.Activity,
        isContractSigningAction: false,
        shouldCompleteAfterDeadline: false,
        isForumParticipationAction: false,
        optional: false,
        preventCompletion: false,
        publicOnly: false,
        staffPreview: false,
        onboarding: false,
      };

      const res = await request(ctx.app.getHttpServer())
        .post("/actions/create")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send(newAction);

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Test Action");

      await actionRepo.query("DELETE FROM action WHERE id = $1", [res.body.id]);
    });

    it("action creation with missing data rejected", async () => {
      const res = await request(ctx.app.getHttpServer())
        .post("/actions/create")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          name: "Test Action",
          description: "Do something important",
        });

      expect(res.status).toBe(400);
    });

    it("action creation with malformed cohortExpression rejected", async () => {
      const base: CreateActionDto = {
        name: "Bad Cohort Action",
        body: "Body",
        category: "category",
        image: "",
        timeEstimate: 5,
        shortDescription: "Short",
        visibilityMode: VisibilityMode.Public,
        type: ActionTaskType.Activity,
        isContractSigningAction: false,
        shouldCompleteAfterDeadline: false,
        isForumParticipationAction: false,
        optional: false,
        preventCompletion: false,
        publicOnly: false,
        staffPreview: false,
        onboarding: false,
      };

      const malformedExpressions = [
        // Tag condition missing its tagId
        { type: "Tag" },
        // unknown discriminator
        { type: "NotARealCondition", tagId: "x" },
        // operator with malformed child
        {
          type: "AND",
          children: [{ type: "Manual", userIds: ["not-a-number"] }],
        },
        // responseAny would shadow responseEqualTo
        {
          type: "FormFieldValue",
          formId: 1,
          fieldId: "f1",
          responseEqualTo: "yes",
          responseAny: true,
        },
      ];

      for (const cohortExpression of malformedExpressions) {
        const res = await request(ctx.app.getHttpServer())
          .post("/actions/create")
          .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
          .send({ ...base, cohortExpression });

        expect(res.status).toBe(400);
      }
    });

    it("explicit null cohortExpression clears a stored one", async () => {
      const createRes = await request(ctx.app.getHttpServer())
        .post("/actions/create")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          name: "Clearable Cohort Action",
          body: "Body",
          category: "category",
          image: "",
          timeEstimate: 5,
          shortDescription: "Short",
          visibilityMode: VisibilityMode.Public,
          type: ActionTaskType.Activity,
          isContractSigningAction: false,
          shouldCompleteAfterDeadline: false,
          isForumParticipationAction: false,
          optional: false,
          preventCompletion: false,
          publicOnly: false,
          staffPreview: false,
          onboarding: false,
          cohortExpression: { type: "Manual", userIds: [1] },
        } satisfies CreateActionDto & { cohortExpression: unknown });
      expect(createRes.status).toBe(201);
      const actionId = createRes.body.id as number;

      const updateRes = await request(ctx.app.getHttpServer())
        .patch(`/actions/${actionId}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ cohortExpression: null });
      expect(updateRes.status).toBe(200);

      const cleared = await actionRepo.findOneByOrFail({ id: actionId });
      expect(cleared.cohortExpression).toBeNull();

      // Omitting the field must leave the stored expression untouched.
      const restoreRes = await request(ctx.app.getHttpServer())
        .patch(`/actions/${actionId}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ cohortExpression: { type: "GroupLead" } });
      expect(restoreRes.status).toBe(200);
      const untouchedRes = await request(ctx.app.getHttpServer())
        .patch(`/actions/${actionId}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ name: "Clearable Cohort Action (renamed)" });
      expect(untouchedRes.status).toBe(200);
      const untouched = await actionRepo.findOneByOrFail({ id: actionId });
      expect(untouched.cohortExpression).toEqual({ type: "GroupLead" });
    });

    it("can fetch all actions with status", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get("/actions/loggedIn")
        .set("Authorization", `Bearer ${ctx.accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toHaveProperty("status");
    });

    it("can see completed actions for a user", async () => {
      const action = await actionRepo.findOneBy({ name: "Test Action" });

      await request(ctx.app.getHttpServer())
        .post(`/actions/complete/${action!.id}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(201);

      const res = await request(ctx.app.getHttpServer())
        .get(`/actions/completed/${ctx.testUserId}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
    });

    it("user cannot see draft actions", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get("/actions/loggedIn")
        .set("Authorization", `Bearer ${ctx.accessToken}`);

      expect(res.status).toBe(200);

      expect(
        res.body.some(
          (action: ActionDto) => action.status === ActionStatus.Draft,
        ),
      ).toBe(false);
    });

    it("admin can see draft actions", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get("/actions/all")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(
        res.body.some(
          (action: ActionDto) => action.status === ActionStatus.Draft,
        ),
      ).toBe(true);
    });

    it("unauthenticated user cannot access individual draft action", async () => {
      const res = await request(ctx.app.getHttpServer()).get(
        `/actions/slug/${testDraftAction.id}`,
      );

      expect(res.status).toBe(404);
    });

    it("authenticated non-admin user cannot access individual draft action", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get(`/actions/slug/${testDraftAction.id}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`);

      expect(res.status).toBe(404);
    });

    it("admin can access individual draft action", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get(`/actions/slug/${testDraftAction.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(ActionStatus.Draft);
      expect(res.body.name).toBe("Test Draft Action");
    });

    describe("staff preview", () => {
      let previewAction: Action;

      beforeAll(async () => {
        previewAction = await actionRepo.save(
          actionRepo.create({
            name: "Staff Preview Action",
            category: "Test",
            body: "Not live yet",
            visibilityMode: VisibilityMode.Public,
            cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
            staffPreview: true,
          }),
        );
      });

      beforeEach(async () => {
        await userRepo.update(ctx.testUserId, { staff: false });
      });

      afterAll(async () => {
        await userRepo.update(ctx.testUserId, { staff: false });
        await actionRepo.update(previewAction.id, { archived: true });
      });

      const fetchFeed = async () =>
        request(ctx.app.getHttpServer())
          .get("/actions/loggedIn")
          .set("Authorization", `Bearer ${ctx.accessToken}`);

      const createFlaggedLiveAction = async (): Promise<Action> => {
        const action = await actionRepo.save(
          actionRepo.create({
            name: "Flagged Live Action",
            category: "Test",
            body: "Already open",
            visibilityMode: VisibilityMode.Public,
            cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
            staffPreview: true,
          }),
        );
        await request(ctx.app.getHttpServer())
          .post(`/actions/${action.id}/events`)
          .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
          .send({
            title: "Members act",
            description: "Go",
            newStatus: ActionStatus.MemberAction,
            date: new Date(Date.now() - 1000).toISOString(),
          })
          .expect(201);
        return action;
      };

      it("hides the action from a member who is not staff", async () => {
        const res = await fetchFeed();
        expect(res.status).toBe(200);
        expect(res.body.some((a: ActionDto) => a.id === previewAction.id)).toBe(
          false,
        );
      });

      // The inventory of member-facing writes that name an action. One added
      // without a staff-preview guard is a missing row here rather than
      // recorded member data on an unlaunched action.
      describe("every member-facing write", () => {
        let target: Action;
        let commentId: number;
        let activityId: number;

        beforeAll(async () => {
          target = await actionRepo.save(
            actionRepo.create({
              name: "Preview Write Target",
              category: "Test",
              body: "Not live yet",
              visibilityMode: VisibilityMode.Public,
              cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
            }),
          );
          // Written before the flag went on, so there is something to like.
          const created = await request(ctx.app.getHttpServer())
            .post("/forum/comments")
            .set("Authorization", `Bearer ${ctx.accessToken}`)
            .send({
              parentObjectId: target.id,
              parentObjectType: CommentParentObject.Action,
              editableContent: { body: "Before the flag", attachments: [] },
            } satisfies CreateCommentDto)
            .expect(201);
          commentId = created.body.id;
          // Somebody else's, so the action carries an activity a comment can
          // name without the viewer having written anything on it.
          activityId = (
            await activityRepo.save(
              activityRepo.create({
                actionId: target.id,
                userId: ctx.adminUserId,
                type: ActionActivityType.USER_COMPLETED,
              }),
            )
          ).id;
          await actionRepo.update(target.id, { staffPreview: true });
        });

        afterAll(async () => {
          await actionRepo.update(target.id, { archived: true });
        });

        const noActivity = async () =>
          expect(
            await activityRepo.countBy({
              actionId: target.id,
              userId: ctx.testUserId,
            }),
          ).toBe(0);
        const noShareUrl = async () =>
          expect(
            await shareUrlRepo.countBy({ action: { id: target.id } }),
          ).toBe(0);

        const writes: {
          name: string;
          send: () => request.Test;
          nothingWritten: () => Promise<void>;
        }[] = [
          {
            name: "completion",
            send: () =>
              request(ctx.app.getHttpServer())
                .post(`/actions/complete/${target.id}`)
                .set("Authorization", `Bearer ${ctx.accessToken}`),
            nothingWritten: noActivity,
          },
          {
            name: "dismissal",
            send: () =>
              request(ctx.app.getHttpServer())
                .post(`/actions/dismiss/${target.id}`)
                .set("Authorization", `Bearer ${ctx.accessToken}`),
            nothingWritten: noActivity,
          },
          {
            name: "a share code",
            send: () =>
              request(ctx.app.getHttpServer())
                .post(`/actions/${target.id}/referralCode`)
                .set("Authorization", `Bearer ${ctx.accessToken}`),
            nothingWritten: noShareUrl,
          },
          {
            name: "a share link, the other route to the same share code",
            send: () =>
              request(ctx.app.getHttpServer())
                .post("/share-urls/get-share-link")
                .set("Authorization", `Bearer ${ctx.accessToken}`)
                .send({ actionId: target.id }),
            nothingWritten: noShareUrl,
          },
          {
            name: "a comment",
            send: () =>
              request(ctx.app.getHttpServer())
                .post("/forum/comments")
                .set("Authorization", `Bearer ${ctx.accessToken}`)
                .send({
                  parentObjectId: target.id,
                  parentObjectType: CommentParentObject.Action,
                  editableContent: {
                    body: "Fix this copy before launch",
                    attachments: [],
                  },
                } satisfies CreateCommentDto),
            nothingWritten: async () =>
              expect(
                await commentRepo.countBy({
                  parentObjectId: target.id,
                  parentObjectType: CommentParentObject.Action,
                }),
              ).toBe(1),
          },
          {
            name: "a comment on one of its activities",
            send: () =>
              request(ctx.app.getHttpServer())
                .post("/forum/comments")
                .set("Authorization", `Bearer ${ctx.accessToken}`)
                .send({
                  parentObjectId: activityId,
                  parentObjectType: CommentParentObject.Activity,
                  editableContent: {
                    body: "Nice work on this one",
                    attachments: [],
                  },
                } satisfies CreateCommentDto),
            nothingWritten: async () =>
              expect(
                await commentRepo.countBy({
                  parentObjectId: activityId,
                  parentObjectType: CommentParentObject.Activity,
                }),
              ).toBe(0),
          },
          {
            name: "a comment like",
            send: () =>
              request(ctx.app.getHttpServer())
                .post(`/forum/comments/${commentId}/like`)
                .set("Authorization", `Bearer ${ctx.accessToken}`),
            nothingWritten: async () => {
              const comment = await commentRepo.findOneOrFail({
                where: { id: commentId },
                relations: { likes: true },
              });
              expect(comment.likes).toHaveLength(0);
            },
          },
        ];

        for (const write of writes) {
          it(`refuses ${write.name} for staff`, async () => {
            await userRepo.update(ctx.testUserId, { staff: true });
            await write.send().expect(403);
            await write.nothingWritten();
          });

          it(`answers ${write.name} as not-found for a member`, async () => {
            await write.send().expect(404);
            await write.nothingWritten();
          });
        }

        // Off the list above, because none of them adds anything to the
        // discussion. Refusing them would strand what was written, or liked,
        // before the flag.
        it("keeps an author's edit, delete, and the like they take back", async () => {
          await actionRepo.update(target.id, { staffPreview: false });
          const own = await request(ctx.app.getHttpServer())
            .post("/forum/comments")
            .set("Authorization", `Bearer ${ctx.accessToken}`)
            .send({
              parentObjectId: target.id,
              parentObjectType: CommentParentObject.Action,
              editableContent: {
                body: "Mine, before the flag",
                attachments: [],
              },
            } satisfies CreateCommentDto)
            .expect(201);
          await request(ctx.app.getHttpServer())
            .post(`/forum/comments/${own.body.id}/like`)
            .set("Authorization", `Bearer ${ctx.accessToken}`)
            .expect(201);
          await actionRepo.update(target.id, { staffPreview: true });

          await request(ctx.app.getHttpServer())
            .patch(`/forum/comments/${own.body.id}`)
            .set("Authorization", `Bearer ${ctx.accessToken}`)
            .send({ editableContent: { body: "Rewritten", attachments: [] } })
            .expect(200);

          await userRepo.update(ctx.testUserId, { staff: true });
          await request(ctx.app.getHttpServer())
            .post(`/forum/comments/${own.body.id}/unlike`)
            .set("Authorization", `Bearer ${ctx.accessToken}`)
            .expect(201);
          expect(
            (
              await commentRepo.findOneOrFail({
                where: { id: own.body.id },
                relations: { likes: true },
              })
            ).likes,
          ).toHaveLength(0);

          await request(ctx.app.getHttpServer())
            .delete(`/forum/comments/${own.body.id}`)
            .set("Authorization", `Bearer ${ctx.accessToken}`)
            .expect(200);
          expect(
            (await commentRepo.findOneByOrFail({ id: own.body.id })).deleted,
          ).toBe(true);
        });
      });

      it("leaves the writes alone on an action members can already reach", async () => {
        const { action } = await createPublishedAction("Preview Over Live", {
          status: ActionStatus.OfficeAction,
        });
        const comment = () =>
          request(ctx.app.getHttpServer())
            .post("/forum/comments")
            .set("Authorization", `Bearer ${ctx.accessToken}`)
            .send({
              parentObjectId: action.id,
              parentObjectType: CommentParentObject.Action,
              editableContent: { body: "Still talking", attachments: [] },
            } satisfies CreateCommentDto);

        const readAction = async () =>
          (
            await request(ctx.app.getHttpServer())
              .get(`/actions/slug/${action.id}`)
              .set("Authorization", `Bearer ${ctx.accessToken}`)
              .expect(200)
          ).body as ActionDto;

        await comment().expect(201);
        expect((await readAction()).canParticipate).toBe(true);
        await actionRepo.update(action.id, { staffPreview: true });

        const feed = await fetchFeed();
        expect(feed.body.some((a: ActionDto) => a.id === action.id)).toBe(true);
        await comment().expect(201);

        const seen = await readAction();
        expect(seen.canParticipate).toBe(true);
        expect(seen.viewer).toMatchObject({
          preview: false,
          canComplete: true,
        });
        await request(ctx.app.getHttpServer())
          .post(`/actions/complete/${action.id}`)
          .set("Authorization", `Bearer ${ctx.accessToken}`)
          .expect(201);

        await actionRepo.update(action.id, { archived: true });
      });

      // The window is the launch, not the draft: an action members can already
      // read still previews for staff until its member action opens.
      it("keeps staff in the discussion where members can already reach the action", async () => {
        const { action } = await createPublishedAction(
          "Preview Over Published",
          {
            status: ActionStatus.OfficeAction,
          },
        );
        const activity = await activityRepo.save(
          activityRepo.create({
            actionId: action.id,
            userId: ctx.adminUserId,
            type: ActionActivityType.USER_COMPLETED,
          }),
        );
        await actionRepo.update(action.id, { staffPreview: true });
        await userRepo.update(ctx.testUserId, { staff: true });

        await request(ctx.app.getHttpServer())
          .post("/forum/comments")
          .set("Authorization", `Bearer ${ctx.accessToken}`)
          .send({
            parentObjectId: action.id,
            parentObjectType: CommentParentObject.Action,
            editableContent: { body: "Still talking", attachments: [] },
          } satisfies CreateCommentDto)
          .expect(201);
        await request(ctx.app.getHttpServer())
          .post(`/actions/likeActivity/${activity.id}`)
          .set("Authorization", `Bearer ${ctx.accessToken}`)
          .expect(201);

        await request(ctx.app.getHttpServer())
          .post(`/actions/${action.id}/referralCode`)
          .set("Authorization", `Bearer ${ctx.accessToken}`)
          .expect(403);
        await request(ctx.app.getHttpServer())
          .post(`/actions/complete/${action.id}`)
          .set("Authorization", `Bearer ${ctx.accessToken}`)
          .expect(403);
        expect(await shareUrlRepo.countBy({ action: { id: action.id } })).toBe(
          0,
        );
        expect(
          await activityRepo.countBy({
            actionId: action.id,
            userId: ctx.testUserId,
          }),
        ).toBe(0);

        const seen = (
          await request(ctx.app.getHttpServer())
            .get(`/actions/slug/${action.id}`)
            .set("Authorization", `Bearer ${ctx.accessToken}`)
            .expect(200)
        ).body as ActionDto;
        expect(seen.viewer).toMatchObject({
          preview: true,
          canComplete: false,
          discussionClosed: false,
        });
        const seenActivity = (
          await request(ctx.app.getHttpServer())
            .get(`/actions/activities/${activity.id}`)
            .set("Authorization", `Bearer ${ctx.accessToken}`)
            .expect(200)
        ).body as ActionActivityDto;
        expect(seenActivity.discussionClosed).toBe(false);

        await actionRepo.update(action.id, { archived: true });
      });

      it("refuses an admin write, rather than answering not-found", async () => {
        await request(ctx.app.getHttpServer())
          .post(`/actions/dismiss/${previewAction.id}`)
          .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
          .expect(403);
        expect(
          await activityRepo.countBy({
            actionId: previewAction.id,
            userId: ctx.adminUserId,
          }),
        ).toBe(0);
      });

      it("hands an admin their writes back once archiving retires it", async () => {
        const action = await actionRepo.save(
          actionRepo.create({
            name: "Archived Preview Action",
            category: "Test",
            body: "Abandoned before launch",
            visibilityMode: VisibilityMode.Public,
            cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
            staffPreview: true,
            archived: true,
          }),
        );

        await request(ctx.app.getHttpServer())
          .post(`/actions/dismiss/${action.id}`)
          .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
          .expect(201);
        expect(await activityRepo.countBy({ actionId: action.id })).toBe(1);

        // Staff are shown nothing on an archived preview either, so they read
        // it as the hidden action it is.
        await userRepo.update(ctx.testUserId, { staff: true });
        await request(ctx.app.getHttpServer())
          .post(`/actions/dismiss/${action.id}`)
          .set("Authorization", `Bearer ${ctx.accessToken}`)
          .expect(404);
        expect(await activityRepo.countBy({ actionId: action.id })).toBe(1);
      });

      it("refuses a like on an activity that predates the flag", async () => {
        const action = await actionRepo.save(
          actionRepo.create({
            name: "Liked Before The Flag",
            category: "Test",
            body: "Not live yet",
            visibilityMode: VisibilityMode.Public,
            cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
          }),
        );
        const activity = await activityRepo.save(
          activityRepo.create({
            actionId: action.id,
            userId: ctx.adminUserId,
            type: ActionActivityType.USER_COMPLETED,
          }),
        );
        await actionRepo.update(action.id, { staffPreview: true });

        const like = () =>
          request(ctx.app.getHttpServer())
            .post(`/actions/likeActivity/${activity.id}`)
            .set("Authorization", `Bearer ${ctx.accessToken}`);
        const noLikes = async () =>
          expect(
            (
              await activityRepo.findOneOrFail({
                where: { id: activity.id },
                relations: { likes: true },
              })
            ).likes,
          ).toHaveLength(0);

        await like().expect(404);
        await noLikes();

        await userRepo.update(ctx.testUserId, { staff: true });
        await like().expect(403);
        await noLikes();

        await actionRepo.update(action.id, { archived: true });
      });

      // Reachable by moving the member-action date back out, the same edit the
      // sweep exists to survive.
      it("hands back a like left before the flag, refusing a new one", async () => {
        const action = await actionRepo.save(
          actionRepo.create({
            name: "Liked While Live",
            category: "Test",
            body: "Back to a draft",
            visibilityMode: VisibilityMode.Public,
            cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
          }),
        );
        const activity = await activityRepo.save(
          activityRepo.create({
            actionId: action.id,
            userId: ctx.adminUserId,
            type: ActionActivityType.USER_COMPLETED,
          }),
        );
        await userRepo.update(ctx.testUserId, { staff: true });
        await activityRepo
          .createQueryBuilder()
          .relation("likes")
          .of(activity.id)
          .add(ctx.testUserId);
        await actionRepo.update(action.id, { staffPreview: true });

        const unliked = (
          await request(ctx.app.getHttpServer())
            .post(`/actions/unlikeActivity/${activity.id}`)
            .set("Authorization", `Bearer ${ctx.accessToken}`)
            .expect(201)
        ).body as ActionActivityDto;
        // What stops a client offering the like refused below.
        expect(unliked.discussionClosed).toBe(true);
        expect(
          (
            await activityRepo.findOneOrFail({
              where: { id: activity.id },
              relations: { likes: true },
            })
          ).likes,
        ).toHaveLength(0);

        await request(ctx.app.getHttpServer())
          .post(`/actions/likeActivity/${activity.id}`)
          .set("Authorization", `Bearer ${ctx.accessToken}`)
          .expect(403);

        await actionRepo.update(action.id, { archived: true });
      });

      // The refusal above only helps if the client knows not to offer the
      // write, and an activity reaches feeds that carry no action.
      it("closes the activity's discussion for staff, and for nobody else", async () => {
        const action = await actionRepo.save(
          actionRepo.create({
            name: "Marked Activity Action",
            category: "Test",
            body: "Not live yet",
            visibilityMode: VisibilityMode.Public,
            cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
            staffPreview: true,
          }),
        );
        const activity = await activityRepo.save(
          activityRepo.create({
            actionId: action.id,
            userId: ctx.adminUserId,
            type: ActionActivityType.USER_COMPLETED,
          }),
        );

        const readActivity = (status: number) =>
          request(ctx.app.getHttpServer())
            .get(`/actions/activities/${activity.id}`)
            .set("Authorization", `Bearer ${ctx.accessToken}`)
            .expect(status);

        // A member cannot reach an activity on an action they cannot see.
        await readActivity(404);
        await userRepo.update(ctx.testUserId, { staff: true });
        expect(
          ((await readActivity(200)).body as ActionActivityDto)
            .discussionClosed,
        ).toBe(true);

        await eventRepo.save(
          eventRepo.create({
            title: "Members act",
            description: "Go",
            newStatus: ActionStatus.MemberAction,
            date: new Date(Date.now() - 1000),
            action,
          }),
        );
        expect(
          ((await readActivity(200)).body as ActionActivityDto)
            .discussionClosed,
        ).toBe(false);

        await actionRepo.update(action.id, { archived: true });
      });

      it("reaches the timeline feed for its viewers and for nobody else", async () => {
        const action = await actionRepo.save(
          actionRepo.create({
            name: "Timeline Preview Action",
            category: "Test",
            body: "Not live yet",
            visibilityMode: VisibilityMode.Public,
            staffPreview: true,
          }),
        );
        // Latest event, so the feed's top-ten cut can't be what drops it.
        await eventRepo.save(
          eventRepo.create({
            title: "Office action",
            description: "Office working on it",
            newStatus: ActionStatus.OfficeAction,
            date: new Date(Date.now() + 24 * 60 * 60 * 1000),
            action,
          }),
        );

        const timelineNames = async (token?: string) => {
          const req = request(ctx.app.getHttpServer()).get(
            "/actions/timeline-feed",
          );
          if (token) req.set("Authorization", `Bearer ${token}`);
          return (await req.expect(200)).body.map(
            (item: { action: ActionDto }) => item.action.name,
          );
        };

        expect(await timelineNames()).not.toContain(action.name);
        expect(await timelineNames(ctx.accessToken)).not.toContain(action.name);

        await userRepo.update(ctx.testUserId, { staff: true });
        expect(await timelineNames(ctx.accessToken)).toContain(action.name);

        await actionRepo.update(action.id, { staffPreview: false });
        expect(await timelineNames(ctx.accessToken)).not.toContain(action.name);

        await actionRepo.update(action.id, { archived: true });
      });

      // Public-only skips the member gate on the way in, so it has to skip the
      // matching not-found on the way out. Otherwise the flag takes a write the
      // public already had, on a page that still loads for them.
      it("leaves a public-only action public, flag and all", async () => {
        const publicAction = await actionRepo.save(
          actionRepo.create({
            name: "Public Preview Action",
            category: "Test",
            body: "Not live yet",
            visibilityMode: VisibilityMode.Public,
            publicOnly: true,
            type: ActionTaskType.Funding,
            donationAmount: 500,
            staffPreview: true,
          }),
        );
        const guestDonation = () =>
          actionsService.getPaymentAmountForAction({
            actionId: publicAction.id,
          });

        await request(ctx.app.getHttpServer())
          .get(`/actions/slug/${publicAction.id}`)
          .expect(200);
        expect(await guestDonation()).toBe(500);

        await actionRepo.update(publicAction.id, { staffPreview: false });
        await request(ctx.app.getHttpServer())
          .get(`/actions/slug/${publicAction.id}`)
          .expect(200);
        expect(await guestDonation()).toBe(500);

        await actionRepo.update(publicAction.id, { archived: true });
      });

      it("hands staff a todo they cannot complete", async () => {
        await userRepo.update(ctx.testUserId, { staff: true });

        const res = await fetchFeed();
        const action = res.body.find(
          (a: ActionDto) => a.id === previewAction.id,
        );
        expect(action).toBeDefined();
        expect(action.viewer).toMatchObject({
          preview: true,
          canComplete: false,
          memberActionStarted: false,
        });
      });

      it("previews a planned action, the state most reach the flag in", async () => {
        const action = await actionRepo.save(
          actionRepo.create({
            name: "Preview Over Planned",
            category: "Test",
            body: "Announced, not open",
            visibilityMode: VisibilityMode.Public,
            cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
            staffPreview: true,
          }),
        );
        await eventRepo.save([
          eventRepo.create({
            title: "Announced",
            description: "Last month",
            newStatus: ActionStatus.Planned,
            date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            action,
          }),
          eventRepo.create({
            title: "Members act",
            description: "Next week",
            newStatus: ActionStatus.MemberAction,
            date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            action,
          }),
        ]);

        await userRepo.update(ctx.testUserId, { staff: true });
        const previewed = (await fetchFeed()).body.find(
          (a: ActionDto) => a.id === action.id,
        );
        expect(previewed.viewer).toMatchObject({
          preview: true,
          canComplete: false,
        });

        await userRepo.update(ctx.testUserId, { staff: false });
        const seen = (await fetchFeed()).body.find(
          (a: ActionDto) => a.id === action.id,
        );
        expect(seen.viewer).toMatchObject({ preview: false });
        await request(ctx.app.getHttpServer())
          .post("/forum/comments")
          .set("Authorization", `Bearer ${ctx.accessToken}`)
          .send({
            parentObjectId: action.id,
            parentObjectType: CommentParentObject.Action,
            editableContent: { body: "Looking forward", attachments: [] },
          } satisfies CreateCommentDto)
          .expect(201);

        await actionRepo.update(action.id, { archived: true });
      });

      it("opens the action page for staff, flagged as a preview", async () => {
        await userRepo.update(ctx.testUserId, { staff: true });

        const res = await request(ctx.app.getHttpServer())
          .get(`/actions/slug/${previewAction.id}`)
          .set("Authorization", `Bearer ${ctx.accessToken}`)
          .expect(200);
        expect(res.body.viewer).toMatchObject({
          preview: true,
          canComplete: false,
        });
      });

      it("refuses the donation amount, masking the preview from a guest", async () => {
        await expect(
          actionsService.getPaymentAmountForAction({
            actionId: previewAction.id,
          }),
        ).rejects.toMatchObject({ status: 404 });

        await userRepo.update(ctx.testUserId, { staff: true });
        await expect(
          actionsService.getPaymentAmountForAction({
            actionId: previewAction.id,
            userId: ctx.testUserId,
          }),
        ).rejects.toMatchObject({ status: 403 });
      });

      it("answers a non-staff member as if the action were not there", async () => {
        const notFound = await request(ctx.app.getHttpServer())
          .get(`/actions/slug/${previewAction.id}`)
          .set("Authorization", `Bearer ${ctx.accessToken}`)
          .expect(404);

        // Same answer from the writes, so no member can tell a preview from an
        // action that does not exist.
        const commentRes = await request(ctx.app.getHttpServer())
          .post("/forum/comments")
          .set("Authorization", `Bearer ${ctx.accessToken}`)
          .send({
            parentObjectId: previewAction.id,
            parentObjectType: CommentParentObject.Action,
            editableContent: { body: "Can I see this?", attachments: [] },
          } satisfies CreateCommentDto)
          .expect(404);
        expect(commentRes.body.message).toBe(notFound.body.message);
      });

      it("answers alike for a preview and for an action that is not there", async () => {
        const missingId = previewAction.id + 100000;

        const missing = await request(ctx.app.getHttpServer())
          .post("/forum/comments")
          .set("Authorization", `Bearer ${ctx.accessToken}`)
          .send({
            parentObjectId: missingId,
            parentObjectType: CommentParentObject.Action,
            editableContent: { body: "Is this one real?", attachments: [] },
          } satisfies CreateCommentDto)
          .expect(404);

        const preview = await request(ctx.app.getHttpServer())
          .post("/forum/comments")
          .set("Authorization", `Bearer ${ctx.accessToken}`)
          .send({
            parentObjectId: previewAction.id,
            parentObjectType: CommentParentObject.Action,
            editableContent: { body: "Is this one real?", attachments: [] },
          } satisfies CreateCommentDto)
          .expect(404);

        expect(preview.body.message).toBe(missing.body.message);
        expect(await commentRepo.countBy({ parentObjectId: missingId })).toBe(
          0,
        );
      });

      it("hands staff the control arm, assigning no form variant", async () => {
        await userRepo.update(ctx.testUserId, { staff: true });
        const { form: controlForm } = await createFormWithSnapshot(
          ctx.dataSource,
          { title: "Preview Control Form", schema: { title: "c", pages: [] } },
        );
        const { form: variantForm } = await createFormWithSnapshot(
          ctx.dataSource,
          { title: "Preview Variant Form", schema: { title: "v", pages: [] } },
        );
        const action = await actionRepo.save(
          actionRepo.create({
            name: "Variant Preview Action",
            category: "Test",
            body: "Not live yet",
            visibilityMode: VisibilityMode.Public,
            cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
            taskFormId: controlForm.id,
            staffPreview: true,
          }),
        );
        // Everyone who gets assigned lands on the variant, so an assignment
        // would be visible as a changed taskFormId rather than a coin flip.
        await formVariantRepo.save(
          formVariantRepo.create({
            actionId: action.id,
            formId: variantForm.id,
            name: "Variant",
            splitValue: 1,
          }),
        );

        const previewed = (await fetchFeed()).body.find(
          (a: ActionDto) => a.id === action.id,
        );
        expect(previewed.taskFormId).toBe(controlForm.id);
        expect(
          await formAssignmentRepo.countBy({
            actionId: action.id,
            userId: ctx.testUserId,
          }),
        ).toBe(0);

        await request(ctx.app.getHttpServer())
          .post(`/actions/${action.id}/events`)
          .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
          .send({
            title: "Members act",
            description: "Go",
            newStatus: ActionStatus.MemberAction,
            date: new Date(Date.now() - 1000).toISOString(),
          })
          .expect(201);

        const live = (await fetchFeed()).body.find(
          (a: ActionDto) => a.id === action.id,
        );
        expect(live.taskFormId).toBe(variantForm.id);

        await actionRepo.update(action.id, { archived: true });
      });

      it("assigns a member their variant on an action the preview only shadows", async () => {
        const { form: controlForm } = await createFormWithSnapshot(
          ctx.dataSource,
          { title: "Shadowed Control", schema: { title: "c", pages: [] } },
        );
        const { form: variantForm } = await createFormWithSnapshot(
          ctx.dataSource,
          { title: "Shadowed Variant", schema: { title: "v", pages: [] } },
        );
        const action = await actionRepo.save(
          actionRepo.create({
            name: "Shadowed Variant Action",
            category: "Test",
            body: "Office is on it",
            visibilityMode: VisibilityMode.Public,
            taskFormId: controlForm.id,
            staffPreview: true,
          }),
        );
        // Past office action, so the member reads it whether or not the flag
        // is on, and the preview is not what put it in front of them.
        await eventRepo.save(
          eventRepo.create({
            title: "Office action",
            description: "Office working on it",
            newStatus: ActionStatus.OfficeAction,
            date: new Date(Date.now() - 1000),
            action,
          }),
        );
        await formVariantRepo.save(
          formVariantRepo.create({
            actionId: action.id,
            formId: variantForm.id,
            name: "Variant",
            splitValue: 1,
          }),
        );

        const seen = (await fetchFeed()).body.find(
          (a: ActionDto) => a.id === action.id,
        );
        expect(seen.taskFormId).toBe(variantForm.id);
        expect(
          await formAssignmentRepo.countBy({
            actionId: action.id,
            userId: ctx.testUserId,
          }),
        ).toBe(1);

        await actionRepo.update(action.id, { archived: true });
      });

      it("turns inert once the member action opens, flag still on", async () => {
        const openAction = await createFlaggedLiveAction();

        const res = await fetchFeed();
        const action = res.body.find((a: ActionDto) => a.id === openAction.id);
        expect(action).toBeDefined();
        expect(action.viewer).toMatchObject({
          preview: false,
          canComplete: true,
        });

        await request(ctx.app.getHttpServer())
          .post(`/actions/${openAction.id}/referralCode`)
          .set("Authorization", `Bearer ${ctx.accessToken}`)
          .expect(201);

        await request(ctx.app.getHttpServer())
          .post("/forum/comments")
          .set("Authorization", `Bearer ${ctx.accessToken}`)
          .send({
            parentObjectId: openAction.id,
            parentObjectType: CommentParentObject.Action,
            editableContent: { body: "Nice one", attachments: [] },
          } satisfies CreateCommentDto)
          .expect(201);

        await request(ctx.app.getHttpServer())
          .post(`/actions/complete/${openAction.id}`)
          .set("Authorization", `Bearer ${ctx.accessToken}`)
          .expect(201);

        expect(
          (await actionRepo.findOneByOrFail({ id: openAction.id }))
            .staffPreview,
        ).toBe(true);

        await actionRepo.update(openAction.id, { archived: true });
      });

      it("spends the flag once the member action opens, so it cannot re-arm", async () => {
        const openAction = await createFlaggedLiveAction();

        await staffPreviewService.clearOpenedPreviews();

        expect(
          (await actionRepo.findOneByOrFail({ id: openAction.id }))
            .staffPreview,
        ).toBe(false);
        expect(
          (await actionRepo.findOneByOrFail({ id: previewAction.id }))
            .staffPreview,
        ).toBe(true);

        await actionRepo.update(openAction.id, { archived: true });
      });

      it("takes the flag through the admin API, changing nothing once live", async () => {
        await userRepo.update(ctx.testUserId, { staff: true });
        const openAction = await createFlaggedLiveAction();

        // Saving the flag the sweep has not lowered yet is not arming it.
        await request(ctx.app.getHttpServer())
          .patch(`/actions/${openAction.id}`)
          .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
          .send({ staffPreview: true, body: "Already open, edited" })
          .expect(200);

        const res = await fetchFeed();
        const action = res.body.find((a: ActionDto) => a.id === openAction.id);
        expect(action).toBeDefined();
        expect(action.viewer.preview).toBe(false);

        await actionRepo.update(openAction.id, { archived: true });
      });

      it("saves a flag raised after the member action opens as lowered", async () => {
        const openAction = await createFlaggedLiveAction();
        await request(ctx.app.getHttpServer())
          .patch(`/actions/${openAction.id}`)
          .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
          .send({ staffPreview: false })
          .expect(200);

        // What a form loaded before the launch sends, whether or not the sweep
        // has run. The edit beside the flag still lands.
        await request(ctx.app.getHttpServer())
          .patch(`/actions/${openAction.id}`)
          .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
          .send({ staffPreview: true, body: "Already open, edited" })
          .expect(200);
        const saved = await actionRepo.findOneByOrFail({ id: openAction.id });
        expect(saved.staffPreview).toBe(false);
        expect(saved.body).toBe("Already open, edited");

        await actionRepo.update(openAction.id, { archived: true });
      });
    });

    it("shows actions to outsider if showToNonparticipating is true", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get("/actions/loggedIn")
        .set("Authorization", `Bearer ${outsiderToken}`);

      expect(res.status).toBe(200);
      expect(
        res.body.some(
          (action: ActionDto) => action.name === "Group Restricted Action",
        ),
      ).toBe(true);
    });

    it("does not show actions to non-participating groups if showToNonparticipating is false", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get("/actions/loggedIn")
        .set("Authorization", `Bearer ${outsiderToken}`);

      expect(res.status).toBe(200);
      expect(
        res.body.some(
          (action: ActionDto) =>
            action.name === "Group Restricted Hidden Action",
        ),
      ).toBe(false);
    });

    it("returns canParticipate=true for manual cohort members and false otherwise", async () => {
      const cohortMember = await userService.create({
        email: `cohort-${Date.now()}@example.com`,
        password: "Password123!",
        name: "Cohort Member",
      });

      const nonCohortUser = await userService.create({
        email: `noncohort-${Date.now()}@example.com`,
        password: "Password123!",
        name: "Non Cohort User",
      });

      const manualAction = await actionRepo.save(
        actionRepo.create({
          name: `Manual Cohort Action ${Date.now()}`,
          category: "Test",
          body: "Manual cohort body",
          shortDescription: "Manual cohort short description",
          taskContents: "Manual cohort task",
          visibilityMode: VisibilityMode.Public,
          preventCompletion: false,
          onboarding: true,
          type: ActionTaskType.Activity,
          cohortExpression: {
            type: "Manual",
            userIds: [cohortMember.id],
          },
        }),
      );

      const manualActionEvent = await eventRepo.save(
        eventRepo.create({
          title: "Manual cohort launch",
          description: "Manual cohort action live",
          newStatus: ActionStatus.MemberAction,
          date: new Date(Date.now() - 1000),
          action: manualAction,
        }),
      );

      const cohortToken = ctx.jwtService.sign(
        {
          sub: cohortMember.id,
          email: cohortMember.email,
          name: cohortMember.name,
        },
        { secret: process.env.JWT_SECRET },
      );

      const nonCohortToken = ctx.jwtService.sign(
        {
          sub: nonCohortUser.id,
          email: nonCohortUser.email,
          name: nonCohortUser.name,
        },
        { secret: process.env.JWT_SECRET },
      );

      const [cohortRes, nonCohortRes] = await Promise.all([
        request(ctx.app.getHttpServer())
          .get("/actions/loggedIn")
          .set("Authorization", `Bearer ${cohortToken}`)
          .expect(200),
        request(ctx.app.getHttpServer())
          .get("/actions/loggedIn")
          .set("Authorization", `Bearer ${nonCohortToken}`)
          .expect(200),
      ]);

      const findManualAction = (res: request.Response) =>
        res.body.find((action: ActionDto) => action.id === manualAction.id);

      const cohortAction = findManualAction(cohortRes);
      const nonCohortAction = findManualAction(nonCohortRes);

      expect(cohortAction).toBeDefined();
      expect(cohortAction.canParticipate).toBe(true);
      expect(cohortAction.shouldParticipate).toBe(true);
      expect(nonCohortAction).toBeDefined();
      expect(nonCohortAction.canParticipate).toBe(false);
      expect(nonCohortAction.shouldParticipate).toBe(false);

      await eventRepo.delete(manualActionEvent.id);
      await actionRepo.delete(manualAction.id);
      await userRepo.delete(cohortMember.id);
      await userRepo.delete(nonCohortUser.id);
    });

    it("populates shouldParticipate and awayStatus on the single-action endpoint", async () => {
      const cohortMember = await userService.create({
        email: `single-cohort-${Date.now()}@example.com`,
        password: "Password123!",
        name: "Single Cohort Member",
      });

      const nonCohortUser = await userService.create({
        email: `single-noncohort-${Date.now()}@example.com`,
        password: "Password123!",
        name: "Single Non Cohort User",
      });

      const awayMember = await userService.create({
        email: `single-away-${Date.now()}@example.com`,
        password: "Password123!",
        name: "Single Away Member",
      });
      await ctx.dataSource.getRepository(UserAwayRange).save({
        userId: awayMember.id,
        startDate: new Date(Date.now() - 60 * 60 * 1000),
        endDate: new Date(Date.now() + 60 * 60 * 1000),
        reason: UserAwayRangeReason.VACATION,
      });

      const manualAction = await actionRepo.save(
        actionRepo.create({
          name: `Single Manual Cohort Action ${Date.now()}`,
          category: "Test",
          body: "Manual cohort body",
          shortDescription: "Manual cohort short description",
          taskContents: "Manual cohort task",
          visibilityMode: VisibilityMode.Public,
          preventCompletion: false,
          onboarding: true,
          type: ActionTaskType.Activity,
          cohortExpression: {
            type: "Manual",
            userIds: [cohortMember.id, awayMember.id],
          },
        }),
      );

      const manualActionEvent = await eventRepo.save(
        eventRepo.create({
          title: "Manual cohort launch",
          description: "Manual cohort action live",
          newStatus: ActionStatus.MemberAction,
          date: new Date(Date.now() - 1000),
          action: manualAction,
        }),
      );

      const signToken = (user: { id: number; email: string; name: string }) =>
        ctx.jwtService.sign(
          { sub: user.id, email: user.email, name: user.name },
          { secret: process.env.JWT_SECRET },
        );

      const [cohortRes, nonCohortRes, awayRes] = await Promise.all([
        request(ctx.app.getHttpServer())
          .get(`/actions/slug/${manualAction.id}`)
          .set("Authorization", `Bearer ${signToken(cohortMember)}`)
          .expect(200),
        request(ctx.app.getHttpServer())
          .get(`/actions/slug/${manualAction.id}`)
          .set("Authorization", `Bearer ${signToken(nonCohortUser)}`)
          .expect(200),
        request(ctx.app.getHttpServer())
          .get(`/actions/slug/${manualAction.id}`)
          .set("Authorization", `Bearer ${signToken(awayMember)}`)
          .expect(200),
      ]);

      expect(cohortRes.body.shouldParticipate).toBe(true);
      expect(cohortRes.body.canParticipate).toBe(true);
      expect(cohortRes.body.awayStatus).toBe("not_away");
      expect(nonCohortRes.body.shouldParticipate).toBe(false);
      expect(nonCohortRes.body.canParticipate).toBe(false);
      expect(nonCohortRes.body.awayStatus).toBe("not_away");

      expect(cohortRes.body.viewer).toMatchObject({
        assigned: true,
        canComplete: true,
        relation: "none",
        dismissed: false,
        away: "not_away",
        deadlinePassed: false,
        display: "todo",
      });
      expect(nonCohortRes.body.viewer).toMatchObject({
        assigned: false,
        canComplete: false,
        display: "not_required",
      });
      // Away is an overlay, not part of assignment: the away member is still
      // assigned, and their away range must surface as away_currently (this
      // fails if the user fetch drops the awayRanges relation).
      expect(awayRes.body.shouldParticipate).toBe(true);
      expect(awayRes.body.awayStatus).toBe("away_currently");

      await eventRepo.delete(manualActionEvent.id);
      await actionRepo.delete(manualAction.id);
      await userRepo.delete(cohortMember.id);
      await userRepo.delete(nonCohortUser.id);
      await userRepo.delete(awayMember.id);
    });

    it("keeps canParticipate and viewer.canComplete consistent before the member-action phase is scheduled", async () => {
      const cohortMember = await userService.create({
        email: `phaseless-${Date.now()}@example.com`,
        password: "Password123!",
        name: "Phaseless Cohort Member",
      });

      const plannedAction = await actionRepo.save(
        actionRepo.create({
          name: `Phaseless Action ${Date.now()}`,
          category: "Test",
          body: "Phaseless body",
          shortDescription: "Phaseless short description",
          taskContents: "Phaseless task",
          visibilityMode: VisibilityMode.Public,
          preventCompletion: false,
          onboarding: false,
          type: ActionTaskType.Activity,
          cohortExpression: {
            type: "Manual",
            userIds: [cohortMember.id],
          },
        }),
      );

      const plannedEvent = await eventRepo.save(
        eventRepo.create({
          title: "Planned",
          description: "Member action not scheduled yet",
          newStatus: ActionStatus.Planned,
          date: new Date(Date.now() - 1000),
          action: plannedAction,
        }),
      );

      const token = ctx.jwtService.sign(
        {
          sub: cohortMember.id,
          email: cohortMember.email,
          name: cohortMember.name,
        },
        { secret: process.env.JWT_SECRET },
      );

      const res = await request(ctx.app.getHttpServer())
        .get(`/actions/slug/${plannedAction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      // The completion rule has no phase gate; the legacy field and the
      // viewer field must agree even before the member-action phase exists.
      expect(res.body.canParticipate).toBe(true);
      expect(res.body.viewer.canComplete).toBe(true);
      expect(res.body.viewer.assigned).toBe(false);
      expect(res.body.shouldParticipate).toBe(false);

      await eventRepo.delete(plannedEvent.id);
      await actionRepo.delete(plannedAction.id);
      await userRepo.delete(cohortMember.id);
    });

    it("evaluates CompletedAction cohort expression against real activity data", async () => {
      // Create a prerequisite action that users will "complete"
      const prerequisiteAction = await actionRepo.save(
        actionRepo.create({
          name: `Prerequisite Action ${Date.now()}`,
          category: "Test",
          body: "Prerequisite body",
          taskContents: "Prerequisite task",
          visibilityMode: VisibilityMode.Public,
        }),
      );

      const completedUser = await userService.create({
        email: `completed-${Date.now()}@example.com`,
        password: "Password123!",
        name: "Completed User",
      });

      const incompleteUser = await userService.create({
        email: `incomplete-${Date.now()}@example.com`,
        password: "Password123!",
        name: "Incomplete User",
      });

      // Create activity records: completedUser completed the prerequisite
      await activityRepo.save(
        activityRepo.create({
          userId: completedUser.id,
          actionId: prerequisiteAction.id,
          type: ActionActivityType.USER_COMPLETED,
        }),
      );
      // incompleteUser has no activity (has not completed the prerequisite)

      // Create action with CompletedAction cohort expression
      const targetAction = await actionRepo.save(
        actionRepo.create({
          name: `CompletedAction Cohort ${Date.now()}`,
          category: "Test",
          body: "Body",
          taskContents: "Task",
          visibilityMode: VisibilityMode.Public,
          preventCompletion: false,
          onboarding: true,
          type: ActionTaskType.Activity,
          cohortExpression: {
            type: "CompletedAction",
            actionId: prerequisiteAction.id,
          },
        }),
      );

      const targetEvent = await eventRepo.save(
        eventRepo.create({
          title: "Launch",
          description: "Go",
          newStatus: ActionStatus.MemberAction,
          date: new Date(Date.now() - 1000),
          action: targetAction,
        }),
      );

      const completedToken = ctx.jwtService.sign(
        {
          sub: completedUser.id,
          email: completedUser.email,
          name: completedUser.name,
        },
        { secret: process.env.JWT_SECRET },
      );
      const incompleteToken = ctx.jwtService.sign(
        {
          sub: incompleteUser.id,
          email: incompleteUser.email,
          name: incompleteUser.name,
        },
        { secret: process.env.JWT_SECRET },
      );

      const [completedRes, incompleteRes] = await Promise.all([
        request(ctx.app.getHttpServer())
          .get("/actions/loggedIn")
          .set("Authorization", `Bearer ${completedToken}`)
          .expect(200),
        request(ctx.app.getHttpServer())
          .get("/actions/loggedIn")
          .set("Authorization", `Bearer ${incompleteToken}`)
          .expect(200),
      ]);

      const findTarget = (res: request.Response) =>
        res.body.find((a: ActionDto) => a.id === targetAction.id);

      expect(findTarget(completedRes)?.canParticipate).toBe(true);
      expect(findTarget(completedRes)?.shouldParticipate).toBe(true);
      expect(findTarget(incompleteRes)?.canParticipate).toBe(false);
      expect(findTarget(incompleteRes)?.shouldParticipate).toBe(false);

      // Cleanup
      await activityRepo.delete({ actionId: prerequisiteAction.id });
      await eventRepo.delete(targetEvent.id);
      await actionRepo.delete(targetAction.id);
      await actionRepo.delete(prerequisiteAction.id);
      await userRepo.delete(completedUser.id);
      await userRepo.delete(incompleteUser.id);
    });

    it("evaluates InProgressAction cohort expression against real activity data", async () => {
      const prerequisiteAction = await actionRepo.save(
        actionRepo.create({
          name: `InProgress Prereq ${Date.now()}`,
          category: "Test",
          body: "Body",
          taskContents: "Task",
          visibilityMode: VisibilityMode.Public,
          cohortExpression: {
            type: "Tag",
            tagId: ctx.defaultTag.id,
          },
        }),
      );
      await eventRepo.save(
        eventRepo.create({
          title: "Prerequisite Launch",
          description: "Prerequisite",
          newStatus: ActionStatus.MemberAction,
          date: new Date(Date.now() - 1000),
          action: prerequisiteAction,
        }),
      );

      const inProgressUser = await userService.create({
        email: `inprogress-${Date.now()}@example.com`,
        password: "Password123!",
        name: "In Progress User",
        tags: [ctx.defaultTag],
      });

      const doneUser = await userService.create({
        email: `done-${Date.now()}@example.com`,
        password: "Password123!",
        name: "Done User",
        tags: [ctx.defaultTag],
      });

      const neverJoinedUser = await userService.create({
        email: `neverjoined-${Date.now()}@example.com`,
        password: "Password123!",
        name: "Never Joined User",
      });

      // inProgressUser is in the cohort (has defaultTag) but has NOT completed
      // (no activity record needed - being in cohort without completion = in progress)

      // doneUser completed the prerequisite
      await activityRepo.save(
        activityRepo.create({
          userId: doneUser.id,
          actionId: prerequisiteAction.id,
          type: ActionActivityType.USER_COMPLETED,
        }),
      );

      const targetAction = await actionRepo.save(
        actionRepo.create({
          name: `InProgressAction Cohort ${Date.now()}`,
          category: "Test",
          body: "Body",
          taskContents: "Task",
          visibilityMode: VisibilityMode.Public,
          preventCompletion: false,
          onboarding: true,
          type: ActionTaskType.Activity,
          cohortExpression: {
            type: "InProgressAction",
            actionId: prerequisiteAction.id,
          },
        }),
      );

      const targetEvent = await eventRepo.save(
        eventRepo.create({
          title: "Launch",
          description: "Go",
          newStatus: ActionStatus.MemberAction,
          date: new Date(Date.now() - 1000),
          action: targetAction,
        }),
      );

      const makeToken = (u: User) =>
        ctx.jwtService.sign(
          { sub: u.id, email: u.email, name: u.name },
          { secret: process.env.JWT_SECRET },
        );

      const [inProgressRes, doneRes, neverJoinedRes] = await Promise.all([
        request(ctx.app.getHttpServer())
          .get("/actions/loggedIn")
          .set("Authorization", `Bearer ${makeToken(inProgressUser)}`)
          .expect(200),
        request(ctx.app.getHttpServer())
          .get("/actions/loggedIn")
          .set("Authorization", `Bearer ${makeToken(doneUser)}`)
          .expect(200),
        request(ctx.app.getHttpServer())
          .get("/actions/loggedIn")
          .set("Authorization", `Bearer ${makeToken(neverJoinedUser)}`)
          .expect(200),
      ]);

      const findTarget = (res: request.Response) =>
        res.body.find((a: ActionDto) => a.id === targetAction.id);

      // In-progress user should be in cohort
      expect(findTarget(inProgressRes)?.canParticipate).toBe(true);
      expect(findTarget(inProgressRes)?.shouldParticipate).toBe(true);
      // Completed user should NOT be in cohort (no longer in progress)
      expect(findTarget(doneRes)?.canParticipate).toBe(false);
      // Never joined user should NOT be in cohort
      expect(findTarget(neverJoinedRes)?.canParticipate).toBe(false);

      // Cleanup
      await activityRepo.delete({ actionId: prerequisiteAction.id });
      await eventRepo.delete(targetEvent.id);
      await actionRepo.delete(targetAction.id);
      await actionRepo.delete(prerequisiteAction.id);
      await userRepo.delete(inProgressUser.id);
      await userRepo.delete(doneUser.id);
      await userRepo.delete(neverJoinedUser.id);
    });

    it("evaluates GroupLead cohort expression against real community data", async () => {
      const leaderUser = await userService.create({
        email: `leader-${Date.now()}@example.com`,
        password: "Password123!",
        name: "Leader User",
      });

      const nonLeaderUser = await userService.create({
        email: `nonleader-${Date.now()}@example.com`,
        password: "Password123!",
        name: "Non Leader User",
      });

      const community = await communityRepo.save(
        communityRepo.create({
          name: `Cohort Test Community ${Date.now()}`,
          leaders: [leaderUser],
          users: [leaderUser, nonLeaderUser],
        }),
      );

      const targetAction = await actionRepo.save(
        actionRepo.create({
          name: `GroupLead Cohort ${Date.now()}`,
          category: "Test",
          body: "Body",
          taskContents: "Task",
          visibilityMode: VisibilityMode.Public,
          preventCompletion: false,
          onboarding: true,
          type: ActionTaskType.Activity,
          cohortExpression: {
            type: "GroupLead",
          },
        }),
      );

      const targetEvent = await eventRepo.save(
        eventRepo.create({
          title: "Launch",
          description: "Go",
          newStatus: ActionStatus.MemberAction,
          date: new Date(Date.now() - 1000),
          action: targetAction,
        }),
      );

      const makeToken = (u: User) =>
        ctx.jwtService.sign(
          { sub: u.id, email: u.email, name: u.name },
          { secret: process.env.JWT_SECRET },
        );

      const [leaderRes, nonLeaderRes] = await Promise.all([
        request(ctx.app.getHttpServer())
          .get("/actions/loggedIn")
          .set("Authorization", `Bearer ${makeToken(leaderUser)}`)
          .expect(200),
        request(ctx.app.getHttpServer())
          .get("/actions/loggedIn")
          .set("Authorization", `Bearer ${makeToken(nonLeaderUser)}`)
          .expect(200),
      ]);

      const findTarget = (res: request.Response) =>
        res.body.find((a: ActionDto) => a.id === targetAction.id);

      expect(findTarget(leaderRes)?.canParticipate).toBe(true);
      expect(findTarget(leaderRes)?.shouldParticipate).toBe(true);
      expect(findTarget(nonLeaderRes)?.canParticipate).toBe(false);
      expect(findTarget(nonLeaderRes)?.shouldParticipate).toBe(false);

      // Cleanup
      await communityRepo.delete(community.id);
      await eventRepo.delete(targetEvent.id);
      await actionRepo.delete(targetAction.id);
      await userRepo.delete(leaderUser.id);
      await userRepo.delete(nonLeaderUser.id);
    });

    it("splits members into US and non-US by city, falling back to time zone", async () => {
      const cityRepo = ctx.dataSource.getRepository(City);
      const recipientService = ctx.app.get(ActionEventRecipientService);
      const stamp = Date.now();

      const [usCity, frenchCity] = await cityRepo.save([
        cityRepo.create({
          id: 900001,
          name: "Springfield",
          asciiName: "Springfield",
          englishName: null,
          admin1: "IL",
          admin2: "Sangamon",
          countryCode: "US",
          countryName: "United States",
          latitude: 39.8,
          longitude: -89.6,
        }),
        cityRepo.create({
          id: 900002,
          name: "Lyon",
          asciiName: "Lyon",
          englishName: null,
          admin1: "ARA",
          admin2: "Rhone",
          countryCode: "FR",
          countryName: "France",
          latitude: 45.75,
          longitude: 4.85,
        }),
      ]);

      const makeUser = async (
        label: string,
        location: { city?: City; timeZone?: string },
      ): Promise<User> => {
        const created = await userService.create({
          email: `${label}-${stamp}@example.com`,
          password: "Password123!",
          name: label,
        });
        const user = await userRepo.findOneOrFail({
          where: { id: created.id },
        });
        user.city = location.city ?? null;
        user.timeZone = location.timeZone;
        return await userRepo.save(user);
      };

      // A city outranks a conflicting time zone, so the French member stays
      // non-US despite a US zone.
      const usCityUser = await makeUser("us-city", { city: usCity });
      const frenchCityUser = await makeUser("french-city", {
        city: frenchCity,
        timeZone: "America/New_York",
      });
      const usZoneUser = await makeUser("us-zone", {
        timeZone: "America/Chicago",
      });
      const berlinZoneUser = await makeUser("berlin-zone", {
        timeZone: "Europe/Berlin",
      });
      const unplaceableUser = await makeUser("unplaceable", {});

      const [inUs, outsideUs] = await Promise.all([
        recipientService.resolveCohortMemberIds({ type: "USMember" }),
        recipientService.resolveCohortMemberIds({ type: "NonUSMember" }),
      ]);

      expect(inUs.has(usCityUser.id)).toBe(true);
      expect(inUs.has(usZoneUser.id)).toBe(true);
      expect(inUs.has(frenchCityUser.id)).toBe(false);
      expect(inUs.has(berlinZoneUser.id)).toBe(false);
      expect(inUs.has(unplaceableUser.id)).toBe(false);

      expect(outsideUs.has(frenchCityUser.id)).toBe(true);
      expect(outsideUs.has(berlinZoneUser.id)).toBe(true);
      expect(outsideUs.has(usCityUser.id)).toBe(false);
      expect(outsideUs.has(usZoneUser.id)).toBe(false);
      expect(outsideUs.has(unplaceableUser.id)).toBe(false);

      // NOT(USMember) keeps the members we can't place, so it is wider than
      // NonUSMember.
      const notUs = await recipientService.resolveCohortMemberIds({
        type: "NOT",
        child: { type: "USMember" },
      });
      expect(notUs.has(unplaceableUser.id)).toBe(true);
      expect(notUs.has(usCityUser.id)).toBe(false);

      // The per-user path has to agree with the batch one.
      const perUser = async (user: User) => ({
        us: await actionsService.computeIsInCohortExpression({
          user,
          cohortExpression: { type: "USMember" },
        }),
        nonUs: await actionsService.computeIsInCohortExpression({
          user,
          cohortExpression: { type: "NonUSMember" },
        }),
      });
      expect(await perUser(usCityUser)).toEqual({ us: true, nonUs: false });
      expect(await perUser(usZoneUser)).toEqual({ us: true, nonUs: false });
      expect(await perUser(frenchCityUser)).toEqual({ us: false, nonUs: true });
      expect(await perUser(unplaceableUser)).toEqual({
        us: false,
        nonUs: false,
      });

      // Cleanup
      await userRepo.delete([
        usCityUser.id,
        frenchCityUser.id,
        usZoneUser.id,
        berlinZoneUser.id,
        unplaceableUser.id,
      ]);
      await cityRepo.delete([usCity.id, frenchCity.id]);
    });

    it("evaluates FormFieldValue cohort expression against real form response data", async () => {
      const respondedUser = await userService.create({
        email: `responded-${Date.now()}@example.com`,
        password: "Password123!",
        name: "Responded User",
      });

      const wrongAnswerUser = await userService.create({
        email: `wronganswer-${Date.now()}@example.com`,
        password: "Password123!",
        name: "Wrong Answer User",
      });

      const noResponseUser = await userService.create({
        email: `noresponse-${Date.now()}@example.com`,
        password: "Password123!",
        name: "No Response User",
      });

      // Create a form
      const { form, snapshot } = await createFormWithSnapshot(ctx.dataSource, {
        title: "Cohort Test Form",
        schema: {
          title: "Cohort Test Form",
          pages: [
            {
              id: "page-1",
              fields: [
                {
                  id: "favorite-color",
                  type: "input",
                  kind: "text",
                  label: "Favorite Color",
                  required: true,
                },
              ],
            },
          ],
          outputViews: [],
        },
      });

      // respondedUser answered "blue"
      await formResponseRepo.save(
        formResponseRepo.create({
          formId: form.id,
          user: respondedUser,
          answers: { "favorite-color": "blue" },
          formSnapshotId: snapshot.id,
        }),
      );

      // wrongAnswerUser answered "red"
      await formResponseRepo.save(
        formResponseRepo.create({
          formId: form.id,
          user: wrongAnswerUser,
          answers: { "favorite-color": "red" },
          formSnapshotId: snapshot.id,
        }),
      );

      // Test responseEqualTo filter
      const targetAction = await actionRepo.save(
        actionRepo.create({
          name: `FormField Cohort ${Date.now()}`,
          category: "Test",
          body: "Body",
          taskContents: "Task",
          visibilityMode: VisibilityMode.Public,
          preventCompletion: false,
          onboarding: true,
          type: ActionTaskType.Activity,
          cohortExpression: {
            type: "FormFieldValue",
            formId: form.id,
            fieldId: "favorite-color",
            responseEqualTo: "blue",
          },
        }),
      );

      const targetEvent = await eventRepo.save(
        eventRepo.create({
          title: "Launch",
          description: "Go",
          newStatus: ActionStatus.MemberAction,
          date: new Date(Date.now() - 1000),
          action: targetAction,
        }),
      );

      const makeToken = (u: User) =>
        ctx.jwtService.sign(
          { sub: u.id, email: u.email, name: u.name },
          { secret: process.env.JWT_SECRET },
        );

      const [respondedRes, wrongRes, noResponseRes] = await Promise.all([
        request(ctx.app.getHttpServer())
          .get("/actions/loggedIn")
          .set("Authorization", `Bearer ${makeToken(respondedUser)}`)
          .expect(200),
        request(ctx.app.getHttpServer())
          .get("/actions/loggedIn")
          .set("Authorization", `Bearer ${makeToken(wrongAnswerUser)}`)
          .expect(200),
        request(ctx.app.getHttpServer())
          .get("/actions/loggedIn")
          .set("Authorization", `Bearer ${makeToken(noResponseUser)}`)
          .expect(200),
      ]);

      const findTarget = (res: request.Response) =>
        res.body.find((a: ActionDto) => a.id === targetAction.id);

      // User who answered "blue" should be in cohort
      expect(findTarget(respondedRes)?.canParticipate).toBe(true);
      expect(findTarget(respondedRes)?.shouldParticipate).toBe(true);
      // User who answered "red" should NOT be in cohort
      expect(findTarget(wrongRes)?.canParticipate).toBe(false);
      // User who never responded should NOT be in cohort
      expect(findTarget(noResponseRes)?.canParticipate).toBe(false);

      // Cleanup
      await formResponseRepo.delete({ formId: form.id });
      await eventRepo.delete(targetEvent.id);
      await actionRepo.delete(targetAction.id);
      await formRepo.delete(form.id);
      await userRepo.delete(respondedUser.id);
      await userRepo.delete(wrongAnswerUser.id);
      await userRepo.delete(noResponseUser.id);
    });

    it("evaluates FormFieldValue with responseAny=true matches any response", async () => {
      const respondedUser = await userService.create({
        email: `anyresp-${Date.now()}@example.com`,
        password: "Password123!",
        name: "Any Response User",
      });

      const noResponseUser = await userService.create({
        email: `noresp2-${Date.now()}@example.com`,
        password: "Password123!",
        name: "No Response User 2",
      });

      const { form, snapshot: anySnapshot } = await createFormWithSnapshot(
        ctx.dataSource,
        {
          title: "Any Response Test",
          schema: {
            title: "Any Response Test",
            pages: [
              {
                id: "page-1",
                fields: [
                  {
                    id: "field-1",
                    type: "input",
                    kind: "text",
                    label: "Field 1",
                    required: true,
                  },
                ],
              },
            ],
            outputViews: [],
          },
        },
      );

      await formResponseRepo.save(
        formResponseRepo.create({
          formId: form.id,
          user: respondedUser,
          answers: { "field-1": "anything" },
          formSnapshotId: anySnapshot.id,
        }),
      );

      const targetAction = await actionRepo.save(
        actionRepo.create({
          name: `FormField Any Cohort ${Date.now()}`,
          category: "Test",
          body: "Body",
          taskContents: "Task",
          visibilityMode: VisibilityMode.Public,
          preventCompletion: false,
          onboarding: true,
          type: ActionTaskType.Activity,
          cohortExpression: {
            type: "FormFieldValue",
            formId: form.id,
            fieldId: "field-1",
            responseAny: true,
          },
        }),
      );

      const targetEvent = await eventRepo.save(
        eventRepo.create({
          title: "Launch",
          description: "Go",
          newStatus: ActionStatus.MemberAction,
          date: new Date(Date.now() - 1000),
          action: targetAction,
        }),
      );

      const makeToken = (u: User) =>
        ctx.jwtService.sign(
          { sub: u.id, email: u.email, name: u.name },
          { secret: process.env.JWT_SECRET },
        );

      const [respondedRes, noResponseRes] = await Promise.all([
        request(ctx.app.getHttpServer())
          .get("/actions/loggedIn")
          .set("Authorization", `Bearer ${makeToken(respondedUser)}`)
          .expect(200),
        request(ctx.app.getHttpServer())
          .get("/actions/loggedIn")
          .set("Authorization", `Bearer ${makeToken(noResponseUser)}`)
          .expect(200),
      ]);

      const findTarget = (res: request.Response) =>
        res.body.find((a: ActionDto) => a.id === targetAction.id);

      expect(findTarget(respondedRes)?.canParticipate).toBe(true);
      expect(findTarget(noResponseRes)?.canParticipate).toBe(false);

      // Cleanup
      await formResponseRepo.delete({ formId: form.id });
      await eventRepo.delete(targetEvent.id);
      await actionRepo.delete(targetAction.id);
      await formRepo.delete(form.id);
      await userRepo.delete(respondedUser.id);
      await userRepo.delete(noResponseUser.id);
    });

    it("evaluates AND cohort expression combining multiple conditions", async () => {
      // Create a user who is both a leader AND completed an action
      const bothUser = await userService.create({
        email: `both-${Date.now()}@example.com`,
        password: "Password123!",
        name: "Both Conditions User",
      });

      const leaderOnlyUser = await userService.create({
        email: `leaderonly-${Date.now()}@example.com`,
        password: "Password123!",
        name: "Leader Only User",
      });

      const prerequisiteAction = await actionRepo.save(
        actionRepo.create({
          name: `AND Prereq ${Date.now()}`,
          category: "Test",
          body: "Body",
          taskContents: "Task",
          visibilityMode: VisibilityMode.Public,
        }),
      );

      // bothUser completed the prerequisite
      await activityRepo.save(
        activityRepo.create({
          userId: bothUser.id,
          actionId: prerequisiteAction.id,
          type: ActionActivityType.USER_COMPLETED,
        }),
      );

      // Both users are leaders
      const community = await communityRepo.save(
        communityRepo.create({
          name: `AND Test Community ${Date.now()}`,
          leaders: [bothUser, leaderOnlyUser],
          users: [bothUser, leaderOnlyUser],
        }),
      );

      const targetAction = await actionRepo.save(
        actionRepo.create({
          name: `AND Cohort ${Date.now()}`,
          category: "Test",
          body: "Body",
          taskContents: "Task",
          visibilityMode: VisibilityMode.Public,
          preventCompletion: false,
          onboarding: true,
          type: ActionTaskType.Activity,
          cohortExpression: {
            type: "AND",
            children: [
              { type: "GroupLead" },
              { type: "CompletedAction", actionId: prerequisiteAction.id },
            ],
          },
        }),
      );

      const targetEvent = await eventRepo.save(
        eventRepo.create({
          title: "Launch",
          description: "Go",
          newStatus: ActionStatus.MemberAction,
          date: new Date(Date.now() - 1000),
          action: targetAction,
        }),
      );

      const makeToken = (u: User) =>
        ctx.jwtService.sign(
          { sub: u.id, email: u.email, name: u.name },
          { secret: process.env.JWT_SECRET },
        );

      const [bothRes, leaderOnlyRes] = await Promise.all([
        request(ctx.app.getHttpServer())
          .get("/actions/loggedIn")
          .set("Authorization", `Bearer ${makeToken(bothUser)}`)
          .expect(200),
        request(ctx.app.getHttpServer())
          .get("/actions/loggedIn")
          .set("Authorization", `Bearer ${makeToken(leaderOnlyUser)}`)
          .expect(200),
      ]);

      const findTarget = (res: request.Response) =>
        res.body.find((a: ActionDto) => a.id === targetAction.id);

      // User who is leader AND completed action should be in cohort
      expect(findTarget(bothRes)?.canParticipate).toBe(true);
      // User who is only a leader should NOT be in cohort
      expect(findTarget(leaderOnlyRes)?.canParticipate).toBe(false);

      // Cleanup
      await activityRepo.delete({ actionId: prerequisiteAction.id });
      await communityRepo.delete(community.id);
      await eventRepo.delete(targetEvent.id);
      await actionRepo.delete(targetAction.id);
      await actionRepo.delete(prerequisiteAction.id);
      await userRepo.delete(bothUser.id);
      await userRepo.delete(leaderOnlyUser.id);
    });

    it("excludes shouldComplete flag for users without eligible contracts when not an onboarding action", async () => {
      const { action, event } = await createPublishedAction(
        "Contract Restricted Action",
        {
          status: ActionStatus.MemberAction,
          actionOverrides: {},
        },
      );

      const unsignedUser = await userService.create({
        email: `unsigned-${Date.now()}@example.com`,
        password: "Password123!",
        name: "Unsigned User",
        tags: [ctx.defaultTag],
      });

      const lateSigner = await userService.create({
        email: `late-${Date.now()}@example.com`,
        password: "Password123!",
        name: "Late Signer",
        contractEvents: [
          {
            type: ContractEventType.SIGNED,
            date: new Date(event.date.getTime() + 1000),
            automatic: false,
            contractId: ctx.defaultContractId,
          },
        ],
        tags: [ctx.defaultTag],
      });

      const eligibleUser = await userService.create({
        email: `eligible-${Date.now()}@example.com`,
        password: "Password123!",
        name: "Eligible User",
        contractEvents: [
          {
            type: ContractEventType.SIGNED,
            date: new Date(event.date.getTime() - 1000),
            automatic: false,
            contractId: ctx.defaultContractId,
          },
        ],
        tags: [ctx.defaultTag],
      });

      const unsignedToken = ctx.jwtService.sign(
        {
          sub: unsignedUser.id,
          email: unsignedUser.email,
          name: unsignedUser.name,
        },
        { secret: process.env.JWT_SECRET },
      );

      const lateToken = ctx.jwtService.sign(
        {
          sub: lateSigner.id,
          email: lateSigner.email,
          name: lateSigner.name,
        },
        { secret: process.env.JWT_SECRET },
      );

      const eligibleToken = ctx.jwtService.sign(
        {
          sub: eligibleUser.id,
          email: eligibleUser.email,
          name: eligibleUser.name,
        },
        { secret: process.env.JWT_SECRET },
      );

      const [unsignedRes, lateRes, eligibleRes] = await Promise.all([
        request(ctx.app.getHttpServer())
          .get("/actions/loggedIn")
          .set("Authorization", `Bearer ${unsignedToken}`)
          .expect(200),
        request(ctx.app.getHttpServer())
          .get("/actions/loggedIn")
          .set("Authorization", `Bearer ${lateToken}`)
          .expect(200),
        request(ctx.app.getHttpServer())
          .get("/actions/loggedIn")
          .set("Authorization", `Bearer ${eligibleToken}`)
          .expect(200),
      ]);

      const findAction = (res: request.Response) =>
        res.body.find((a: ActionDto) => a.id === action.id);

      const unsignedAction = findAction(unsignedRes);
      const lateAction = findAction(lateRes);
      const eligibleAction = findAction(eligibleRes);

      expect(unsignedAction).toBeDefined();
      expect(unsignedAction!.shouldParticipate).toBe(false);
      expect(lateAction).toBeDefined();
      expect(lateAction!.shouldParticipate).toBe(false);
      expect(eligibleAction).toBeDefined();
      expect(eligibleAction!.shouldParticipate).toBe(true);

      await actionRepo.delete(action.id);
      await userRepo.delete(unsignedUser.id);
      await userRepo.delete(lateSigner.id);
      await userRepo.delete(eligibleUser.id);
    });

    it("shows onboarding actions to users without contracts", async () => {
      const { action } = await createPublishedAction("Onboarding Action", {
        status: ActionStatus.MemberAction,
        actionOverrides: {
          onboarding: true,
        },
      });

      const contractlessUser = await userService.create({
        email: `contractless-${Date.now()}@example.com`,
        password: "Password123!",
        name: "Contractless User",
        tags: [ctx.defaultTag],
      });

      const contractlessToken = ctx.jwtService.sign(
        {
          sub: contractlessUser.id,
          email: contractlessUser.email,
          name: contractlessUser.name,
        },
        { secret: process.env.JWT_SECRET },
      );

      const res = await request(ctx.app.getHttpServer())
        .get("/actions/loggedIn")
        .set("Authorization", `Bearer ${contractlessToken}`)
        .expect(200);

      const targetAction = res.body.find((a: ActionDto) => a.id === action.id);

      expect(targetAction).toBeDefined();
      expect(targetAction.shouldParticipate).toBe(true);

      await actionRepo.delete(action.id);
      await userRepo.delete(contractlessUser.id);
    });

    it("admin can add an event to an action", async () => {
      const action = await actionRepo.findOneBy({
        name: "Test Action",
      });

      const newEvent: CreateActionEventDto = {
        title: "Test Event",
        description: "Test Event",
        newStatus: ActionStatus.Resolution,
        date: new Date(),
      };

      const res = await request(ctx.app.getHttpServer())
        .post(`/actions/${action!.id}/events`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send(newEvent);

      expect(res.status).toBe(201);
      expect(res.body.title).toBe("Test Event");
    });

    it("events are included in action details", async () => {
      const action = await actionRepo.findOneBy({
        name: "Test Action",
      });

      const res = await request(ctx.app.getHttpServer())
        .get(`/actions/slug/${action!.id}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.events.length).toBe(2);
      expect(res.body.events.map((e: ActionEventDto) => e.title)).toContain(
        "Test Event",
      );
    });

    describe("Computed Status Tests", () => {
      it("new action with no events should have Draft status", async () => {
        const newAction = actionRepo.create({
          name: "Status Test Action",
          category: "Test",
          body: "Test action for status computation",
        });
        await actionRepo.save(newAction);

        // Use admin token to access draft action
        const res = await request(ctx.app.getHttpServer())
          .get(`/actions/slug/${newAction.id}`)
          .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(ActionStatus.Draft);
        expect(res.body.events.length).toBe(0);

        // Cleanup
        await actionRepo.delete(newAction.id);
      });

      it("adding first event should change status from Draft to new status", async () => {
        const newAction = actionRepo.create({
          name: "Status Transition Test",
          category: "Test",
          body: "Test action for status transitions",
          taskContents: "Test action for status transitions",
        });
        await actionRepo.save(newAction);

        // Verify initial draft status using admin token
        let res = await request(ctx.app.getHttpServer())
          .get(`/actions/slug/${newAction.id}`)
          .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

        expect(res.body.status).toBe(ActionStatus.Draft);

        // Add event to change status
        const newEvent: CreateActionEventDto = {
          title: "Launch Event",
          description: "Action is now gathering commitments",
          newStatus: ActionStatus.MemberAction,
          date: new Date(Date.now() - 1000), // 1 second ago
        };

        res = await request(ctx.app.getHttpServer())
          .post(`/actions/${newAction.id}/events`)
          .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
          .send(newEvent);

        const getRes = await request(ctx.app.getHttpServer())
          .get(`/actions/slug/${newAction.id}`)
          .set("Authorization", `Bearer ${ctx.accessToken}`);

        expect(getRes.status).toBe(200);
        expect(getRes.body.status).toBe(ActionStatus.MemberAction);
        expect(getRes.body.events.length).toBe(1);

        // Cleanup
        await actionRepo.delete(newAction.id);
      });

      it("status should reflect most recent past event when multiple events exist", async () => {
        const newAction = actionRepo.create({
          name: "Multi Event Test",
          category: "Test",
          body: "Test action for multiple events",
          taskContents: "Test action for multiple events",
        });
        await actionRepo.save(newAction);

        // Add first event (older)
        const firstEvent: CreateActionEventDto = {
          title: "Launch",
          description: "Action launched",
          newStatus: ActionStatus.OfficeAction,
          date: new Date(Date.now() - 3600000), // 1 hour ago
        };

        await request(ctx.app.getHttpServer())
          .post(`/actions/${newAction.id}/events`)
          .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
          .send(firstEvent);

        // Add second event (more recent)
        const secondEvent: CreateActionEventDto = {
          title: "Commitments Reached",
          description: "Action now in member action phase",
          newStatus: ActionStatus.MemberAction,
          date: new Date(Date.now() - 1800000), // 30 minutes ago
        };

        await request(ctx.app.getHttpServer())
          .post(`/actions/${newAction.id}/events`)
          .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
          .send(secondEvent);

        const getRes = await request(ctx.app.getHttpServer())
          .get(`/actions/slug/${newAction.id}`)
          .set("Authorization", `Bearer ${ctx.accessToken}`);

        expect(getRes.status).toBe(200);
        expect(getRes.body.status).toBe(ActionStatus.MemberAction);
        expect(getRes.body.events.length).toBe(2);

        // Cleanup
        await actionRepo.delete(newAction.id);
      });

      it("future events should not affect current status", async () => {
        const newAction = actionRepo.create({
          name: "Future Event Test",
          category: "Test",
          body: "Test action for future events",
          taskContents: "Test action for future events",
        });
        await actionRepo.save(newAction);

        // Add past event
        const pastEvent: CreateActionEventDto = {
          title: "Launch",
          description: "Action launched",
          newStatus: ActionStatus.MemberAction,
          date: new Date(Date.now() - 3600000), // 1 hour ago
        };

        await request(ctx.app.getHttpServer())
          .post(`/actions/${newAction.id}/events`)
          .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
          .send(pastEvent);

        // Add future event
        const futureEvent: CreateActionEventDto = {
          title: "Future Completion",
          description: "Action will be completed",
          newStatus: ActionStatus.Completed,
          date: new Date(Date.now() + 3600000), // 1 hour from now
        };

        await request(ctx.app.getHttpServer())
          .post(`/actions/${newAction.id}/events`)
          .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
          .send(futureEvent);

        const getRes = await request(ctx.app.getHttpServer())
          .get(`/actions/slug/${newAction.id}`)
          .set("Authorization", `Bearer ${ctx.accessToken}`);

        expect(getRes.status).toBe(200);
        expect(getRes.body.status).toBe(ActionStatus.MemberAction); // Should still be the past event's status
        expect(getRes.body.events.length).toBe(2);

        // Cleanup
        await actionRepo.delete(newAction.id);
      });
      //   it('events on same date should use chronological order by event creation', async () => {
      //     const newAction = actionRepo.create({
      //       name: 'Same Date Test',
      //       category: 'Test',
      //       body: 'Test action for events on same date',
      //     });
      //     await actionRepo.save(newAction);

      //     const eventDate = new Date(Date.now() - 3600000); // 1 hour ago

      //     // Add first event
      //     const firstEvent: CreateActionEventDto = {
      //       title: 'First Event',
      //       description: 'First event on this date',
      //       newStatus: ActionStatus.MemberAction,
      //       date: eventDate,
      //       showInTimeline: true,
      //       sendNotifsTo: NotificationType.All,
      //     };

      //     await request(ctx.app.getHttpServer())
      //       .post(`/actions/${newAction.id}/events`)
      //       .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
      //       .send(firstEvent);

      //     // Add second event with same date
      //     const secondEvent: CreateActionEventDto = {
      //       title: 'Second Event',
      //       description: 'Second event on same date',
      //       newStatus: ActionStatus.MemberAction,
      //       date: eventDate,
      //       showInTimeline: true,
      //       sendNotifsTo: NotificationType.All,
      //     };

      //     const res = await request(ctx.app.getHttpServer())
      //       .post(`/actions/${newAction.id}/events`)
      //       .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
      //       .send(secondEvent);

      //     expect(res.status).toBe(201);
      //     expect(res.body.status).toBe(ActionStatus.MemberAction);
      //     expect(res.body.events.length).toBe(2);

      //     // Cleanup
      //     await actionRepo.delete(newAction.id);
      //   });

      it("status computation should handle complex timeline scenarios", async () => {
        const newAction = actionRepo.create({
          name: "Complex Timeline Test",
          category: "Test",
          body: "Test action for complex status timeline",
        });
        await actionRepo.save(newAction);

        const now = Date.now();

        // Add events in non-chronological order to test sorting
        const events = [
          {
            title: "Future Resolution",
            newStatus: ActionStatus.Resolution,
            date: new Date(now + 7200000), // 2 hours from now
          },
          {
            title: "Launch",
            newStatus: ActionStatus.MemberAction,
            date: new Date(now - 14400000), // 4 hours ago
          },
          {
            title: "Office Action Start",
            newStatus: ActionStatus.OfficeAction,
            date: new Date(now - 3600000), // 1 hour ago (most recent past)
          },
          {
            title: "Planned Phase",
            newStatus: ActionStatus.Planned,
            date: new Date(now - 7200000), // 2 hours ago
          },
        ];

        for (const event of events) {
          const eventDto: CreateActionEventDto = {
            title: event.title,
            description: `Event: ${event.title}`,
            newStatus: event.newStatus,
            date: event.date,
          };

          await request(ctx.app.getHttpServer())
            .post(`/actions/${newAction.id}/events`)
            .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
            .send(eventDto);
        }

        // Get final action state
        const res = await request(ctx.app.getHttpServer())
          .get(`/actions/slug/${newAction.id}`)
          .set("Authorization", `Bearer ${ctx.accessToken}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(ActionStatus.OfficeAction); // Most recent past event
        expect(res.body.events.length).toBe(4);

        // Cleanup
        await actionRepo.delete(newAction.id);
      });
    });
  });
  it("admin cannot add an event to an action with missing data", async () => {
    const action = await actionRepo.findOneBy({
      name: "Test Action",
    });

    const incompleteEvent: Partial<ActionEventDto> = {
      title: "Incomplete Event",
    };

    const res = await request(ctx.app.getHttpServer())
      .post(`/actions/${action!.id}/events`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send(incompleteEvent);

    expect(res.status).toBe(400);
  });

  describe("Follow-up forms", () => {
    const followUpFormRepo = () => ctx.dataSource.getRepository(FollowUpForm);

    const createTargetForm = async (title: string) => {
      const { form } = await createFormWithSnapshot(ctx.dataSource, {
        title,
        schema: { title, pages: [], outputViews: [] },
      });
      return form;
    };

    it("admin create round-trips every nullable field", async () => {
      const { action } = await createPublishedAction("Follow-up Create All");
      const form = await createTargetForm("Follow-up Create All Form");
      const startDate = "2026-01-02T03:04:05.000Z";
      const endDate = "2026-02-03T04:05:06.000Z";
      const cohortExpression = { type: "Tag", tagId: ctx.defaultTag.id };

      const res = await request(ctx.app.getHttpServer())
        .post(`/actions/${action.id}/follow-up-forms`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          actionId: action.id,
          formId: form.id,
          name: "Debrief",
          instructions: "Tell us how it went",
          startDate,
          endDate,
          cohortExpression,
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        name: "Debrief",
        instructions: "Tell us how it went",
        startDate,
        endDate,
        cohortExpression,
      });

      const stored = await followUpFormRepo().findOneByOrFail({
        id: res.body.id,
      });
      expect(stored.name).toBe("Debrief");
      expect(stored.instructions).toBe("Tell us how it went");
      expect(stored.startDate?.toISOString()).toBe(startDate);
      expect(stored.endDate?.toISOString()).toBe(endDate);
      expect(stored.cohortExpression).toEqual(cohortExpression);
    });

    it("admin create needs only actionId and formId", async () => {
      const { action } = await createPublishedAction("Follow-up Create Bare");
      const form = await createTargetForm("Follow-up Create Bare Form");

      const res = await request(ctx.app.getHttpServer())
        .post(`/actions/${action.id}/follow-up-forms`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ actionId: action.id, formId: form.id });

      expect(res.status).toBe(201);

      const stored = await followUpFormRepo().findOneByOrFail({
        id: res.body.id,
      });
      expect(stored.name).toBeNull();
      expect(stored.startDate).toBeNull();
      expect(stored.endDate).toBeNull();
      expect(stored.instructions).toBeNull();
      expect(stored.cohortExpression).toBeNull();
    });

    it("explicit null clears a follow-up form column, omitting leaves it", async () => {
      const { action } = await createPublishedAction("Follow-up Update");
      const form = await createTargetForm("Follow-up Update Form");

      const createRes = await request(ctx.app.getHttpServer())
        .post(`/actions/${action.id}/follow-up-forms`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          actionId: action.id,
          formId: form.id,
          name: "Debrief",
          instructions: "Tell us how it went",
        });
      expect(createRes.status).toBe(201);

      const updateRes = await request(ctx.app.getHttpServer())
        .patch(`/actions/follow-up-forms/${createRes.body.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ name: null });
      expect(updateRes.status).toBe(200);

      const stored = await followUpFormRepo().findOneByOrFail({
        id: createRes.body.id,
      });
      expect(stored.name).toBeNull();
      expect(stored.instructions).toBe("Tell us how it went");
    });
  });

  describe("Additional endpoints", () => {
    it("records a completion activity for a user", async () => {
      const { action } = await createPublishedAction("Completion Scenario", {
        status: ActionStatus.MemberAction,
      });

      const complete = await request(ctx.app.getHttpServer())
        .post(`/actions/complete/${action.id}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(201);

      expect(complete.body.type).toBe(ActionActivityType.USER_COMPLETED);

      const feed = await request(ctx.app.getHttpServer())
        .get("/actions/activities/feed")
        .query({ limit: 5 })
        .expect(200);

      expect(
        feed.body.some((activity) => activity.id === complete.body.id),
      ).toBe(true);

      await actionRepo.delete(action.id);
    });

    it("rejects invalid before cursor when fetching the activity feed", async () => {
      await request(ctx.app.getHttpServer())
        .get("/actions/activities/feed")
        .query({ before: "not-a-date" })
        .expect(400);
    });

    it("exposes per-action activities and individual activity details", async () => {
      const { action } = await createPublishedAction("Activities Scenario", {
        status: ActionStatus.MemberAction,
      });

      const completion = await request(ctx.app.getHttpServer())
        .post(`/actions/complete/${action.id}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(201);

      const activityId = completion.body.id;

      const activities = await request(ctx.app.getHttpServer())
        .get(`/actions/${action.id}/activities`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);

      expect(activities.body.length).toBeGreaterThan(0);

      const single = await request(ctx.app.getHttpServer())
        .get(`/actions/activities/${activityId}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);

      expect(single.body.id).toBe(activityId);

      await actionRepo.delete(action.id);
    });

    it("shows draft actions to admins", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get("/actions/all")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      const hasDraft = res.body.some(
        (action: Action) => action.status === ActionStatus.Draft,
      );
      expect(hasDraft).toBe(true);
    });

    it("returns friend activity for accepted relationships", async () => {
      const { action } = await createPublishedAction(
        "Friend Activity Scenario",
        { status: ActionStatus.MemberAction },
      );
      const friend = await userService.create({
        name: "Friend User",
        email: `friend-${Date.now()}@example.com`,
        password: "Password123!",
        tags: [ctx.defaultTag],
      });

      await userService.makeFriendsAutomated(ctx.testUserId, friend.id);

      const friendToken = ctx.jwtService.sign({
        sub: friend.id,
        email: friend.email,
        name: friend.name,
      });

      await request(ctx.app.getHttpServer())
        .post(`/actions/complete/${action.id}`)
        .set("Authorization", `Bearer ${friendToken}`)
        .expect(201);

      const friendActivity = await request(ctx.app.getHttpServer())
        .get("/actions/friendActivity")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);

      expect(friendActivity.body.length).toBeGreaterThan(0);
      expect(friendActivity.body[0].user.id).toBe(friend.id);

      await actionRepo.delete(action.id);
    });

    it("supports liking, unliking, and commenting on activities", async () => {
      const { action } = await createPublishedAction(
        "Activity Reactions Scenario",
        { status: ActionStatus.MemberAction },
      );

      const completion = await request(ctx.app.getHttpServer())
        .post(`/actions/complete/${action.id}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(201);

      const activityId = completion.body.id;

      const like = await request(ctx.app.getHttpServer())
        .post(`/actions/likeActivity/${activityId}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(201);

      expect(like.body.likes.length).toBe(1);

      const unlike = await request(ctx.app.getHttpServer())
        .post(`/actions/unlikeActivity/${activityId}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(201);

      expect(unlike.body.likes.length).toBe(0);

      await actionRepo.delete(action.id);
    });

    it("notifies activity owners when their updates receive likes", async () => {
      const { action } = await createPublishedAction("Activity Like Notice", {
        status: ActionStatus.MemberAction,
      });

      const completion = await request(ctx.app.getHttpServer())
        .post(`/actions/complete/${action.id}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(201);

      const activityId = completion.body.id;

      await request(ctx.app.getHttpServer())
        .post(`/actions/likeActivity/${activityId}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(201);

      const likeNotifs = await notifRepo.find({
        where: {
          user: { id: ctx.testUserId },
          category: NotificationCategory.Likes,
          groupingKey: `like:activity:user_completed:${activityId}`,
        },
      });

      expect(likeNotifs).toHaveLength(1);
      expect(likeNotifs[0].message).toBe(
        "Test Admin liked your completion of: Activity Like Notice",
      );
      expect(likeNotifs[0].webAppLocation).toBe(
        `/actions/${action.id}/activity/${activityId}`,
      );

      await actionRepo.delete(action.id);
    });

    it("removes the like notification when the sole liker unlikes", async () => {
      const { action } = await createPublishedAction("Activity Sole Unlike", {
        status: ActionStatus.MemberAction,
      });

      const completion = await request(ctx.app.getHttpServer())
        .post(`/actions/complete/${action.id}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(201);

      const activityId = completion.body.id;

      await request(ctx.app.getHttpServer())
        .post(`/actions/likeActivity/${activityId}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post(`/actions/unlikeActivity/${activityId}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(201);

      const likeNotifs = await notifRepo.find({
        where: {
          user: { id: ctx.testUserId },
          category: NotificationCategory.Likes,
          groupingKey: `like:activity:user_completed:${activityId}`,
        },
      });

      expect(likeNotifs).toHaveLength(0);

      await actionRepo.delete(action.id);
    });

    it("decrements the like notification when one of multiple likers unlikes", async () => {
      const { action } = await createPublishedAction(
        "Activity Partial Unlike",
        { status: ActionStatus.MemberAction },
      );

      const completion = await request(ctx.app.getHttpServer())
        .post(`/actions/complete/${action.id}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(201);

      const activityId = completion.body.id;

      const secondLiker = await userService.create({
        email: `second-liker-${Date.now()}@example.com`,
        password: "Password123!",
        name: "Second Liker",
        tags: [ctx.defaultTag],
      });
      const secondLikerToken = ctx.jwtService.sign(
        {
          sub: secondLiker.id,
          email: secondLiker.email,
          name: secondLiker.name,
        },
        { secret: process.env.JWT_SECRET },
      );

      await request(ctx.app.getHttpServer())
        .post(`/actions/likeActivity/${activityId}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post(`/actions/likeActivity/${activityId}`)
        .set("Authorization", `Bearer ${secondLikerToken}`)
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post(`/actions/unlikeActivity/${activityId}`)
        .set("Authorization", `Bearer ${secondLikerToken}`)
        .expect(201);

      const likeNotifs = await notifRepo.find({
        where: {
          user: { id: ctx.testUserId },
          category: NotificationCategory.Likes,
          groupingKey: `like:activity:user_completed:${activityId}`,
        },
        relations: { associatedUsers: true },
      });

      expect(likeNotifs).toHaveLength(1);
      expect(likeNotifs[0].groupingCount).toBe(1);
      expect(likeNotifs[0].associatedUsers).toHaveLength(1);
      expect(likeNotifs[0].associatedUsers?.[0].id).toBe(ctx.adminUserId);
      expect(likeNotifs[0].message).toBe(
        "Test Admin liked your completion of: Activity Partial Unlike",
      );

      await userRepo.delete(secondLiker.id);
      await actionRepo.delete(action.id);
    });
  });

  describe("Participating-groups visibility in activity surfaces", () => {
    const activityGroupNames = (
      body: {
        type: string;
        activityGroup?: { actionName: string };
      }[],
    ) =>
      body
        .filter((item) => item.type === GlobalFeedItemType.ActivityGroup)
        .map((item) => item.activityGroup?.actionName);

    it("hides associated activity from users outside the cohort", async () => {
      const { action } = await createPublishedAction(
        `Hidden Cohort Activity ${Date.now()}`,
        {
          status: ActionStatus.MemberAction,
          actionOverrides: {
            visibilityMode: VisibilityMode.ParticipatingGroups,
            cohortExpression: {
              type: "Tag",
              tagId: ctx.defaultTag.id,
            },
          },
        },
      );

      const complete = await request(ctx.app.getHttpServer())
        .post(`/actions/complete/${action.id}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(201);

      const outsiderGlobal = await request(ctx.app.getHttpServer())
        .get("/actions/globalFeed")
        .query({ limit: 50 })
        .set("Authorization", `Bearer ${outsiderToken}`)
        .expect(200);
      expect(activityGroupNames(outsiderGlobal.body)).not.toContain(
        action.name,
      );

      const anonymousGlobal = await request(ctx.app.getHttpServer())
        .get("/actions/globalFeed")
        .query({ limit: 50 })
        .expect(200);
      expect(activityGroupNames(anonymousGlobal.body)).not.toContain(
        action.name,
      );

      const memberGlobal = await request(ctx.app.getHttpServer())
        .get("/actions/globalFeed")
        .query({ limit: 50 })
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);
      expect(activityGroupNames(memberGlobal.body)).toContain(action.name);

      const outsiderFeed = await request(ctx.app.getHttpServer())
        .get("/actions/activities/feed")
        .query({ limit: 50 })
        .set("Authorization", `Bearer ${outsiderToken}`)
        .expect(200);
      expect(
        outsiderFeed.body.some(
          (activity: { actionName: string }) =>
            activity.actionName === action.name,
        ),
      ).toBe(false);

      const memberFeed = await request(ctx.app.getHttpServer())
        .get("/actions/activities/feed")
        .query({ limit: 50 })
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);
      expect(
        memberFeed.body.some(
          (activity: { actionName: string }) =>
            activity.actionName === action.name,
        ),
      ).toBe(true);

      const outsiderUserFeed = await request(ctx.app.getHttpServer())
        .get(`/actions/userFeed/${ctx.testUserId}`)
        .set("Authorization", `Bearer ${outsiderToken}`)
        .expect(200);
      expect(
        outsiderUserFeed.body.some(
          (item: { activity?: { actionName: string } }) =>
            item.activity?.actionName === action.name,
        ),
      ).toBe(false);

      const outsiderCompleted = await request(ctx.app.getHttpServer())
        .get(`/actions/completed/${ctx.testUserId}`)
        .set("Authorization", `Bearer ${outsiderToken}`)
        .expect(200);
      expect(
        outsiderCompleted.body.some(
          (activity: { actionName: string }) =>
            activity.actionName === action.name,
        ),
      ).toBe(false);

      await request(ctx.app.getHttpServer())
        .get(`/actions/activities/${complete.body.id}`)
        .set("Authorization", `Bearer ${outsiderToken}`)
        .expect(404);

      await request(ctx.app.getHttpServer())
        .get(`/actions/${action.id}/activities`)
        .set("Authorization", `Bearer ${outsiderToken}`)
        .expect(404);

      await request(ctx.app.getHttpServer())
        .get("/actions/globalFeed/activityGroupMembers")
        .query({ actionId: action.id, activityType: "user_completed" })
        .set("Authorization", `Bearer ${outsiderToken}`)
        .expect(404);

      await actionRepo.delete(action.id);
    });

    it("hides action updates from users outside the cohort", async () => {
      const { action } = await createPublishedAction(
        `Hidden Cohort Update ${Date.now()}`,
        {
          status: ActionStatus.MemberAction,
          actionOverrides: {
            visibilityMode: VisibilityMode.ParticipatingGroups,
            cohortExpression: {
              type: "Tag",
              tagId: ctx.defaultTag.id,
            },
          },
        },
      );

      const created = await request(ctx.app.getHttpServer())
        .post(`/actions/createUpdate/${action.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          title: "Restricted update",
          shortNotifString: "something happened",
          date: new Date().toISOString(),
          notifyType: "none",
        })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .patch(`/actions/updateUpdate/${created.body.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          schema: {
            blocks: [
              { type: "display", kind: "header", id: "b1", text: "Body" },
            ],
          },
          expectedSchemaSnapshotId: created.body.schemaSnapshotId,
        })
        .expect(200);

      const outsiderUpdates = await request(ctx.app.getHttpServer())
        .get("/actions/updates")
        .set("Authorization", `Bearer ${outsiderToken}`)
        .expect(200);
      expect(
        outsiderUpdates.body.some(
          (update: { actionId: number }) => update.actionId === action.id,
        ),
      ).toBe(false);

      const memberUpdates = await request(ctx.app.getHttpServer())
        .get("/actions/updates")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);
      expect(
        memberUpdates.body.some(
          (update: { actionId: number }) => update.actionId === action.id,
        ),
      ).toBe(true);

      const outsiderGlobal = await request(ctx.app.getHttpServer())
        .get("/actions/globalFeed")
        .query({ limit: 50 })
        .set("Authorization", `Bearer ${outsiderToken}`)
        .expect(200);
      expect(
        outsiderGlobal.body.some(
          (item: { type: string; actionUpdate?: { actionId: number } }) =>
            item.type === GlobalFeedItemType.ActionUpdate &&
            item.actionUpdate?.actionId === action.id,
        ),
      ).toBe(false);

      await actionRepo.delete(action.id);
    });
  });

  describe("Global feed", () => {
    let activeUser: User | null = null;
    let suspendedUser: User | null = null;

    afterEach(async () => {
      if (activeUser) {
        await userRepo.delete(activeUser.id);
        activeUser = null;
      }
      if (suspendedUser) {
        await userRepo.delete(suspendedUser.id);
        suspendedUser = null;
      }
    });

    it("excludes suspended members from new member feed items", async () => {
      const now = Date.now();

      activeUser = await userService.create({
        email: `active-${now}@example.com`,
        password: "Password123!",
        name: "Active Member",
        tags: [ctx.defaultTag],
        contractEvents: [
          {
            type: ContractEventType.SIGNED,
            date: new Date(now - 60_000),
            automatic: false,
            contractId: ctx.defaultContractId,
          },
        ],
      });

      suspendedUser = await userService.create({
        email: `suspended-${now}@example.com`,
        password: "Password123!",
        name: "Suspended Member",
        tags: [ctx.defaultTag],
        contractEvents: [
          {
            type: ContractEventType.SIGNED,
            date: new Date(now - 120_000),
            automatic: false,
            contractId: ctx.defaultContractId,
          },
          {
            type: ContractEventType.SUSPENDED,
            date: new Date(now - 30_000),
            automatic: false,
          },
        ],
      });

      const res = await request(ctx.app.getHttpServer())
        .get("/actions/globalFeed")
        .query({ limit: 20 })
        .expect(200);

      const newMembersItem = res.body.find(
        (item) => item.type === GlobalFeedItemType.NewMembers,
      );

      expect(newMembersItem).toBeDefined();
      const newMemberIds = newMembersItem.newMembers.users.map(
        (user) => user.id,
      );

      expect(newMemberIds).toContain(activeUser.id);
      expect(newMemberIds).not.toContain(suspendedUser.id);
    });
  });

  describe("Action Ordering in /actions/loggedIn", () => {
    let orderingActions: Action[] = [];

    afterEach(async () => {
      for (const action of orderingActions) {
        await actionRepo.delete(action.id);
      }
      orderingActions = [];
    });

    const createOrderingAction = async (
      name: string,
      options: {
        events?: Array<{ status: ActionStatus; date: Date }>;
        priority?: number;
      } = {},
    ) => {
      const action = await actionRepo.save(
        actionRepo.create({
          name,
          category: "Test",
          body: "Ordering test action",
          taskContents: "Ordering test task",
          shortDescription: `${name} short description`,
          visibilityMode: VisibilityMode.Public,
          priority: options.priority ?? 0,
        }),
      );
      orderingActions.push(action);

      if (options.events) {
        for (const evt of options.events) {
          await eventRepo.save(
            eventRepo.create({
              title: `${name} - ${evt.status}`,
              description: "Event for ordering test",
              newStatus: evt.status,
              date: evt.date,
              action,
            }),
          );
        }
      }

      return action;
    };

    // Helper to get relative order of test actions only (filtering out other actions)
    const getRelativeOrder = (
      allActionIds: number[],
      testActionIds: number[],
    ): number[] => {
      return allActionIds.filter((id) => testActionIds.includes(id));
    };

    it("orders actions with deadlines before actions without deadlines", async () => {
      const now = Date.now();

      // Action with no deadline (only past MemberAction, no event after it)
      const noDeadlineAction = await createOrderingAction("No Deadline", {
        events: [
          { status: ActionStatus.MemberAction, date: new Date(now - 3600000) },
        ],
      });

      // Action with a deadline (MemberAction + Resolution event after it)
      const hasDeadlineAction = await createOrderingAction("Has Deadline", {
        events: [
          { status: ActionStatus.MemberAction, date: new Date(now - 3600000) }, // past MemberAction
          { status: ActionStatus.Resolution, date: new Date(now + 3600000) }, // future deadline
        ],
      });

      const res = await request(ctx.app.getHttpServer())
        .get("/actions/loggedIn?sorted=true")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);

      const actionIds = res.body.map((a: ActionDto) => a.id);
      const testActionIds = [noDeadlineAction.id, hasDeadlineAction.id];
      const orderedTestActions = getRelativeOrder(actionIds, testActionIds);

      expect(orderedTestActions).toContain(hasDeadlineAction.id);
      expect(orderedTestActions).toContain(noDeadlineAction.id);
      // Action with deadline should come before action without deadline
      expect(orderedTestActions.indexOf(hasDeadlineAction.id)).toBeLessThan(
        orderedTestActions.indexOf(noDeadlineAction.id),
      );
    });

    it("orders actions by soonest deadline first", async () => {
      const now = Date.now();

      // Action with later deadline
      const laterDeadlineAction = await createOrderingAction("Later Deadline", {
        events: [
          { status: ActionStatus.MemberAction, date: new Date(now - 3600000) }, // past MemberAction
          { status: ActionStatus.Resolution, date: new Date(now + 7200000) }, // deadline 2 hours from now
        ],
      });

      // Action with sooner deadline
      const soonerDeadlineAction = await createOrderingAction(
        "Sooner Deadline",
        {
          events: [
            {
              status: ActionStatus.MemberAction,
              date: new Date(now - 3600000),
            }, // past MemberAction
            { status: ActionStatus.Resolution, date: new Date(now + 1800000) }, // deadline 30 min from now
          ],
        },
      );

      const res = await request(ctx.app.getHttpServer())
        .get("/actions/loggedIn?sorted=true")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);

      const actionIds = res.body.map((a: ActionDto) => a.id);
      const testActionIds = [laterDeadlineAction.id, soonerDeadlineAction.id];
      const orderedTestActions = getRelativeOrder(actionIds, testActionIds);

      expect(orderedTestActions).toContain(soonerDeadlineAction.id);
      expect(orderedTestActions).toContain(laterDeadlineAction.id);
      // Sooner deadline should come before later deadline
      expect(orderedTestActions.indexOf(soonerDeadlineAction.id)).toBeLessThan(
        orderedTestActions.indexOf(laterDeadlineAction.id),
      );
    });

    it("orders actions with past member action events before actions without them (when no future events)", async () => {
      const now = Date.now();

      // Action with past OfficeAction only (no MemberAction)
      const noMemberActionAction = await createOrderingAction(
        "No Member Action",
        {
          events: [
            {
              status: ActionStatus.OfficeAction,
              date: new Date(now - 3600000),
            },
          ],
        },
      );

      // Action with past member action event
      const memberActionAction = await createOrderingAction(
        "Past Member Action",
        {
          events: [
            {
              status: ActionStatus.MemberAction,
              date: new Date(now - 3600000),
            },
          ],
        },
      );

      const res = await request(ctx.app.getHttpServer())
        .get("/actions/loggedIn?sorted=true")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);

      const actionIds = res.body.map((a: ActionDto) => a.id);
      const testActionIds = [noMemberActionAction.id, memberActionAction.id];
      const orderedTestActions = getRelativeOrder(actionIds, testActionIds);

      expect(orderedTestActions).toContain(memberActionAction.id);
      expect(orderedTestActions).toContain(noMemberActionAction.id);
      // Member action should come before no member action
      expect(orderedTestActions.indexOf(memberActionAction.id)).toBeLessThan(
        orderedTestActions.indexOf(noMemberActionAction.id),
      );
    });

    it("orders actions by most recent past member action event first", async () => {
      const now = Date.now();

      // Action with older member action event
      const olderAction = await createOrderingAction("Older Member Action", {
        events: [
          { status: ActionStatus.MemberAction, date: new Date(now - 7200000) }, // 2 hours ago
        ],
      });

      // Action with more recent member action event
      const newerAction = await createOrderingAction("Newer Member Action", {
        events: [
          { status: ActionStatus.MemberAction, date: new Date(now - 1800000) }, // 30 min ago
        ],
      });

      const res = await request(ctx.app.getHttpServer())
        .get("/actions/loggedIn?sorted=true")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);

      const actionIds = res.body.map((a: ActionDto) => a.id);
      const testActionIds = [olderAction.id, newerAction.id];
      const orderedTestActions = getRelativeOrder(actionIds, testActionIds);

      expect(orderedTestActions).toContain(newerAction.id);
      expect(orderedTestActions).toContain(olderAction.id);
      // Newer action should come before older action
      expect(orderedTestActions.indexOf(newerAction.id)).toBeLessThan(
        orderedTestActions.indexOf(olderAction.id),
      );
    });

    it("uses priority as final tiebreaker (lower number = higher priority)", async () => {
      const now = Date.now();
      const sameEventDate = new Date(now - 3600000);

      // Lower priority (higher number)
      const lowPriorityAction = await createOrderingAction("Low Priority", {
        events: [{ status: ActionStatus.MemberAction, date: sameEventDate }],
        priority: 10,
      });

      // Higher priority (lower number)
      const highPriorityAction = await createOrderingAction("High Priority", {
        events: [{ status: ActionStatus.MemberAction, date: sameEventDate }],
        priority: 1,
      });

      const res = await request(ctx.app.getHttpServer())
        .get("/actions/loggedIn?sorted=true")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);

      const actionIds = res.body.map((a: ActionDto) => a.id);
      const testActionIds = [lowPriorityAction.id, highPriorityAction.id];
      const orderedTestActions = getRelativeOrder(actionIds, testActionIds);

      expect(orderedTestActions).toContain(highPriorityAction.id);
      expect(orderedTestActions).toContain(lowPriorityAction.id);
      // High priority should come before low priority
      expect(orderedTestActions.indexOf(highPriorityAction.id)).toBeLessThan(
        orderedTestActions.indexOf(lowPriorityAction.id),
      );
    });

    it("maintains correct ordering with mixed deadlines, past member actions, and priority", async () => {
      const now = Date.now();

      // 1. Action with soonest deadline (should be first)
      const soonestDeadline = await createOrderingAction("Soonest Deadline", {
        events: [
          { status: ActionStatus.MemberAction, date: new Date(now - 3600000) }, // past MemberAction
          { status: ActionStatus.Resolution, date: new Date(now + 1800000) }, // deadline 30 min from now
        ],
        priority: 5,
      });

      // 2. Action with later deadline (should be second)
      const laterDeadline = await createOrderingAction("Later Deadline", {
        events: [
          { status: ActionStatus.MemberAction, date: new Date(now - 3600000) }, // past MemberAction
          { status: ActionStatus.Resolution, date: new Date(now + 3600000) }, // deadline 1 hour from now
        ],
        priority: 1,
      });

      // 3. Action with recent past member action but no deadline (should be third)
      const recentPastNoDeadline = await createOrderingAction(
        "Recent Past No Deadline",
        {
          events: [
            {
              status: ActionStatus.MemberAction,
              date: new Date(now - 1800000),
            }, // 30 min ago
          ],
          priority: 5,
        },
      );

      // 4. Action with older past member action but no deadline (should be fourth)
      const olderPastNoDeadline = await createOrderingAction(
        "Older Past No Deadline",
        {
          events: [
            {
              status: ActionStatus.MemberAction,
              date: new Date(now - 7200000),
            }, // 2 hours ago
          ],
          priority: 1,
        },
      );

      const res = await request(ctx.app.getHttpServer())
        .get("/actions/loggedIn?sorted=true")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);

      const actionIds = res.body.map((a: ActionDto) => a.id);
      const testActionIds = [
        soonestDeadline.id,
        laterDeadline.id,
        recentPastNoDeadline.id,
        olderPastNoDeadline.id,
      ];
      const orderedTestActions = getRelativeOrder(actionIds, testActionIds);

      expect(orderedTestActions.length).toBe(4);

      const soonestDeadlineIdx = orderedTestActions.indexOf(soonestDeadline.id);
      const laterDeadlineIdx = orderedTestActions.indexOf(laterDeadline.id);
      const recentPastIdx = orderedTestActions.indexOf(recentPastNoDeadline.id);
      const olderPastIdx = orderedTestActions.indexOf(olderPastNoDeadline.id);

      // Actions with deadlines come before actions without deadlines
      expect(soonestDeadlineIdx).toBeLessThan(recentPastIdx);
      expect(laterDeadlineIdx).toBeLessThan(recentPastIdx);

      // Soonest deadline comes before later deadline
      expect(soonestDeadlineIdx).toBeLessThan(laterDeadlineIdx);

      // Recent past member action comes before older past member action
      expect(recentPastIdx).toBeLessThan(olderPastIdx);
    });

    it("correctly sorts by MemberAction date when neither action has a deadline", async () => {
      const now = Date.now();

      // Action with older MemberAction (no deadline - Resolution is in the past)
      const olderMemberAction = await createOrderingAction(
        "Older MemberAction",
        {
          events: [
            {
              status: ActionStatus.MemberAction,
              date: new Date(now - 10800000),
            }, // 3h ago
            { status: ActionStatus.Resolution, date: new Date(now - 1800000) }, // 30min ago (past, not a deadline)
          ],
        },
      );

      // Action with more recent MemberAction (no deadline)
      const newerMemberAction = await createOrderingAction(
        "Newer MemberAction",
        {
          events: [
            {
              status: ActionStatus.MemberAction,
              date: new Date(now - 3600000),
            }, // 1h ago
          ],
        },
      );

      const res = await request(ctx.app.getHttpServer())
        .get("/actions/loggedIn?sorted=true")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);

      const actionIds = res.body.map((a: ActionDto) => a.id);
      const testActionIds = [olderMemberAction.id, newerMemberAction.id];
      const orderedTestActions = getRelativeOrder(actionIds, testActionIds);

      expect(orderedTestActions).toContain(newerMemberAction.id);
      expect(orderedTestActions).toContain(olderMemberAction.id);
      // The action with more recent MemberAction should come first
      expect(orderedTestActions.indexOf(newerMemberAction.id)).toBeLessThan(
        orderedTestActions.indexOf(olderMemberAction.id),
      );
    });
  });

  describe("Onboarding action canParticipate", () => {
    let onboardingAction: Action;
    let existingUser: User;
    let newUser: User;
    let existingUserToken: string;
    let newUserToken: string;

    beforeAll(async () => {
      const actionEventDate = new Date(Date.now() - 3600000); // 1 hour ago

      onboardingAction = await actionRepo.save(
        actionRepo.create({
          name: `Onboarding Eligibility Test ${Date.now()}`,
          category: "Test",
          body: "Onboarding action body",
          shortDescription: "Onboarding short desc",
          taskContents: "Onboarding task",
          visibilityMode: VisibilityMode.Public,
          priority: 0,
          preventCompletion: false,
          type: ActionTaskType.Activity,
          onboarding: true,
          cohortExpression: {
            type: "Tag",
            tagId: ctx.defaultTag.id,
          },
        }),
      );

      await eventRepo.save(
        eventRepo.create({
          title: "Onboarding launch",
          description: "Onboarding action live",
          newStatus: ActionStatus.MemberAction,
          date: actionEventDate,
          action: onboardingAction,
        }),
      );

      // Existing user: signed contract BEFORE the action event
      existingUser = await userService.create({
        email: `existing-onboard-${Date.now()}@example.com`,
        password: "Password123!",
        name: "Existing User",
        contractEvents: [
          {
            type: ContractEventType.SIGNED,
            date: new Date(actionEventDate.getTime() - 86400000), // 1 day before action
            automatic: false,
            contractId: ctx.defaultContractId,
          },
        ],
        tags: [ctx.defaultTag],
      });

      // New user: signed contract AFTER the action event
      newUser = await userService.create({
        email: `new-onboard-${Date.now()}@example.com`,
        password: "Password123!",
        name: "New User",
        contractEvents: [
          {
            type: ContractEventType.SIGNED,
            date: new Date(actionEventDate.getTime() + 1000), // after action event
            automatic: false,
            contractId: ctx.defaultContractId,
          },
        ],
        tags: [ctx.defaultTag],
      });

      existingUserToken = ctx.jwtService.sign(
        {
          sub: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
        },
        { secret: process.env.JWT_SECRET },
      );

      newUserToken = ctx.jwtService.sign(
        {
          sub: newUser.id,
          email: newUser.email,
          name: newUser.name,
        },
        { secret: process.env.JWT_SECRET },
      );
    });

    afterAll(async () => {
      if (onboardingAction?.id) await actionRepo.delete(onboardingAction.id);
      if (existingUser?.id) await userRepo.delete(existingUser.id);
      if (newUser?.id) await userRepo.delete(newUser.id);
    });

    it("loggedIn endpoint returns canParticipate=false for existing users on onboarding actions", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get("/actions/loggedIn")
        .set("Authorization", `Bearer ${existingUserToken}`)
        .expect(200);

      const action = res.body.find(
        (a: ActionDto) => a.id === onboardingAction.id,
      );
      expect(action).toBeDefined();
      expect(action.canParticipate).toBe(false);
    });

    it("loggedIn endpoint returns canParticipate=true for new users on onboarding actions", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get("/actions/loggedIn")
        .set("Authorization", `Bearer ${newUserToken}`)
        .expect(200);

      const action = res.body.find(
        (a: ActionDto) => a.id === onboardingAction.id,
      );
      expect(action).toBeDefined();
      expect(action.canParticipate).toBe(true);
    });

    it("individual action endpoint returns canParticipate=false for existing users on onboarding actions", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get(`/actions/slug/${onboardingAction.id}`)
        .set("Authorization", `Bearer ${existingUserToken}`)
        .expect(200);

      expect(res.body.canParticipate).toBe(false);
    });

    it("individual action endpoint returns canParticipate=true for new users on onboarding actions", async () => {
      const res = await request(ctx.app.getHttpServer())
        .get(`/actions/slug/${onboardingAction.id}`)
        .set("Authorization", `Bearer ${newUserToken}`)
        .expect(200);

      expect(res.body.canParticipate).toBe(true);
    });

    it("non-onboarding action still returns canParticipate=true for existing users", async () => {
      const { action: normalAction } = await createPublishedAction(
        "Normal Action For Onboarding Check",
        {
          status: ActionStatus.MemberAction,
          actionOverrides: { onboarding: false },
        },
      );

      const [loggedInRes, slugRes] = await Promise.all([
        request(ctx.app.getHttpServer())
          .get("/actions/loggedIn")
          .set("Authorization", `Bearer ${existingUserToken}`)
          .expect(200),
        request(ctx.app.getHttpServer())
          .get(`/actions/slug/${normalAction.id}`)
          .set("Authorization", `Bearer ${existingUserToken}`)
          .expect(200),
      ]);

      const fromList = loggedInRes.body.find(
        (a: ActionDto) => a.id === normalAction.id,
      );
      expect(fromList).toBeDefined();
      expect(fromList.canParticipate).toBe(true);
      expect(slugRes.body.canParticipate).toBe(true);

      await actionRepo.delete(normalAction.id);
    });
  });

  describe("General update schema concurrency", () => {
    const displaySchema = (text: string) => ({
      blocks: [{ type: "display", kind: "header", id: "b1", text }],
    });

    const patch = (id: number, body: Record<string, unknown>) =>
      request(ctx.app.getHttpServer())
        .patch(`/actions/generalUpdates/${id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send(body);

    it("rejects a save built on a snapshot someone else has replaced", async () => {
      const created = await request(ctx.app.getHttpServer())
        .post("/actions/generalUpdates/create")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ name: `Concurrency ${Date.now()}`, useManualCohort: false })
        .expect(201);

      const id = created.body.id as number;
      const snapshot0 = created.body.schemaSnapshotId as number;

      const v1 = await patch(id, {
        schema: displaySchema("V1"),
        expectedSchemaSnapshotId: snapshot0,
      }).expect(200);
      const snapshot1 = v1.body.schemaSnapshotId as number;
      expect(snapshot1).not.toBe(snapshot0);

      await patch(id, {
        schema: displaySchema("V2"),
        expectedSchemaSnapshotId: snapshot0,
      }).expect(409);

      const afterConflict = await request(ctx.app.getHttpServer())
        .get(`/actions/generalUpdates/admin/${id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200);
      expect(afterConflict.body.schema).toEqual(displaySchema("V1"));

      const v2 = await patch(id, {
        schema: displaySchema("V2"),
        expectedSchemaSnapshotId: snapshot1,
      }).expect(200);
      expect(v2.body.schema).toEqual(displaySchema("V2"));

      const snapshot2 = v2.body.schemaSnapshotId as number;
      await patch(id, { name: "Renamed" }).expect(200);
      const v3 = await patch(id, {
        schema: displaySchema("V3"),
        expectedSchemaSnapshotId: snapshot2,
      }).expect(200);

      const history = await ctx.dataSource.query<
        { schemaSnapshotId: number }[]
      >(
        `SELECT "schemaSnapshotId" FROM general_update_snapshot_history WHERE "generalUpdateId" = $1`,
        [id],
      );
      const recorded = history.map((row) => row.schemaSnapshotId);
      expect(recorded).toEqual(
        expect.arrayContaining([
          snapshot0,
          snapshot1,
          snapshot2,
          v3.body.schemaSnapshotId as number,
        ]),
      );
    });

    it("rejects content a display-only schema cannot hold", async () => {
      const created = await request(ctx.app.getHttpServer())
        .post("/actions/generalUpdates/create")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ name: `Validation ${Date.now()}`, useManualCohort: false })
        .expect(201);
      const id = created.body.id as number;

      await patch(id, {
        schema: {
          blocks: [
            { type: "input", kind: "text", id: "f1", label: "Your name" },
          ],
        },
        expectedSchemaSnapshotId: created.body.schemaSnapshotId as number,
      }).expect(400);
    });

    it("refuses a schema write with no snapshot to guard against", async () => {
      const created = await request(ctx.app.getHttpServer())
        .post("/actions/generalUpdates/create")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ name: `Unguarded ${Date.now()}`, useManualCohort: false })
        .expect(201);
      const id = created.body.id as number;
      const snapshot0 = created.body.schemaSnapshotId as number;

      await patch(id, { schema: displaySchema("Unguarded") }).expect(400);

      const after = await request(ctx.app.getHttpServer())
        .get(`/actions/generalUpdates/admin/${id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200);
      expect(after.body.schemaSnapshotId).toBe(snapshot0);

      await patch(id, { name: "Renamed" }).expect(200);
    });
  });

  describe("Action update notifications", () => {
    const displaySchema = (text: string) => ({
      blocks: [{ type: "display", kind: "header", id: "b1", text }],
    });

    const createUpdate = async (body: Record<string, unknown>) => {
      const now = new Date().toISOString();
      const created = await request(ctx.app.getHttpServer())
        .post(`/actions/createUpdate/${testAction.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          title: "Notify test",
          shortNotifString: "something happened",
          date: now,
          notifyType: "all_members",
          ...body,
        })
        .expect(201);
      return created.body as {
        id: number;
        notifiedAt: string | null;
        schemaSnapshotId: number;
      };
    };

    const notify = (id: number) =>
      request(ctx.app.getHttpServer())
        .post(`/actions/updates/${id}/notify`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

    const writeContent = (id: number, snapshotId: number) =>
      request(ctx.app.getHttpServer())
        .patch(`/actions/updateUpdate/${id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          schema: displaySchema("The body"),
          expectedSchemaSnapshotId: snapshotId,
        })
        .expect(200);

    const unreadCountFor = (id: number) =>
      unreadContentRepo.count({
        where: { contentType: UnreadContentType.ActionUpdate, contentId: id },
      });

    it("does not notify at creation time, when the update is still empty", async () => {
      const update = await createUpdate({});

      expect(update.notifiedAt).toBeNull();
      expect(await unreadCountFor(update.id)).toBe(0);
    });

    it("refuses to notify until the body has been written", async () => {
      const update = await createUpdate({});

      await notify(update.id).expect(400);
      expect(await unreadCountFor(update.id)).toBe(0);

      await writeContent(update.id, update.schemaSnapshotId);

      const notified = await notify(update.id).expect(200);
      expect(notified.body.notifiedAt).not.toBeNull();
      expect(await unreadCountFor(update.id)).toBeGreaterThan(0);
    });

    it("sends once, so a second attempt conflicts instead of re-notifying", async () => {
      const update = await createUpdate({});
      await writeContent(update.id, update.schemaSnapshotId);
      await notify(update.id).expect(200);

      const sent = await unreadCountFor(update.id);

      await notify(update.id).expect(409);
      expect(await unreadCountFor(update.id)).toBe(sent);
    });

    it("refuses to notify an update with no audience", async () => {
      const update = await createUpdate({ notifyType: "none" });
      await writeContent(update.id, update.schemaSnapshotId);

      await notify(update.id).expect(400);
      expect(await unreadCountFor(update.id)).toBe(0);
    });

    it("rolls the claim back when the send fails, leaving the retry open", async () => {
      const update = await createUpdate({});
      await writeContent(update.id, update.schemaSnapshotId);

      const send = jest
        .spyOn(ctx.app.get(NotifsService), "sendUnreadContents")
        .mockRejectedValue(new Error("send failed"));
      try {
        await notify(update.id).expect(500);
      } finally {
        send.mockRestore();
      }

      expect(await unreadCountFor(update.id)).toBe(0);
      const afterFailure = await request(ctx.app.getHttpServer())
        .get(`/actions/updates/admin/${update.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200);
      expect(afterFailure.body.notifiedAt).toBeNull();

      const notified = await notify(update.id).expect(200);
      expect(notified.body.notifiedAt).not.toBeNull();
      expect(await unreadCountFor(update.id)).toBeGreaterThan(0);
    });
  });

  describe("Action update visibility", () => {
    const displaySchema = (text: string) => ({
      blocks: [{ type: "display", kind: "header", id: "b1", text }],
    });

    const createUpdate = async (title: string) => {
      const created = await request(ctx.app.getHttpServer())
        .post(`/actions/createUpdate/${testAction.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          title,
          shortNotifString: "something happened",
          date: new Date().toISOString(),
          notifyType: "none",
        })
        .expect(201);
      return created.body as {
        id: number;
        visibleAt: string | null;
        schemaSnapshotId: number;
      };
    };

    const writeContent = (id: number, snapshotId: number) =>
      request(ctx.app.getHttpServer())
        .patch(`/actions/updateUpdate/${id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          schema: displaySchema("The body"),
          expectedSchemaSnapshotId: snapshotId,
        })
        .expect(200);

    const memberUpdateIds = async () => {
      const response = await request(ctx.app.getHttpServer())
        .get("/actions/updates")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);
      return (response.body as { id: number }[]).map((update) => update.id);
    };

    const updateIdsOnActionPage = async (token: string, path: string) => {
      const response = await request(ctx.app.getHttpServer())
        .get(`/actions/${path}/${testAction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      return (response.body.updates as { id: number }[]).map(
        (update) => update.id,
      );
    };

    it("keeps an update with no body off the member-facing reads", async () => {
      const update = await createUpdate("Still being written");

      expect(update.visibleAt).toBeNull();
      expect(await memberUpdateIds()).not.toContain(update.id);
      expect(
        await updateIdsOnActionPage(ctx.accessToken, "slug"),
      ).not.toContain(update.id);
    });

    it("still shows the draft to admins, who have to be able to finish it", async () => {
      const update = await createUpdate("Draft visible to admin");

      expect(
        await updateIdsOnActionPage(ctx.adminAccessToken, "adminslug"),
      ).toContain(update.id);
    });

    it("publishes the update when its body is first written", async () => {
      const update = await createUpdate("Ready to publish");
      const written = await writeContent(update.id, update.schemaSnapshotId);

      expect(written.body.visibleAt).not.toBeNull();
      expect(await memberUpdateIds()).toContain(update.id);
      expect(await updateIdsOnActionPage(ctx.accessToken, "slug")).toContain(
        update.id,
      );
    });

    it("keeps the original publish time when the body is edited again", async () => {
      const update = await createUpdate("Edited twice");
      const first = await writeContent(update.id, update.schemaSnapshotId);

      const second = await request(ctx.app.getHttpServer())
        .patch(`/actions/updateUpdate/${update.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          schema: displaySchema("A revised body"),
          expectedSchemaSnapshotId: first.body.schemaSnapshotId,
        })
        .expect(200);

      expect(second.body.visibleAt).toBe(first.body.visibleAt);
    });

    describe("unpublishing until the displayed date", () => {
      const setDate = (id: number, date: Date) =>
        request(ctx.app.getHttpServer())
          .patch(`/actions/updateUpdate/${id}`)
          .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
          .send({ date: date.toISOString() })
          .expect(200);

      const unpublish = (id: number) =>
        request(ctx.app.getHttpServer())
          .post(`/actions/updates/${id}/unpublish`)
          .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

      const publishNow = (id: number) =>
        request(ctx.app.getHttpServer())
          .post(`/actions/updates/${id}/publish-now`)
          .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

      const futureDate = () => new Date(Date.now() + 60 * 60 * 1000);

      const publishedWithFutureDate = async (title: string) => {
        const update = await createUpdate(title);
        await writeContent(update.id, update.schemaSnapshotId);
        const dated = await setDate(update.id, futureDate());
        return dated.body as { id: number; date: string; visibleAt: string };
      };

      it("hides the update from members until its displayed date", async () => {
        const update = await publishedWithFutureDate("Published too early");
        expect(await memberUpdateIds()).toContain(update.id);

        const unpublished = await unpublish(update.id).expect(200);

        expect(unpublished.body.visibleAt).toBe(update.date);
        expect(await memberUpdateIds()).not.toContain(update.id);
        expect(
          await updateIdsOnActionPage(ctx.accessToken, "slug"),
        ).not.toContain(update.id);
      });

      it("still shows the scheduled update to admins", async () => {
        const update = await publishedWithFutureDate("Scheduled but editable");
        await unpublish(update.id).expect(200);

        expect(
          await updateIdsOnActionPage(ctx.adminAccessToken, "adminslug"),
        ).toContain(update.id);
      });

      it("rejects unpublishing when the displayed date has passed", async () => {
        const update = await createUpdate("Already due");
        await writeContent(update.id, update.schemaSnapshotId);

        await unpublish(update.id).expect(400);
        expect(await memberUpdateIds()).toContain(update.id);
      });

      it("rejects unpublishing an update that was never published", async () => {
        const update = await createUpdate("Never published");
        await setDate(update.id, futureDate());

        await unpublish(update.id).expect(400);
      });

      it("republishes a scheduled update on request", async () => {
        const update = await publishedWithFutureDate("Scheduled by mistake");
        await unpublish(update.id).expect(200);

        const republished = await publishNow(update.id).expect(200);

        expect(republished.body.visibleAt).not.toBe(update.date);
        expect(await memberUpdateIds()).toContain(update.id);
      });

      it("rejects republishing an update that is already visible", async () => {
        const update = await publishedWithFutureDate("Already visible");

        await publishNow(update.id).expect(400);
      });

      it("keeps the scheduled date when the body is edited again", async () => {
        const update = await publishedWithFutureDate("Edited while scheduled");
        const unpublished = await unpublish(update.id).expect(200);

        const rewritten = await request(ctx.app.getHttpServer())
          .patch(`/actions/updateUpdate/${update.id}`)
          .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
          .send({
            schema: displaySchema("A revised body"),
            expectedSchemaSnapshotId: unpublished.body.schemaSnapshotId,
          })
          .expect(200);

        expect(rewritten.body.visibleAt).toBe(update.date);
      });
    });
  });

  describe("Reviewers", () => {
    let reviewerRepo: Repository<ActionReviewer>;

    beforeAll(() => {
      reviewerRepo = ctx.dataSource.getRepository(ActionReviewer);
    });

    const withReviewers = (
      name: string,
      reviewers: CreateActionDto["reviewers"],
      extra: Partial<CreateActionDto> = {},
    ): CreateActionDto => ({
      name,
      body: "Body",
      category: "category",
      image: "",
      timeEstimate: 5,
      shortDescription: "Short",
      visibilityMode: VisibilityMode.Public,
      type: ActionTaskType.Activity,
      isContractSigningAction: false,
      shouldCompleteAfterDeadline: false,
      isForumParticipationAction: false,
      optional: false,
      preventCompletion: false,
      publicOnly: false,
      staffPreview: false,
      onboarding: false,
      reviewers,
      ...extra,
    });

    const createAction = async (
      name: string,
      reviewers: CreateActionDto["reviewers"],
      extra: Partial<CreateActionDto> = {},
    ) => {
      const res = await request(ctx.app.getHttpServer())
        .post("/actions/create")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send(withReviewers(name, reviewers, extra));
      expect(res.status).toBe(201);
      return res.body as ActionDto;
    };

    it("stores reviewers in the order they were sent", async () => {
      const action = await createAction("Reviewed Action", [
        {
          name: "Jane",
          url: "https://example.com",
          icon: ActionReviewerIcon.LinkedIn,
        },
        { name: "Bob" },
      ]);

      expect(action.reviewers).toEqual([
        { name: "Jane", url: "https://example.com", icon: "linkedin" },
        { name: "Bob" },
      ]);

      const rows = await reviewerRepo.find({
        where: { actionId: action.id },
        order: { position: "ASC" },
      });
      expect(rows.map((row) => [row.name, row.position])).toEqual([
        ["Jane", 0],
        ["Bob", 1],
      ]);
    });

    it("rejects a nameless reviewer instead of failing to build the DTO", async () => {
      const res = await request(ctx.app.getHttpServer())
        .post("/actions/create")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send(
          withReviewers("Nameless Reviewer", [
            { url: "https://example.com" },
          ] as CreateActionDto["reviewers"]),
        );

      expect(res.status).toBe(400);
    });

    it("replaces the whole list on update", async () => {
      const action = await createAction("Replaced Reviewers", [
        { name: "Jane" },
        { name: "Bob" },
      ]);

      const res = await request(ctx.app.getHttpServer())
        .patch(`/actions/${action.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ reviewers: [{ name: "Carol" }] })
        .expect(200);

      expect(res.body.reviewers).toEqual([{ name: "Carol" }]);
      expect(await reviewerRepo.countBy({ actionId: action.id })).toBe(1);
    });

    it("leaves reviewers alone when the update omits them", async () => {
      const action = await createAction("Kept Reviewers", [{ name: "Jane" }]);

      const res = await request(ctx.app.getHttpServer())
        .patch(`/actions/${action.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ name: "Kept Reviewers Renamed" })
        .expect(200);

      expect(res.body.reviewers).toEqual([{ name: "Jane" }]);
    });

    it("loads reviewers for the public list and the timeline feed", async () => {
      const action = await createAction("Widely Served", [{ name: "Jane" }]);
      const entity = await actionRepo.findOneOrFail({
        where: { id: action.id },
      });
      await eventRepo.save([
        eventRepo.create({
          title: "Planned",
          description: "Planned",
          newStatus: ActionStatus.Planned,
          date: new Date(Date.now() - 1000 * 60 * 60 * 2),
          action: entity,
        }),
        eventRepo.create({
          title: "Started",
          description: "Started",
          newStatus: ActionStatus.MemberAction,
          date: new Date(Date.now() - 1000 * 60 * 60),
          action: entity,
        }),
      ]);

      const timelineRes = await request(ctx.app.getHttpServer())
        .get("/actions/timeline-feed")
        .expect(200);
      expect(
        timelineRes.body.find(
          (item: { action: ActionDto }) => item.action.id === action.id,
        )?.action.reviewers,
      ).toEqual([{ name: "Jane" }]);
    });

    it("loads reviewers for suite actions and for archive/unarchive", async () => {
      const suite = await request(ctx.app.getHttpServer())
        .post("/actions/createSuite")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ name: "Reviewed Suite" })
        .expect(201);

      const action = await createAction("Suited Action", [{ name: "Jane" }], {
        suiteId: suite.body.id,
      });

      const suiteRes = await request(ctx.app.getHttpServer())
        .get(`/actions/suite/${suite.body.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200);
      expect(
        suiteRes.body.actions.find((a: ActionDto) => a.id === action.id)
          ?.reviewers,
      ).toEqual([{ name: "Jane" }]);

      const archived = await request(ctx.app.getHttpServer())
        .post(`/actions/archive/${action.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(201);
      expect(archived.body.reviewers).toEqual([{ name: "Jane" }]);

      const unarchived = await request(ctx.app.getHttpServer())
        .post(`/actions/unarchive/${action.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(201);
      expect(unarchived.body.reviewers).toEqual([{ name: "Jane" }]);
    });

    it("round-trips reviewers through export and pasteJson", async () => {
      const action = await createAction("Exported Action", [
        { name: "Jane", url: "https://example.com" },
        { name: "Bob" },
      ]);

      const exported = await request(ctx.app.getHttpServer())
        .get(`/actions/export/${action.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200);
      expect(exported.body.reviewers).toHaveLength(2);

      const imported = await request(ctx.app.getHttpServer())
        .post("/actions/pasteJson")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ body: JSON.stringify(exported.body) })
        .expect(201);
      expect(imported.body.reviewers).toEqual([
        { name: "Jane", url: "https://example.com" },
        { name: "Bob" },
      ]);
    });
  });

  describe("Cohort expression exposure", () => {
    let manualCohort: { type: string; userIds: number[] };
    let targetedActionId: number;

    beforeAll(async () => {
      manualCohort = { type: "Manual", userIds: [ctx.testUserId] };
      const created = await request(ctx.app.getHttpServer())
        .post("/actions/create")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          name: "Targeted Action",
          body: "Body",
          category: "category",
          image: "",
          timeEstimate: 5,
          shortDescription: "Short",
          visibilityMode: VisibilityMode.Public,
          type: ActionTaskType.Activity,
          isContractSigningAction: false,
          shouldCompleteAfterDeadline: false,
          isForumParticipationAction: false,
          optional: false,
          preventCompletion: false,
          publicOnly: false,
          staffPreview: false,
          onboarding: false,
          cohortExpression: manualCohort,
        })
        .expect(201);
      targetedActionId = created.body.id as number;

      const { form } = await createFormWithSnapshot(ctx.dataSource, {
        title: "Targeted Follow-up",
        schema: { title: "Targeted Follow-up", pages: [], outputViews: [] },
      });
      await request(ctx.app.getHttpServer())
        .post(`/actions/${targetedActionId}/follow-up-forms`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          actionId: targetedActionId,
          formId: form.id,
          cohortExpression: manualCohort,
        })
        .expect(201);

      await eventRepo.save(
        eventRepo.create({
          title: "Started",
          description: "Started",
          newStatus: ActionStatus.MemberAction,
          date: new Date(Date.now() - 1000 * 60 * 60),
          action: await actionRepo.findOneOrFail({
            where: { id: targetedActionId },
          }),
        }),
      );
    });

    it("serves cohort expressions to admins and to no one else", async () => {
      const publicRes = await request(ctx.app.getHttpServer())
        .get(`/actions/slug/${targetedActionId}`)
        .expect(200);
      const served = publicRes.body as ActionDto;
      expect(served.id).toBe(targetedActionId);
      expect(served.followUpForms).toEqual([]);
      expect(JSON.stringify(publicRes.body)).not.toContain("cohortExpression");

      const adminRes = await request(ctx.app.getHttpServer())
        .get(`/actions/adminslug/${targetedActionId}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200);
      expect(adminRes.body.cohortExpression).toEqual(manualCohort);
      expect(adminRes.body.followUpForms[0].cohortExpression).toEqual(
        manualCohort,
      );
    });

    it("serves a targeted follow-up form to the member it targets", async () => {
      const memberRes = await request(ctx.app.getHttpServer())
        .get("/actions/loggedIn")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);
      const served = memberRes.body.find(
        (a: ActionDto) => a.id === targetedActionId,
      ) as ActionDto | undefined;
      expect(served?.followUpForms).toHaveLength(1);
    });

    it("takes back an action the admin loaded, follow-up forms and all", async () => {
      const adminRes = await request(ctx.app.getHttpServer())
        .get(`/actions/adminslug/${targetedActionId}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      const saved = await request(ctx.app.getHttpServer())
        .patch(`/actions/${targetedActionId}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          name: "Targeted Action, renamed",
          cohortExpression: adminRes.body.cohortExpression,
          followUpForms: adminRes.body.followUpForms,
        })
        .expect(200);
      expect(saved.body.name).toBe("Targeted Action, renamed");
      expect(saved.body.cohortExpression).toEqual(manualCohort);
    });
  });

  describe("Image columns", () => {
    const coverKey = "1770253183572.webp";
    const thumbnailKey = "1770253184000.webp";

    const actionWithImages = async (name: string) => {
      const { action } = await createPublishedAction(name, {
        actionOverrides: {
          image: coverKey,
          squareThumbnailImage: thumbnailKey,
        },
      });
      return action;
    };

    const patchImages = async (
      id: number,
      body: { image?: string | null; squareThumbnailImage?: string | null },
    ) => {
      await request(ctx.app.getHttpServer())
        .patch(`/actions/${id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send(body)
        .expect(200);
      return actionRepo.findOneByOrFail({ id });
    };

    it("keeps the keys when sent the urls it rendered", async () => {
      const action = await actionWithImages("Echoed images");

      const stored = await patchImages(action.id, {
        image: getImageSource(coverKey),
        squareThumbnailImage: getImageSource(thumbnailKey),
      });

      expect(stored.image).toBe(coverKey);
      expect(stored.squareThumbnailImage).toBe(thumbnailKey);
    });

    it("keeps the key when the url names another host", async () => {
      const action = await actionWithImages("Cloudfront echo");

      const stored = await patchImages(action.id, {
        squareThumbnailImage: `https://dj92mxbdjuclo.cloudfront.net/${thumbnailKey}`,
      });

      expect(stored.squareThumbnailImage).toBe(thumbnailKey);
    });

    it("keeps the keys when created from the urls it rendered", async () => {
      const created = await request(ctx.app.getHttpServer())
        .post("/actions/create")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          name: "Duplicated images",
          category: "",
          body: "",
          type: ActionTaskType.Activity,
          isContractSigningAction: false,
          visibilityMode: VisibilityMode.Public,
          image: getImageSource(coverKey),
          squareThumbnailImage: getImageSource(thumbnailKey),
        })
        .expect(201);

      const stored = await actionRepo.findOneByOrFail({ id: created.body.id });

      expect(stored.image).toBe(coverKey);
      expect(stored.squareThumbnailImage).toBe(thumbnailKey);
    });

    it("stores a thumbnail url the admin typed on a new action", async () => {
      const created = await request(ctx.app.getHttpServer())
        .post("/actions/create")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          name: "Typed thumbnail",
          category: "",
          body: "",
          type: ActionTaskType.Activity,
          isContractSigningAction: false,
          visibilityMode: VisibilityMode.Public,
          squareThumbnailImage: "https://example.com/promo.png",
        })
        .expect(201);

      const stored = await actionRepo.findOneByOrFail({ id: created.body.id });

      expect(stored.squareThumbnailImage).toBe("https://example.com/promo.png");
    });

    it("stores a thumbnail url whose filename looks like a key", async () => {
      const typed = "https://images.unsplash.com/images/1707862.webp";
      const created = await request(ctx.app.getHttpServer())
        .post("/actions/create")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          name: "Key-shaped thumbnail",
          category: "",
          body: "",
          type: ActionTaskType.Activity,
          isContractSigningAction: false,
          visibilityMode: VisibilityMode.Public,
          squareThumbnailImage: typed,
        })
        .expect(201);

      const stored = await actionRepo.findOneByOrFail({ id: created.body.id });

      expect(stored.squareThumbnailImage).toBe(typed);
    });

    it("clears both columns when sent null", async () => {
      const action = await actionWithImages("Cleared images");

      const stored = await patchImages(action.id, {
        image: null,
        squareThumbnailImage: null,
      });

      expect(stored.image).toBeNull();
      expect(stored.squareThumbnailImage).toBeNull();
    });

    it("stores a new upload and a thumbnail url the admin typed", async () => {
      const action = await actionWithImages("Edited images");

      const stored = await patchImages(action.id, {
        image: "1770253185000.webp",
        squareThumbnailImage: "https://example.com/promo.png",
      });

      expect(stored.image).toBe("1770253185000.webp");
      expect(stored.squareThumbnailImage).toBe("https://example.com/promo.png");
    });
  });

  afterAll(async () => {
    await actionRepo.query("DELETE FROM action");
    await ctx.app.close();
  });
});
