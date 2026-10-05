import { Logger } from "@nestjs/common";
import request from "supertest";
import { Like, type Repository } from "typeorm";
import { ActionsService } from "../src/actions/actions.service";
import { CohortDecisionService } from "../src/actions/cohort-decision.service";
import type { ActionDto } from "../src/actions/dto/action.dto";
import { ActionCohortDecision } from "../src/actions/entities/action-cohort-decision.entity";
import {
  ActionEvent,
  ActionStatus,
} from "../src/actions/entities/action-event.entity";
import {
  ActionUpdate,
  ActionUpdateNotifyType,
} from "../src/actions/entities/action-update.entity";
import { Action, VisibilityMode } from "../src/actions/entities/action.entity";
import { CohortDecisionReason } from "../src/actions/entities/cohort-decision-reason";
import { ActionEventRecipientService } from "../src/notifs/action-event-recipient.service";
import { ActionEventNotifType } from "../src/notifs/entities/action-event-notif.entity";
import {
  UnreadContent,
  UnreadContentType,
} from "../src/notifs/entities/unread-content.entity";
import { FormSnapshot } from "../src/tasks/entities/formsnapshot.entity";
import { TasksModule } from "../src/tasks/tasks.module";
import { User } from "../src/user/entities/user.entity";
import {
  addDays,
  cohortDecisionFixtures,
  type CohortDecisionFixtures,
} from "./cohort-decision-fixtures";
import { createTestApp, signAccessToken, TestContext } from "./e2e-test-utils";

