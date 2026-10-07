import { ActionActivityType } from "@alliance/common/actionActivity";
import type { FormSchema } from "@alliance/common/forms/form-schema";
import { milliseconds } from "date-fns";
import { ActionsService } from "src/actions/actions.service";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
import {
  ReminderGroup,
  ReminderGroupTimingMode,
} from "src/actions/entities/reminder-group.entity";
import { DetectableEntity } from "src/ai-detection/entities/ai-detection-result.entity";
import { EntityResolverService } from "src/ai-detection/entity-resolver.service";
import { AnalyticsModule } from "src/analytics/analytics.module";
import { AnalyticsService } from "src/analytics/analytics.service";
import { ClusterModule } from "src/cluster/cluster.module";
import { ClusterService } from "src/cluster/cluster.service";
import {
  Comment,
  CommentParentObject,
} from "src/forum/entities/comment.entity";
import { EmailStatus, EmailType, Mail } from "src/mail/mail.entity";
import { Mms } from "src/mms/mms.entity";
import { ActionEventNotif } from "src/notifs/entities/action-event-notif.entity";
import { FormSnapshot } from "src/tasks/entities/formsnapshot.entity";
import { countVariableAggregates } from "src/tasks/variable-aggregates";
import {
  ContractEvent,
  ContractEventType,
} from "src/user/entities/contract-event.entity";
import { Friend, FriendStatus } from "src/user/entities/friend.entity";
import { User } from "src/user/entities/user.entity";
import request from "supertest";
import type { Repository } from "typeorm";
import { saveLiveCohortDecisions } from "./cohort-decision-fixtures";
import {
  createFormSnapshot,
  createFormWithSnapshot,
  createTestApp,
  type TestContext,
} from "./e2e-test-utils";

