import { milliseconds } from "date-fns";
import request from "supertest";
import {
  ActionEvent,
  ActionStatus,
} from "../src/actions/entities/action-event.entity";
import { Action } from "../src/actions/entities/action.entity";
import {
  ReminderCohortType,
  ReminderGroup,
  ReminderGroupTimingMode,
} from "../src/actions/entities/reminder-group.entity";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Admin reminder groups (e2e)", () => {
  let ctx: TestContext;
  let event: ActionEvent;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    const action = await ctx.dataSource.getRepository(Action).save({
      name: "reminder-groups-admin e2e",
      body: "reminder-groups-admin e2e",
      category: [],
    });
    event = await ctx.dataSource.getRepository(ActionEvent).save({
      title: "Member action",
      description: "Member action",
      newStatus: ActionStatus.MemberAction,
      date: new Date(Date.now() - milliseconds({ days: 1 })),
      action,
    });
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  const groupBody = {
    name: "reminder-groups-admin e2e",
    timingMode: ReminderGroupTimingMode.Absolute,
    sendAtAbsolute: new Date(Date.now() + milliseconds({ days: 1 })),
    emailSubject: "Subject",
    emailMessage: "Hi #{firstname}",
    textMessage: "Text",
    pushMessage: "Push",
    useSuiteTaskCount: false,
    excludeOptionalActions: false,
    excludePreviouslyNotified: false,
  };

  const createGroup = (body: object) =>
    request(ctx.app.getHttpServer())
      .post(`/actions/events/${event.id}/createremindergroup`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send(body);

  it("creates and updates a group's cohort type", async () => {
    const created = await createGroup({
      ...groupBody,
      cohortType: ReminderCohortType.GroupLeadsWithUncompleted,
    }).expect(201);
    expect(created.body.cohortType).toBe(
      ReminderCohortType.GroupLeadsWithUncompleted,
    );

    const updated = await request(ctx.app.getHttpServer())
      .patch(`/actions/remindergroups/${created.body.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ ...groupBody, cohortType: ReminderCohortType.AllUncompleted })
      .expect(200);
    expect(updated.body.cohortType).toBe(ReminderCohortType.AllUncompleted);
    expect(
      await ctx.dataSource
        .getRepository(ReminderGroup)
        .findOneByOrFail({ id: created.body.id }),
    ).toMatchObject({ cohortType: ReminderCohortType.AllUncompleted });
  });

  it.each([
    ["without a cohort type", {}],
    ["with an unknown cohort type", { cohortType: "everyone" }],
  ])("rejects a group %s", async (_label, cohort) => {
    await createGroup({ ...groupBody, ...cohort }).expect(400);
  });
});
