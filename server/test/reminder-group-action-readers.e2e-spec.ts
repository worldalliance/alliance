import { milliseconds } from "date-fns";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { Action } from "src/actions/entities/action.entity";
import {
  ReminderCohortType,
  ReminderGroup,
  ReminderGroupTimingMode,
} from "src/actions/entities/reminder-group.entity";
import { AnalyticsModule } from "src/analytics/analytics.module";
import { ActionEventNotifWorker } from "src/notifs/action-event-notif.worker";
import {
  ContractEvent,
  ContractEventType,
} from "src/user/entities/contract-event.entity";
import { User } from "src/user/entities/user.entity";
import request from "supertest";
import { saveLiveCohortDecisions } from "./cohort-decision-fixtures";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Admin reminder readers name the member event's action (e2e)", () => {
  let ctx: TestContext;
  let action: Action;
  let memberEvent: ActionEvent;
  let group: ReminderGroup;

  beforeAll(async () => {
    process.env.SEND_DEV_NOTIFS = "1";
    ctx = await createTestApp([AnalyticsModule]);
    const now = Date.now();
    await ctx.dataSource.getRepository(User).update(ctx.testUserId, {
      textByDefault: true,
      phoneNumber: "+14155550100",
    });
    await ctx.dataSource.getRepository(ContractEvent).save({
      user: { id: ctx.testUserId },
      type: ContractEventType.SIGNED,
      date: new Date(now - milliseconds({ days: 3 })),
      automatic: false,
      contractId: ctx.defaultContractId,
    });
    action = await ctx.dataSource.getRepository(Action).save({
      name: "Call your representative",
      category: [],
      body: "Body copy",
      shortDescription: "Short description",
      cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
    });
    memberEvent = await ctx.dataSource.getRepository(ActionEvent).save({
      title: "Members act",
      description: "desc",
      newStatus: ActionStatus.MemberAction,
      date: new Date(now - milliseconds({ hours: 1 })),
      action,
    });
    group = await ctx.dataSource.getRepository(ReminderGroup).save({
      name: "Nudge",
      memberActionEvent: memberEvent,
      timingMode: ReminderGroupTimingMode.Absolute,
      cohortType: ReminderCohortType.AllUncompleted,
      sendAtAbsolute: new Date(now - milliseconds({ minutes: 5 })),
      emailMessage: "Remember #{action}",
      emailSubject: "Reminder: #{action}",
      textMessage: "Remember #{action}",
      allSent: false,
    });
    await saveLiveCohortDecisions(ctx);
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it("names the action of each scheduled reminder", async () => {
    const res = await request(ctx.app.getHttpServer())
      .get("/actions/notification-schedule")
      .query({
        windowStart: new Date(
          Date.now() - milliseconds({ hours: 1 }),
        ).toISOString(),
        windowEnd: new Date().toISOString(),
      })
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);

    expect(res.body).toContainEqual(
      expect.objectContaining({
        eventId: memberEvent.id,
        actionId: action.id,
        actionName: action.name,
      }),
    );
  });

  it("fills the action into email and text previews", async () => {
    const email = await request(ctx.app.getHttpServer())
      .post(`/actions/previewEmailHtml/${memberEvent.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({
        emailSubject: "Reminder: #{action}",
        emailMessage: "Remember #{action}",
        taskCount: 1,
      })
      .expect(201);
    const text = await request(ctx.app.getHttpServer())
      .post(`/actions/previewTextMessage/${memberEvent.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ textMessage: "Remember #{action}", taskCount: 1 })
      .expect(201);

    expect(email.body.subject).toBe(`Reminder: ${action.name}`);
    expect(text.body.text).toBe(`Remember ${action.name}`);
  });

  it("names the action of each sent reminder group's click rate", async () => {
    await ctx.app.get(ActionEventNotifWorker).dispatchDueNotifs();

    const res = await request(ctx.app.getHttpServer())
      .get("/analytics/reminder-group-click-rates")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);

    expect(res.body).toEqual([
      expect.objectContaining({
        reminderGroupId: group.id,
        actionId: action.id,
        actionName: action.name,
      }),
    ]);
  });
});