describe("Member-facing reads of cohort decisions (e2e)", () => {
  let ctx: TestContext;
  let service: CohortDecisionService;
  let userRepo: Repository<User>;
  let createUser: CohortDecisionFixtures["createUser"];
  let createAction: CohortDecisionFixtures["createAction"];
  let decisionsFor: CohortDecisionFixtures["decisionsFor"];
  let failManualCohorts: CohortDecisionFixtures["failManualCohorts"];
  let cleanUp: CohortDecisionFixtures["cleanUp"];

  const now = new Date();
  const signedAt = addDays(now, -30);

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    service = ctx.app.get(CohortDecisionService);
    userRepo = ctx.dataSource.getRepository(User);
    ({ createUser, createAction, decisionsFor, failManualCohorts, cleanUp } =
      cohortDecisionFixtures(ctx));
  }, 50000);

  afterEach(() => cleanUp());

  afterAll(async () => {
    await ctx.app.close();
  });

  const feed = async (user: User) =>
    (
      await request(ctx.app.getHttpServer())
        .get("/actions/loggedIn")
        .set("Authorization", `Bearer ${signAccessToken(ctx.jwtService, user)}`)
        .expect(200)
    ).body as ActionDto[];

  const createCountryBranches = async () => ({
    us: await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
      cohortExpression: { type: "USMember" },
    }),
    nonUs: await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
      cohortExpression: { type: "NonUSMember" },
    }),
  });

  it("keeps a member on the branch they were decided into after they move", async () => {
    const member = await createUser({
      signedAt,
      timeZone: "America/New_York",
    });
    const { us, nonUs } = await createCountryBranches();
    await service.resolveAll(now);
    await userRepo.update(member.id, { timeZone: "Europe/London" });

    const actions = await feed(member);
    const usDto = actions.find((action) => action.id === us.id);
    const nonUsDto = actions.find((action) => action.id === nonUs.id);
    expect(usDto).toMatchObject({
      shouldParticipate: true,
      canParticipate: true,
      viewer: { assigned: true, canComplete: true },
    });
    expect(nonUsDto).toMatchObject({
      shouldParticipate: false,
      canParticipate: true,
      viewer: { assigned: false, canComplete: true },
    });

    await ctx.app.get(ActionsService).completeAction(us.id, member.id);
    await ctx.app.get(ActionsService).completeAction(nonUs.id, member.id);
    expect((await decisionsFor(nonUs.id)).get(member.id)?.included).toBe(false);
  });

  it("reads a closed action's saved decisions after the member moves", async () => {
    const member = await createUser({
      signedAt,
      timeZone: "America/New_York",
    });
    const closed = { start: addDays(now, -10), deadline: addDays(now, -3) };
    const us = await createAction({
      ...closed,
      cohortExpression: { type: "USMember" },
    });
    const nonUs = await createAction({
      ...closed,
      cohortExpression: { type: "NonUSMember" },
    });
    await ctx.dataSource.getRepository(ActionCohortDecision).save(
      [
        { actionId: us.id, included: true },
        { actionId: nonUs.id, included: false },
      ].map((row) => ({
        ...row,
        userId: member.id,
        reason: CohortDecisionReason.Launch,
        resolvedAt: closed.start,
      })),
    );
    await userRepo.update(member.id, { timeZone: "Europe/London" });

    const actions = await feed(member);

    expect(
      actions.find((action) => action.id === us.id)?.viewer?.assigned,
    ).toBe(true);
    expect(
      actions.find((action) => action.id === nonUs.id)?.viewer?.assigned,
    ).toBe(false);
  });

  it("decides a launched action the pass has not reached before listing it", async () => {
    const member = await createUser({ signedAt });
    const action = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
    });

    const dto = (await feed(member)).find((a) => a.id === action.id);

    expect(dto?.viewer?.assigned).toBe(true);
    expect((await decisionsFor(action.id)).get(member.id)).toMatchObject({
      included: true,
      reason: CohortDecisionReason.Launch,
    });
  });

  it("decides a launched action before showing its detail", async () => {
    const member = await createUser({ signedAt });
    const action = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
    });

    const res = await request(ctx.app.getHttpServer())
      .get(`/actions/slug/${action.id}`)
      .set("Authorization", `Bearer ${signAccessToken(ctx.jwtService, member)}`)
      .expect(200);

    expect(res.body.viewer.assigned).toBe(true);
    expect((await decisionsFor(action.id)).get(member.id)?.included).toBe(true);
  });

  it("reads a member who just signed from the live cohort until the signing writer decides them", async () => {
    const member = await createUser({ signedAt: new Date() });
    const action = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
    });

    const dto = (await feed(member)).find((a) => a.id === action.id);

    expect(dto?.viewer?.assigned).toBe(true);
    expect((await decisionsFor(action.id)).has(member.id)).toBe(false);
  });

  it("previews a planned action that has not launched from the live cohort", async () => {
    const member = await createUser({ signedAt });
    const action = await createAction({
      start: addDays(now, 1),
      deadline: addDays(now, 3),
    });
    await ctx.dataSource.getRepository(ActionEvent).save({
      title: "Planned",
      description: "",
      newStatus: ActionStatus.Planned,
      date: addDays(now, -1),
      action: { id: action.id },
    });

    const dto = (await feed(member)).find((a) => a.id === action.id);

    expect(dto?.viewer?.assigned).toBe(true);
    expect((await decisionsFor(action.id)).size).toBe(0);
  });

  it("reminds a member about the branch they were decided into after they move", async () => {
    const member = await createUser({
      signedAt,
      timeZone: "America/New_York",
    });
    const { us, nonUs } = await createCountryBranches();
    await service.resolveAll(now);
    await userRepo.update(member.id, { timeZone: "Europe/London" });

    const recipients = async (actionId: number) => {
      const events = await ctx.dataSource.getRepository(ActionEvent).find({
        where: { action: { id: actionId } },
        relations: { action: { events: true } },
      });
      const find = (status: ActionStatus) =>
        events.find((event) => event.newStatus === status) ?? null;
      const users = await ctx.app
        .get(ActionEventRecipientService)
        .findFilteredUsersForEvent(
          find(ActionStatus.MemberAction)!,
          find(ActionStatus.Resolution),
          ActionEventNotifType.PersonalReminder,
        );
      return users.map((user) => user.id);
    };
    expect(await recipients(us.id)).toContain(member.id);
    expect(await recipients(nonUs.id)).not.toContain(member.id);
  });

  describe("action-update notices", () => {
    const notified = async (action: Action) => {
      const snapshot = await ctx.dataSource.getRepository(FormSnapshot).save({
        schema: {
          blocks: [{ type: "display", kind: "text", text: "update" }],
        },
        hash: `cohort-decision-member-readers-update-${action.id}`,
      });
      const update = await ctx.dataSource.getRepository(ActionUpdate).save({
        action,
        title: "Update",
        date: now,
        shortNotifString: "Update",
        notifyType: ActionUpdateNotifyType.ActionCohort,
        schemaSnapshotId: snapshot.id,
      });
      await ctx.app.get(ActionsService).notifyActionUpdate(update.id);
      return (
        await ctx.dataSource.getRepository(UnreadContent).find({
          where: {
            contentType: UnreadContentType.ActionUpdate,
            contentId: update.id,
          },
          relations: { user: true },
        })
      ).map((row) => row.user?.id);
    };

    afterEach(async () => {
      await ctx.dataSource.query("DELETE FROM unread_content");
      await ctx.dataSource.query("DELETE FROM action_update");
      await ctx.dataSource.getRepository(FormSnapshot).delete({
        hash: Like("cohort-decision-member-readers-update-%"),
      });
    });

    it("reach the branch a member was decided into after they move", async () => {
      const member = await createUser({
        signedAt,
        timeZone: "America/New_York",
      });
      const { us, nonUs } = await createCountryBranches();
      await service.resolveAll(now);
      await userRepo.update(member.id, { timeZone: "Europe/London" });

      expect(await notified(us)).toContain(member.id);
      expect(await notified(nonUs)).not.toContain(member.id);
    });

    it("decide a launched action the pass has not reached before sending", async () => {
      const member = await createUser({ signedAt });
      const action = await createAction({
        start: addDays(now, -1),
        deadline: addDays(now, 3),
      });

      expect(await notified(action)).toContain(member.id);
      expect((await decisionsFor(action.id)).get(member.id)?.included).toBe(
        true,
      );
    });

    it("leave a public-only action undecided", async () => {
      await createUser({ signedAt });
      const action = await createAction({
        start: addDays(now, -1),
        deadline: addDays(now, 3),
      });
      await ctx.dataSource
        .getRepository(Action)
        .update(action.id, { publicOnly: true });

      await notified(action);

      expect((await decisionsFor(action.id)).size).toBe(0);
    });
  });

  it("fails the task list rather than list it without a decision", async () => {
    const member = await createUser({ signedAt });
    const action = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
    });
    const save = jest
      .spyOn(ctx.dataSource.manager, "transaction")
      .mockRejectedValue(new Error("db down"));
    const error = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => {});

    try {
      await request(ctx.app.getHttpServer())
        .get("/actions/loggedIn")
        .set(
          "Authorization",
          `Bearer ${signAccessToken(ctx.jwtService, member)}`,
        )
        .expect(500);
    } finally {
      save.mockRestore();
      error.mockRestore();
    }
    expect((await decisionsFor(action.id)).size).toBe(0);
  });

  it("reads an action it failed to decide from the live cohort and lists the rest", async () => {
    const member = await createUser({ signedAt });
    const broken = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
      cohortExpression: { type: "Manual", userIds: [member.id] },
    });
    const healthy = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
    });
    const failing = failManualCohorts();
    const error = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => {});

    try {
      const actions = await feed(member);
      const assigned = (id: number) =>
        actions.find((action) => action.id === id)?.viewer?.assigned;
      expect(assigned(broken.id)).toBe(true);
      expect(assigned(healthy.id)).toBe(true);
      expect(error).toHaveBeenCalled();
    } finally {
      failing.mockRestore();
      error.mockRestore();
    }
    expect((await decisionsFor(broken.id)).has(member.id)).toBe(false);
    expect((await decisionsFor(healthy.id)).get(member.id)?.included).toBe(
      true,
    );
  });

  it("keeps a restricted action visible to a member decided into it who moves", async () => {
    const member = await createUser({
      signedAt,
      timeZone: "America/New_York",
    });
    const { us } = await createCountryBranches();
    await ctx.dataSource
      .getRepository(Action)
      .update(us.id, { visibilityMode: VisibilityMode.ParticipatingGroups });
    await service.resolveAll(now);
    await userRepo.update(member.id, { timeZone: "Europe/London" });

    expect((await feed(member)).some((action) => action.id === us.id)).toBe(
      true,
    );
    await request(ctx.app.getHttpServer())
      .get(`/actions/slug/${us.id}`)
      .set("Authorization", `Bearer ${signAccessToken(ctx.jwtService, member)}`)
      .expect(200);
  });

  it("shows a public-only action's detail from the live cohort", async () => {
    const member = await createUser({ signedAt });
    const action = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
    });
    await ctx.dataSource
      .getRepository(Action)
      .update(action.id, { publicOnly: true });

    const res = await request(ctx.app.getHttpServer())
      .get(`/actions/slug/${action.id}`)
      .set("Authorization", `Bearer ${signAccessToken(ctx.jwtService, member)}`)
      .expect(200);

    expect(res.body.viewer.assigned).toBe(true);
  });
});
