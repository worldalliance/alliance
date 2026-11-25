import { ActionActivityType } from "@alliance/common/actionActivity";
import { addMinutes } from "date-fns";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
import { ForumActionCompleterWorker } from "src/actions/forum-action-completer.worker";
import { CustomValidatorType } from "src/tasks/entities/customvalidator.entity";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { User } from "src/user/entities/user.entity";
import type { Repository } from "typeorm";
import { saveLiveCohortDecisions } from "./cohort-decision-fixtures";
import {
  closeTestApp,
  createFormWithSnapshot,
  createTestApp,
  TestContext,
} from "./e2e-test-utils";
import { forumCompleterFixtures } from "./forum-action-completer-fixtures";

describe("ForumActionCompleterWorker (e2e)", () => {
  let ctx: TestContext;
  let worker: ForumActionCompleterWorker;
  let fx: ReturnType<typeof forumCompleterFixtures>;
  let actionRepo: Repository<Action>;
  let eventRepo: Repository<ActionEvent>;
  let activityRepo: Repository<ActionActivity>;
  let formResponseRepo: Repository<FormResponse>;
  let userRepo: Repository<User>;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    worker = ctx.app.get(ForumActionCompleterWorker);
    fx = forumCompleterFixtures(ctx);
    actionRepo = ctx.dataSource.getRepository(Action);
    eventRepo = ctx.dataSource.getRepository(ActionEvent);
    activityRepo = ctx.dataSource.getRepository(ActionActivity);
    formResponseRepo = ctx.dataSource.getRepository(FormResponse);
    userRepo = ctx.dataSource.getRepository(User);
  }, 50000);

  afterEach(() => fx.cleanup());

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  it("autocompletes forum responders within the deadline window and runs once", async () => {
    const now = new Date();

    const responder = await fx.createUser({
      email: "responder@example.com",
      name: "Responder",
    });
    const completedViaForm = await fx.createUser({
      email: "form-complete@example.com",
      name: "Form Completer",
    });
    const completedViaActivity = await fx.createUser({
      email: "activity-complete@example.com",
      name: "Activity Completer",
    });
    const noReplyUser = await fx.createUser({
      email: "noreply@example.com",
      name: "No Reply",
    });
    const nonCohortResponder = await fx.createUser({
      email: "noncohort@example.com",
      name: "Non Cohort",
      tags: [],
    });

    const postAuthor = await userRepo.findOneOrFail({
      where: { id: ctx.adminUserId },
    });
    const post = await fx.createPost(postAuthor, "Forum Thread");

    const validator = await fx.createForumValidator(
      CustomValidatorType.RepliedToForumPost,
      post.id,
    );
    const form = await fx.createFormWithValidator(validator.id);

    const action = await fx.createActionWithEvents({
      formId: form.id,
      now,
    });

    await fx.createComment({
      author: responder,
      post,
      body: "Top level reply",
    });
    await fx.createComment({
      author: completedViaForm,
      post,
      body: "Reply with form",
    });
    await fx.createComment({
      author: completedViaActivity,
      post,
      body: "Reply with activity",
    });
    await fx.createComment({
      author: nonCohortResponder,
      post,
      body: "Reply from non-cohort",
    });

    await formResponseRepo.save(
      formResponseRepo.create({
        formId: form.id,
        form,
        answers: {},
        formSnapshotId: form.formSnapshotId,
        user: completedViaForm,
      }),
    );

    await activityRepo.save(
      activityRepo.create({
        actionId: action.id,
        userId: completedViaActivity.id,
        type: ActionActivityType.USER_COMPLETED,
      }),
    );

    await saveLiveCohortDecisions(ctx);
    await worker.autocompleteForumActions();

    const completions = await activityRepo.find({
      where: { actionId: action.id, type: ActionActivityType.USER_COMPLETED },
    });
    const completionIds = completions.map((activity) => activity.userId);

    expect(completionIds).toContain(completedViaActivity.id);
    expect(completionIds).toContain(responder.id);
    expect(completionIds).not.toContain(completedViaForm.id);
    expect(completionIds).not.toContain(nonCohortResponder.id);
    expect(completionIds).not.toContain(noReplyUser.id);

    const updatedAction = await actionRepo.findOneOrFail({
      where: { id: action.id },
    });
    expect(updatedAction.computedAutocompleteAt).toBeInstanceOf(Date);

    await fx.createComment({
      author: noReplyUser,
      post,
      body: "Late reply after computed",
    });

    await saveLiveCohortDecisions(ctx);
    await worker.autocompleteForumActions();

    const completionsAfterSecondRun = await activityRepo.find({
      where: { actionId: action.id, type: ActionActivityType.USER_COMPLETED },
    });
    expect(completionsAfterSecondRun).toHaveLength(completions.length);
  });

  it("skips actions outside the 1-hour deadline window", async () => {
    const now = new Date();
    const responder = await fx.createUser({
      email: "window@example.com",
      name: "Window User",
    });

    const postAuthor = await userRepo.findOneOrFail({
      where: { id: ctx.adminUserId },
    });
    const post = await fx.createPost(postAuthor, "Window Thread");

    const validator = await fx.createForumValidator(
      CustomValidatorType.RepliedToForumPost,
      post.id,
    );
    const form = await fx.createFormWithValidator(validator.id);

    const action = await actionRepo.save(
      actionRepo.create({
        name: "Forum Action Window",
        category: [],
        body: "Action body",
        shortDescription: "Short description",
        shouldCompleteAfterDeadline: false,
        visibilityMode: VisibilityMode.Public,
        isForumParticipationAction: true,
        taskFormId: form.id,
      }),
    );

    await eventRepo.save([
      eventRepo.create({
        title: "Member phase",
        description: "Members take action",
        newStatus: ActionStatus.MemberAction,
        date: addMinutes(now, -30),
        action,
      }),
      eventRepo.create({
        title: "Resolution phase",
        description: "Deadline far away",
        newStatus: ActionStatus.Resolution,
        date: addMinutes(now, 120),
        action,
      }),
    ]);

    await fx.createComment({
      author: responder,
      post,
      body: "Reply outside window",
    });

    await saveLiveCohortDecisions(ctx);
    await worker.autocompleteForumActions();

    const completions = await activityRepo.find({
      where: { actionId: action.id, type: ActionActivityType.USER_COMPLETED },
    });
    expect(completions).toHaveLength(0);

    const updatedAction = await actionRepo.findOneOrFail({
      where: { id: action.id },
    });
    expect(updatedAction.computedAutocompleteAt).toBeNull();
  });

  it("counts child replies when using RepliedToForumPostOrChild", async () => {
    const now = new Date();
    const responder = await fx.createUser({
      email: "child@example.com",
      name: "Child Responder",
    });

    const postAuthor = await userRepo.findOneOrFail({
      where: { id: ctx.adminUserId },
    });
    const post = await fx.createPost(postAuthor, "Child Thread");

    const validator = await fx.createForumValidator(
      CustomValidatorType.RepliedToForumPostOrChild,
      post.id,
    );
    const form = await fx.createFormWithValidator(validator.id);

    const action = await fx.createActionWithEvents({
      formId: form.id,
      now,
    });

    const nonCohortCommenter = await fx.createUser({
      email: "noncohort-child@example.com",
      name: "Non Cohort Commenter",
      tags: [],
    });
    const topLevelComment = await fx.createComment({
      author: nonCohortCommenter,
      post,
      body: "Top level",
    });

    await fx.createComment({
      author: responder,
      post,
      body: "Child reply",
      parentId: topLevelComment.id,
    });

    await saveLiveCohortDecisions(ctx);
    await worker.autocompleteForumActions();

    const completions = await activityRepo.find({
      where: { actionId: action.id, type: ActionActivityType.USER_COMPLETED },
    });
    expect(completions).toHaveLength(1);
    expect(completions[0].userId).toBe(responder.id);
  });

  it("uses the manual post override instead of the form validator", async () => {
    const now = new Date();
    const overrideResponder = await fx.createUser({
      email: "override@example.com",
      name: "Override Responder",
    });
    const validatorResponder = await fx.createUser({
      email: "validator@example.com",
      name: "Validator Responder",
    });

    const postAuthor = await userRepo.findOneOrFail({
      where: { id: ctx.adminUserId },
    });
    const validatorPost = await fx.createPost(postAuthor, "Validator Thread");
    const overridePost = await fx.createPost(postAuthor, "Override Thread");

    // Form points at validatorPost, but the action overrides to overridePost.
    const validator = await fx.createForumValidator(
      CustomValidatorType.RepliedToForumPost,
      validatorPost.id,
    );
    const form = await fx.createFormWithValidator(validator.id);

    const action = await fx.createActionWithEvents({
      formId: form.id,
      now,
      forumParticipationPostId: overridePost.id,
    });

    await fx.createComment({
      author: overrideResponder,
      post: overridePost,
      body: "Reply on the override post",
    });
    await fx.createComment({
      author: validatorResponder,
      post: validatorPost,
      body: "Reply on the validator post",
    });

    await saveLiveCohortDecisions(ctx);
    await worker.autocompleteForumActions();

    const completions = await activityRepo.find({
      where: { actionId: action.id, type: ActionActivityType.USER_COMPLETED },
    });
    const completionIds = completions.map((activity) => activity.userId);

    expect(completionIds).toContain(overrideResponder.id);
    expect(completionIds).not.toContain(validatorResponder.id);
  });

  it("includes child replies when the override sets includeChildren", async () => {
    const now = new Date();
    const childResponder = await fx.createUser({
      email: "override-child@example.com",
      name: "Override Child Responder",
    });

    const postAuthor = await userRepo.findOneOrFail({
      where: { id: ctx.adminUserId },
    });
    const overridePost = await fx.createPost(
      postAuthor,
      "Override Child Thread",
    );

    // Form has no forum validator at all — only the override drives this.
    const { form } = await createFormWithSnapshot(ctx.dataSource, {
      title: "No Validator Form",
      schema: {
        title: "No Validator Form",
        pages: [],
        outputViews: [],
        aggregateViews: [],
      },
    });

    const action = await fx.createActionWithEvents({
      formId: form.id,
      now,
      forumParticipationPostId: overridePost.id,
      forumParticipationIncludeChildren: true,
    });

    const nonCohortCommenter = await fx.createUser({
      email: "override-child-top@example.com",
      name: "Override Child Top",
      tags: [],
    });
    const topLevelComment = await fx.createComment({
      author: nonCohortCommenter,
      post: overridePost,
      body: "Top level",
    });
    await fx.createComment({
      author: childResponder,
      post: overridePost,
      body: "Child reply",
      parentId: topLevelComment.id,
    });

    await saveLiveCohortDecisions(ctx);
    await worker.autocompleteForumActions();

    const completions = await activityRepo.find({
      where: { actionId: action.id, type: ActionActivityType.USER_COMPLETED },
    });
    expect(completions).toHaveLength(1);
    expect(completions[0].userId).toBe(childResponder.id);
  });
});
