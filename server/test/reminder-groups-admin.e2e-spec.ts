import { milliseconds } from "date-fns";
import request from "supertest";
import {
  ActionEvent,
  ActionStatus,
  loadedActionEventAction,
} from "../src/actions/entities/action-event.entity";
import { ActionSuite } from "../src/actions/entities/action-suite.entity";
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

  it("returns a group's member event from the admin reminder group endpoints, and its derived deadline from create, update, and its suite", async () => {
    const deadline = await ctx.dataSource.getRepository(ActionEvent).save({
      title: "Deadline",
      description: "Deadline",
      newStatus: ActionStatus.Resolution,
      date: new Date(Date.now() + milliseconds({ days: 7 })),
      action: loadedActionEventAction(event),
    });
    const suite = await ctx.dataSource
      .getRepository(ActionSuite)
      .save({ name: "reminder-groups-admin e2e" });
    const admin = (req: request.Test) =>
      req.set("Authorization", `Bearer ${ctx.adminAccessToken}`);
    const expected = {
      memberActionEvent: expect.objectContaining({ id: event.id }),
      deadlineEvent: expect.objectContaining({ id: deadline.id }),
    };

    const created = await createGroup({
      ...groupBody,
      cohortType: ReminderCohortType.AllUncompleted,
      suiteId: suite.id,
    }).expect(201);
    expect(created.body).toMatchObject(expected);

    const updated = await admin(
      request(ctx.app.getHttpServer())
        .patch(`/actions/remindergroups/${created.body.id}`)
        .send({ ...groupBody, cohortType: ReminderCohortType.AllUncompleted }),
    ).expect(200);
    expect(updated.body).toMatchObject(expected);

    const listed = await admin(
      request(ctx.app.getHttpServer()).get(
        `/actions/reminderGroupsForEvent/${event.id}`,
      ),
    ).expect(200);
    expect(
      listed.body.find((group: { id: number }) => group.id === created.body.id),
    ).toMatchObject({
      memberActionEvent: expect.objectContaining({ id: event.id }),
    });

    const suiteRes = await admin(
      request(ctx.app.getHttpServer()).get(`/actions/suite/${suite.id}`),
    ).expect(200);
    expect(suiteRes.body.reminderGroups).toEqual([
      expect.objectContaining({ id: created.body.id, ...expected }),
    ]);
  });

  it.each([
    ["without a cohort type", {}],
    ["with an unknown cohort type", { cohortType: "everyone" }],
  ])("rejects a group %s", async (_label, cohort) => {
    await createGroup({ ...groupBody, ...cohort }).expect(400);
  });
});