describe("Raw SQL reads skip soft-deleted rows (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let actionRepo: Repository<Action>;
  let eventRepo: Repository<ActionEvent>;
  let activityRepo: Repository<ActionActivity>;
  let contractEventRepo: Repository<ContractEvent>;
  let commentRepo: Repository<Comment>;
  let actionsService: ActionsService;

  const daysAgo = (days: number) =>
    new Date(Date.now() - milliseconds({ days }));

  const member = (
    contractEvents: { type: ContractEventType; date: Date }[] = [],
    overrides: Partial<User> = {},
  ) =>
    userRepo.save(
      userRepo.create({
        email: `raw-sql-${crypto.randomUUID()}@example.com`,
        password: "Password123!",
        name: "Raw SQL member",
        tags: [ctx.defaultTag],
        contractEvents: contractEvents.map((event) => ({
          ...event,
          contractId:
            event.type === ContractEventType.SIGNED
              ? ctx.defaultContractId
              : undefined,
        })),
        ...overrides,
      }),
    );

  const contractEvent = (userId: number, type: ContractEventType, date: Date) =>
    contractEventRepo.findOneByOrFail({ user: { id: userId }, type, date });

  const publishedAction = async (
    name: string,
    overrides: Partial<Action> = {},
    launchedAt = daysAgo(1),
  ) => {
    const action = await actionRepo.save(
      actionRepo.create({
        name,
        category: [],
        body: "Body copy",
        shortDescription: name,
        visibilityMode: VisibilityMode.Public,
        cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
        ...overrides,
      }),
    );
    const event = await eventRepo.save(
      eventRepo.create({
        title: `${name} launch`,
        description: "Action live",
        newStatus: ActionStatus.MemberAction,
        date: launchedAt,
        action,
      }),
    );
    return { action, event };
  };

  const activity = (params: {
    userId: number;
    actionId: number;
    type?: ActionActivityType;
    createdAt?: Date;
  }) =>
    activityRepo.save(
      activityRepo.create({
        type: ActionActivityType.USER_COMPLETED,
        ...params,
      }),
    );

  const comment = (params: {
    authorId: number;
    parentObjectType: CommentParentObject;
    parentObjectId: number;
  }) =>
    commentRepo.save({
      ...params,
      editableContent: { body: "Hello", attachments: [] },
    });

  beforeAll(async () => {
    ctx = await createTestApp([AnalyticsModule, ClusterModule]);
    userRepo = ctx.dataSource.getRepository(User);
    actionRepo = ctx.dataSource.getRepository(Action);
    eventRepo = ctx.dataSource.getRepository(ActionEvent);
    activityRepo = ctx.dataSource.getRepository(ActionActivity);
    contractEventRepo = ctx.dataSource.getRepository(ContractEvent);
    commentRepo = ctx.dataSource.getRepository(Comment);
    actionsService = ctx.app.get(ActionsService);
  }, 50000);

  afterAll(async () => {
    await ctx?.app.close();
  });

  // Runs first: it clusters every member with an active contract, and two
  // friends only share a cluster while the members fit in one.
  it("clusters only live members and ignores deleted friendships", async () => {
    const signed = [{ type: ContractEventType.SIGNED, date: daysAgo(30) }];
    const [first, second, deleted] = await Promise.all([
      member(signed),
      member(signed),
      member(signed),
    ]);
    const friendRepo = ctx.dataSource.getRepository(Friend);
    const friendship = await friendRepo.save(
      friendRepo.create({
        requester: first,
        addressee: second,
        status: FriendStatus.Accepted,
      }),
    );
    await friendRepo.softDelete(friendship.id);
    await userRepo.softDelete(deleted.id);

    expect(await ctx.app.get(ClusterService).reassignAllUsers()).toEqual({
      clustersCreated: 1,
      usersAssigned: 2,
    });
    const clusterOf = async (id: number) =>
      (
        await userRepo.findOneOrFail({
          where: { id },
          withDeleted: true,
          relations: { cluster: true },
        })
      ).cluster?.id ?? null;
    expect(await clusterOf(first.id)).not.toBeNull();
    expect(await clusterOf(second.id)).toBe(await clusterOf(first.id));
    expect(await clusterOf(deleted.id)).toBeNull();
  });

  it("builds the welcome queue from live completions, signings, tasks and staff comments", async () => {
    const launchedAt = new Date("2018-01-01");
    const signed = [
      { type: ContractEventType.SIGNED, date: new Date("2019-01-01") },
    ];
    const { action: current } = await publishedAction(
      "Current onboarding task",
      { onboarding: true },
      launchedAt,
    );
    const { action: archived } = await publishedAction(
      "Archived onboarding task",
      { onboarding: true, archived: true },
      launchedAt,
    );
    const { action: removed } = await publishedAction(
      "Removed onboarding task",
      { onboarding: true },
      launchedAt,
    );
    const staff = await member(signed, { staff: true });
    const completeCurrent = (userId: number) =>
      activity({
        userId,
        actionId: current.id,
        createdAt: new Date("2020-01-01"),
      });
    const deletedStaff = await member(signed, { staff: true });
    const greetedOn = async (
      userId: number,
      actionId: number,
      greeter = staff,
    ) => {
      const greeted = await activity({ userId, actionId });
      await comment({
        authorId: greeter.id,
        parentObjectType: CommentParentObject.Activity,
        parentObjectId: greeted.id,
      });
      return greeted;
    };

    const live = await member(signed);
    await completeCurrent(live.id);

    const completionDeleted = await member(signed);
    await activityRepo.softDelete(
      (await completeCurrent(completionDeleted.id)).id,
    );

    const signingDeleted = await member(signed);
    await completeCurrent(signingDeleted.id);
    await contractEventRepo.softDelete(
      (
        await contractEvent(
          signingDeleted.id,
          ContractEventType.SIGNED,
          signed[0].date,
        )
      ).id,
    );

    const greetedOnDeletedTask = await member(signed);
    await completeCurrent(greetedOnDeletedTask.id);
    await greetedOn(greetedOnDeletedTask.id, removed.id);

    const greetedOnDeletedCompletion = await member(signed);
    await completeCurrent(greetedOnDeletedCompletion.id);
    await activityRepo.softDelete(
      (await greetedOn(greetedOnDeletedCompletion.id, archived.id)).id,
    );

    const greetedByDeletedStaff = await member(signed);
    await completeCurrent(greetedByDeletedStaff.id);
    await greetedOn(greetedByDeletedStaff.id, archived.id, deletedStaff);
    await userRepo.softDelete(deletedStaff.id);

    await actionRepo.softDelete(removed.id);
    await saveLiveCohortDecisions(ctx);
    const queue = await actionsService.findWelcomeQueue();
    expect(
      queue.members.map((entry) => entry.user.id).sort((a, b) => a - b),
    ).toEqual(
      [
        live.id,
        greetedOnDeletedTask.id,
        greetedOnDeletedCompletion.id,
        greetedByDeletedStaff.id,
      ].sort((a, b) => a - b),
    );
  });

  it("restores a deleted form snapshot whose schema is saved again", async () => {
    const schema = { title: `Snapshot ${crypto.randomUUID()}` };
    const deleted = await createFormSnapshot(ctx.dataSource, schema);
    await ctx.dataSource.getRepository(FormSnapshot).softDelete(deleted.id);

    const saved = await createFormSnapshot(ctx.dataSource, schema);
    expect(saved.id).toBe(deleted.id);
    expect(saved.deletedAt).toBeNull();
  });

  it("lists a new member whose earlier signing is soft-deleted", async () => {
    const [firstSigning, latestSigning] = [daysAgo(30), daysAgo(2)];
    const resigned = await member([
      { type: ContractEventType.SIGNED, date: firstSigning },
      { type: ContractEventType.SIGNED, date: latestSigning },
    ]);
    await contractEventRepo.softDelete(
      (await contractEvent(resigned.id, ContractEventType.SIGNED, firstSigning))
        .id,
    );

    const ids = (await actionsService.getNewMembers(100)).map(
      (profile) => profile.id,
    );
    expect(ids).toContain(resigned.id);
  });

  it("lists only members whose task activity is live", async () => {
    const { action } = await publishedAction("Feed task");
    const [live, deleted] = await Promise.all([member(), member()]);
    await activity({ userId: live.id, actionId: action.id });
    await activityRepo.softDelete(
      (await activity({ userId: deleted.id, actionId: action.id })).id,
    );

    const members = await actionsService.getActivityGroupMembers(
      action.id,
      ActionActivityType.USER_COMPLETED,
      100,
      undefined,
      ctx.adminUserId,
    );
    expect(members.map((profile) => profile.id)).toEqual([live.id]);
  });

  it("lists only members whose comment on a post is live", async () => {
    const postId: number = (
      await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          title: "Discussion",
          editableContent: { body: "Post body", attachments: [] },
        })
        .expect(201)
    ).body.id;
    const [live, deleted] = await Promise.all([member(), member()]);
    const onPost = {
      parentObjectType: CommentParentObject.Post,
      parentObjectId: postId,
    };
    await comment({ authorId: live.id, ...onPost });
    await commentRepo.softDelete(
      (await comment({ authorId: deleted.id, ...onPost })).id,
    );

    const members = await actionsService.getForumCommentMembers(postId, 100);
    expect(members.map((profile) => profile.id)).toEqual([live.id]);
  });

  describe("form responses", () => {
    const schema: FormSchema = {
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "employers",
              type: "input",
              kind: "multiselect",
              label: "Employers",
              options: [
                { label: "Zero", value: "company-0" },
                { label: "One", value: "company-1" },
              ],
            },
          ],
        },
      ],
      outputViews: [],
    };

    const respond = async (params: {
      formId: number;
      formSnapshotId: number;
      userId: number;
      employers: string[];
      createdAt: Date;
    }): Promise<number> => {
      const [{ id }] = await ctx.dataSource.query(
        `INSERT INTO form_response ("formId", "formSnapshotId", "userId", answers, "createdAt")
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          params.formId,
          params.formSnapshotId,
          params.userId,
          { employers: params.employers },
          params.createdAt,
        ],
      );
      return id;
    };

    const softDeleteResponse = (id: number) =>
      ctx.dataSource.query(
        `UPDATE form_response SET "deletedAt" = NOW() WHERE id = $1`,
        [id],
      );

    it("counts aggregates from live responses and live withdrawals", async () => {
      const { form, snapshot } = await createFormWithSnapshot(ctx.dataSource, {
        title: "Source",
        schema,
      });
      const at = { formId: form.id, formSnapshotId: snapshot.id };
      const [replaced, withdrawalDeleted] = await Promise.all([
        member(),
        member(),
      ]);
      await respond({
        ...at,
        userId: replaced.id,
        employers: ["company-0"],
        createdAt: new Date("2026-01-01"),
      });
      await softDeleteResponse(
        await respond({
          ...at,
          userId: replaced.id,
          employers: ["company-1"],
          createdAt: new Date("2026-01-02"),
        }),
      );
      const { action } = await publishedAction("Withdrawable task");
      const withdrawn = await respond({
        ...at,
        userId: withdrawalDeleted.id,
        employers: ["company-0"],
        createdAt: new Date("2026-01-01"),
      });
      await ctx.dataSource.query(
        `INSERT INTO action_activity ("actionId", "userId", type, "taskFormResponseId", "deletedAt")
         VALUES ($1, $2, $3, $4, NOW())`,
        [
          action.id,
          withdrawalDeleted.id,
          ActionActivityType.USER_WONT_COMPLETE,
          withdrawn,
        ],
      );

      const [aggregate] = await countVariableAggregates({
        em: ctx.dataSource.manager,
        sources: [{ sourceFormId: form.id, fieldId: "employers" }],
      });
      expect(aggregate.counts).toEqual({ "company-0": 2, "company-1": 0 });
    });

    it("resolves only live comments and form responses for AI detection", async () => {
      const resolver = new EntityResolverService(ctx.dataSource);
      const author = await member();
      const { form, snapshot } = await createFormWithSnapshot(ctx.dataSource, {
        title: "Detected",
        schema,
      });
      const response = await respond({
        formId: form.id,
        formSnapshotId: snapshot.id,
        userId: author.id,
        employers: [],
        createdAt: new Date(),
      });
      const posted = await comment({
        authorId: author.id,
        parentObjectType: CommentParentObject.Post,
        parentObjectId: 0,
      });

      await expect(
        resolver.resolve(DetectableEntity.Comment, posted.id),
      ).resolves.toMatchObject({ id: posted.id });
      await expect(
        resolver.resolve(DetectableEntity.FormResponse, response),
      ).resolves.toMatchObject({ id: response });

      await commentRepo.softDelete(posted.id);
      await softDeleteResponse(response);
      await expect(
        resolver.resolve(DetectableEntity.Comment, posted.id),
      ).rejects.toThrow(`Comment ${posted.id} was not found`);
      await expect(
        resolver.resolve(DetectableEntity.FormResponse, response),
      ).rejects.toThrow(`FormResponse ${response} was not found`);
    });
  });

  it("summarizes reminder clicks from live notifications, mail and texts", async () => {
    const { event } = await publishedAction("Reminded task");
    const groupRepo = ctx.dataSource.getRepository(ReminderGroup);
    const group = await groupRepo.save(
      groupRepo.create({
        name: "Reminder",
        timingMode: ReminderGroupTimingMode.EventLaunch,
        memberActionEvent: event,
        emailMessage: "",
        emailSubject: "",
        textMessage: "",
      }),
    );
    const recipient = await member();
    const mailRepo = ctx.dataSource.getRepository(Mail);
    const mmsRepo = ctx.dataSource.getRepository(Mms);
    const notifRepo = ctx.dataSource.getRepository(ActionEventNotif);
    const sent = async (params: { clicked: boolean }) => {
      const mail = await mailRepo.save(
        mailRepo.create({
          to: "reminded@example.com",
          status: EmailStatus.Sent,
          emailType: EmailType.Other,
          clickedLink: params.clicked,
        }),
      );
      const mms = await mmsRepo.save(
        mmsRepo.create({
          to: "+15550000000",
          from: "+15550000001",
          body: "Reminder",
          status: "delivered",
          twilioSid: crypto.randomUUID(),
          clickedLink: params.clicked,
        }),
      );
      const notif = await notifRepo.save(
        notifRepo.create({
          reminderGroup: group,
          user: recipient,
          mail,
          mms,
          sent: true,
        }),
      );
      return { mail, mms, notif };
    };

    await sent({ clicked: false });
    const deletedMail = await sent({ clicked: true });
    await mailRepo.softDelete(deletedMail.mail.id);
    const deletedMms = await sent({ clicked: true });
    await mmsRepo.softDelete(deletedMms.mms.id);
    const deletedNotif = await sent({ clicked: true });
    await notifRepo.softDelete(deletedNotif.notif.id);

    const points = await ctx.app
      .get(AnalyticsService)
      .getReminderGroupClickRates();
    expect(
      points.find((point) => point.reminderGroupId === group.id),
    ).toMatchObject({ emailClickRate: 0.5, textClickRate: 0.5 });
  });
});
