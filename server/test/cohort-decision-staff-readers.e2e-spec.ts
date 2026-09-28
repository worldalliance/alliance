import { ActionActivityType } from "@alliance/common/actionActivity";
import request from "supertest";
import type { Repository } from "typeorm";
import { ActionsService } from "../src/actions/actions.service";
import { CohortDecisionService } from "../src/actions/cohort-decision.service";
import { ActionActivity } from "../src/actions/entities/action-activity.entity";
import { Action } from "../src/actions/entities/action.entity";
import { TasksModule } from "../src/tasks/tasks.module";
import {
  UserActionRelationPillStatus,
  type UserActionRelations,
} from "../src/user/dto/user-action-relations.dto";
import {
  UserAwayRange,
  UserAwayRangeReason,
} from "../src/user/entities/user-away-range.entity";
import { User } from "../src/user/entities/user.entity";
import {
  addDays,
  cohortDecisionFixtures,
  type CohortDecisionFixtures,
} from "./cohort-decision-fixtures";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Staff-facing reads of cohort decisions (e2e)", () => {
  let ctx: TestContext;
  let service: CohortDecisionService;
  let userRepo: Repository<User>;
  let createUser: CohortDecisionFixtures["createUser"];
  let createAction: CohortDecisionFixtures["createAction"];
  let cleanUp: CohortDecisionFixtures["cleanUp"];

  const now = new Date();
  const signedAt = addDays(now, -30);

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    service = ctx.app.get(CohortDecisionService);
    userRepo = ctx.dataSource.getRepository(User);
    ({ createUser, createAction, cleanUp } = cohortDecisionFixtures(ctx));
  }, 50000);

  afterEach(() => cleanUp());

  afterAll(async () => {
    await ctx.app.close();
  });

  const admin = (path: string) =>
    request(ctx.app.getHttpServer())
      .get(path)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);

  /** A member decided onto the US branch who has since moved abroad. */
  const decideThenMove = async () => {
    const member = await createUser({
      signedAt,
      timeZone: "America/New_York",
    });
    const window = { start: addDays(now, -1), deadline: addDays(now, 3) };
    const us = await createAction({
      ...window,
      cohortExpression: { type: "USMember" },
    });
    const nonUs = await createAction({
      ...window,
      cohortExpression: { type: "NonUSMember" },
    });
    await service.resolveAll(now);
    await userRepo.update(member.id, { timeZone: "Europe/London" });
    return { member, us, nonUs };
  };

  it("shows the status table the branch a member was decided into after they move", async () => {
    const { member, us, nonUs } = await decideThenMove();

    const body: UserActionRelations = (
      await admin(`/actions/action-relations/${member.id}`)
    ).body;

    const status = (actionId: number) =>
      body.users
        .find((user) => user.userId === member.id)
        ?.relations.find((relation) => relation.actionId === actionId)?.status;
    expect(status(us.id)).toBe(UserActionRelationPillStatus.Todo);
    expect(status(nonUs.id)).toBe(UserActionRelationPillStatus.NotRequired);
  });

  it("shows the status table a moved member away from the branch they were decided into", async () => {
    const { member, us } = await decideThenMove();
    await ctx.dataSource.getRepository(UserAwayRange).save({
      userId: member.id,
      startDate: now,
      endDate: addDays(now, 1),
      reason: UserAwayRangeReason.VACATION,
    });

    const body: UserActionRelations = (
      await admin(`/actions/action-relations/${member.id}`)
    ).body;

    expect(
      body.users
        .find((user) => user.userId === member.id)
        ?.relations.find((relation) => relation.actionId === us.id)?.status,
    ).toBe(UserActionRelationPillStatus.Away);
  });

  it("lists a moved member as incomplete on the branch they were decided into", async () => {
    const { member, us, nonUs } = await decideThenMove();

    const incomplete = async (actionId: number) =>
      (await admin(`/actions/${actionId}/incomplete-users`)).body.map(
        (user: { id: number }) => user.id,
      );
    expect(await incomplete(us.id)).toContain(member.id);
    expect(await incomplete(nonUs.id)).not.toContain(member.id);
  });

  it("counts a moved member as joined on the branch they were decided into", async () => {
    const { us, nonUs } = await decideThenMove();
    const actionsService = ctx.app.get(ActionsService);
    await actionsService.reloadUsersJoinedForAction(us.id);
    await actionsService.reloadUsersJoinedForAction(nonUs.id);

    const usersJoined = async (actionId: number) =>
      (
        await ctx.dataSource
          .getRepository(Action)
          .findOneByOrFail({ id: actionId })
      ).usersJoined;
    expect(await usersJoined(us.id)).toBe(1);
    expect(await usersJoined(nonUs.id)).toBe(0);
  });

  it("welcomes a moved member who completed the onboarding branch they were decided into", async () => {
    const member = await createUser({
      signedAt: addDays(now, -5),
      timeZone: "America/New_York",
    });
    const onboarding = await createAction({
      start: addDays(now, -10),
      deadline: null,
      onboarding: true,
      cohortExpression: { type: "USMember" },
    });
    await service.resolveAll(now);
    await userRepo.update(member.id, { timeZone: "Europe/London" });
    await ctx.dataSource.getRepository(ActionActivity).save({
      userId: member.id,
      actionId: onboarding.id,
      type: ActionActivityType.USER_COMPLETED,
    });

    const { members } = (await admin("/actions/welcome-queue")).body;

    expect(members).toContainEqual(
      expect.objectContaining({
        user: expect.objectContaining({ id: member.id }),
      }),
    );
  });

  it("holds back a member whose dependent onboarding task is not decided yet", async () => {
    const member = await createUser({ signedAt: addDays(now, -5) });
    const first = await createAction({
      start: addDays(now, -10),
      deadline: null,
      onboarding: true,
    });
    await createAction({
      start: addDays(now, -10),
      deadline: null,
      onboarding: true,
      prerequisiteActionIds: [first.id],
    });
    await service.resolveAll(now);
    await ctx.dataSource.getRepository(ActionActivity).save({
      userId: member.id,
      actionId: first.id,
      type: ActionActivityType.USER_COMPLETED,
    });

    const { members } = (await admin("/actions/welcome-queue")).body;

    expect(members).not.toContainEqual(
      expect.objectContaining({
        user: expect.objectContaining({ id: member.id }),
      }),
    );
  });
});
