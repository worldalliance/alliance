import { ActionActivityType } from "@alliance/common/actionActivity";
import { NotFoundException } from "@nestjs/common";
import { addMinutes } from "date-fns";
import { ActionActivityService } from "src/actions/action-activity.service";
import { CohortDecisionService } from "src/actions/cohort-decision.service";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import { ActionCohortDecision } from "src/actions/entities/action-cohort-decision.entity";
import { Action } from "src/actions/entities/action.entity";
import { CohortDecisionReason } from "src/actions/entities/cohort-decision-reason";
import { ForumActionCompleterWorker } from "src/actions/forum-action-completer.worker";
import { CustomValidatorType } from "src/tasks/entities/customvalidator.entity";
import {
  ContractEvent,
  ContractEventType,
} from "src/user/entities/contract-event.entity";
import { User } from "src/user/entities/user.entity";
import type { Repository } from "typeorm";
import { saveLiveCohortDecisions } from "./cohort-decision-fixtures";
import { closeTestApp, createTestApp, TestContext } from "./e2e-test-utils";
import { forumCompleterFixtures } from "./forum-action-completer-fixtures";

describe("ForumActionCompleterWorker decisions and recovery (e2e)", () => {
  let ctx: TestContext;
  let worker: ForumActionCompleterWorker;
  let fx: ReturnType<typeof forumCompleterFixtures>;
  let actionRepo: Repository<Action>;
  let activityRepo: Repository<ActionActivity>;
  let userRepo: Repository<User>;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    worker = ctx.app.get(ForumActionCompleterWorker);
    fx = forumCompleterFixtures(ctx);
    actionRepo = ctx.dataSource.getRepository(Action);
    activityRepo = ctx.dataSource.getRepository(ActionActivity);
    userRepo = ctx.dataSource.getRepository(User);
  }, 50000);

  afterEach(() => fx.cleanup());

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  it("completes the responders its saved decisions admit, not the live cohort", async () => {
    const now = new Date();
    const decidedIn = await fx.createUser({
      email: "decided-in@example.com",
      name: "Decided In",
    });
    const decidedOut = await fx.createUser({
      email: "decided-out@example.com",
      name: "Decided Out",
      tags: [],
    });
    const postAuthor = await userRepo.findOneOrFail({
      where: { id: ctx.adminUserId },
    });
    const post = await fx.createPost(postAuthor, "Decisions Thread");
    const validator = await fx.createForumValidator(
      CustomValidatorType.RepliedToForumPost,
      post.id,
    );
    const form = await fx.createFormWithValidator(validator.id);
    const action = await fx.createActionWithEvents({ formId: form.id, now });
    await fx.createComment({ author: decidedIn, post, body: "Reply" });
    await fx.createComment({ author: decidedOut, post, body: "Reply" });

    await saveLiveCohortDecisions(ctx);
    await userRepo.save([
      { ...decidedIn, tags: [] },
      { ...decidedOut, tags: [ctx.defaultTag] },
    ]);
    await worker.autocompleteForumActions();

    const completionIds = (
      await activityRepo.find({
        where: { actionId: action.id, type: ActionActivityType.USER_COMPLETED },
      })
    ).map((activity) => activity.userId);
    expect(completionIds).toContain(decidedIn.id);
    expect(completionIds).not.toContain(decidedOut.id);
  });

  const createUndecidedForumAction = async (now: Date) => {
    const responder = await fx.createUser({
      email: `undecided-${now.getTime()}@example.com`,
      name: "Undecided",
    });
    await ctx.dataSource.getRepository(ContractEvent).save({
      user: { id: responder.id },
      type: ContractEventType.SIGNED,
      date: addMinutes(now, -20),
      contract: { id: ctx.defaultContractId },
    });
    const postAuthor = await userRepo.findOneOrFail({
      where: { id: ctx.adminUserId },
    });
    const post = await fx.createPost(postAuthor, "Undecided Thread");
    const validator = await fx.createForumValidator(
      CustomValidatorType.RepliedToForumPost,
      post.id,
    );
    const form = await fx.createFormWithValidator(validator.id);
    const action = await fx.createActionWithEvents({ formId: form.id, now });
    await fx.createComment({ author: responder, post, body: "Reply" });
    return { action, responder };
  };

  it("decides the members the decision pass has not reached", async () => {
    const { action, responder } = await createUndecidedForumAction(new Date());
    const signer = await fx.createUser({
      email: "signer@example.com",
      name: "Signer",
    });
    await ctx.dataSource.getRepository(ActionCohortDecision).save({
      actionId: action.id,
      userId: signer.id,
      included: true,
      reason: CohortDecisionReason.Signing,
      resolvedAt: new Date(),
    });

    await worker.autocompleteForumActions();

    const completionIds = (
      await activityRepo.find({
        where: { actionId: action.id, type: ActionActivityType.USER_COMPLETED },
      })
    ).map((activity) => activity.userId);
    expect(completionIds).toContain(responder.id);
  });

  it("retries an archived action instead of skipping members it hides", async () => {
    const { action } = await createUndecidedForumAction(new Date());
    await actionRepo.update(action.id, { archived: true });

    await expect(worker.autocompleteForumActions()).rejects.toThrow(
      NotFoundException,
    );

    expect(
      (await actionRepo.findOneOrFail({ where: { id: action.id } }))
        .computedAutocompleteAt,
    ).toBeNull();
  });

  it("marks an action computed past a member deleted mid-run", async () => {
    const { action, responder } = await createUndecidedForumAction(new Date());
    const actionActivityService = ctx.app.get(ActionActivityService);
    const completeAction = actionActivityService.completeAction.bind(
      actionActivityService,
    );
    const complete = jest
      .spyOn(actionActivityService, "completeAction")
      .mockImplementation(async (...args) => {
        await userRepo.softDelete(responder.id);
        return completeAction(...args);
      });

    await worker.autocompleteForumActions();
    complete.mockRestore();

    expect(await activityRepo.findBy({ actionId: action.id })).toHaveLength(0);
    expect(
      (await actionRepo.findOneOrFail({ where: { id: action.id } }))
        .computedAutocompleteAt,
    ).toBeInstanceOf(Date);
  });

  it("stops at an action deleted mid-run without marking it computed", async () => {
    const { action } = await createUndecidedForumAction(new Date());
    const actionActivityService = ctx.app.get(ActionActivityService);
    const completeAction = actionActivityService.completeAction.bind(
      actionActivityService,
    );
    const complete = jest
      .spyOn(actionActivityService, "completeAction")
      .mockImplementation(async (...args) => {
        await actionRepo.softDelete(action.id);
        return completeAction(...args);
      });

    await worker.autocompleteForumActions();
    complete.mockRestore();

    expect(
      (
        await actionRepo.findOneOrFail({
          where: { id: action.id },
          withDeleted: true,
        })
      ).computedAutocompleteAt,
    ).toBeNull();
  });

  it("retries an action whose cohort fails to decide", async () => {
    const { action } = await createUndecidedForumAction(new Date());
    const decide = jest
      .spyOn(ctx.app.get(CohortDecisionService), "decideOpenAction")
      .mockRejectedValue(new Error("cohort failed"));

    await worker.autocompleteForumActions();
    decide.mockRestore();

    expect(
      (await actionRepo.findOneOrFail({ where: { id: action.id } }))
        .computedAutocompleteAt,
    ).toBeNull();
  });
});
