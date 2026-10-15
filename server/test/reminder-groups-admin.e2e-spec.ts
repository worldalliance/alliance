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

  it("returns null for the timing columns its timing mode leaves unset", async () => {
    const unsetTimingColumns = {
      sendAtSecondsFromDeadline: null,
      send_range_start: null,
      send_range_end: null,
      relative_range_start_seconds_from_deadline: null,
      relative_range_end_seconds_from_deadline: null,
    };
    const created = await createGroup({
      ...groupBody,
      cohortType: ReminderCohortType.AllUncompleted,
    }).expect(201);
    expect(created.body).toMatchObject({
      sendAtAbsolute: groupBody.sendAtAbsolute.toISOString(),
      ...unsetTimingColumns,
    });

    const listed = await request(ctx.app.getHttpServer())
      .get(`/actions/reminderGroupsForEvent/${event.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);
    expect(
      listed.body.find((group: { id: number }) => group.id === created.body.id),
    ).toMatchObject(unsetTimingColumns);
  });

  it("accepts a within-range group's preview without its other timing columns", async () => {
    await request(ctx.app.getHttpServer())
      .post(`/actions/events/${event.id}/checkTentativePlans`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({
        ...groupBody,
        cohortType: ReminderCohortType.AllUncompleted,
        timingMode: ReminderGroupTimingMode.WithinRange,
        sendAtAbsolute: undefined,
        send_range_start: new Date(Date.now()),
        send_range_end: new Date(Date.now() + milliseconds({ days: 2 })),
      })
      .expect(201);
  });

  describe("rejects a group that could never send, from preview, create, and update alike", () => {
    let noDeadlineEvent: ActionEvent;
    let deadlineEvent: ActionEvent;
    let nonMemberEvent: ActionEvent;

    beforeAll(async () => {
      const action = await ctx.dataSource.getRepository(Action).save({
        name: "reminder-groups-admin e2e no deadline",
        body: "reminder-groups-admin e2e no deadline",
        category: [],
      });
      noDeadlineEvent = await ctx.dataSource.getRepository(ActionEvent).save({
        title: "Member action",
        description: "Member action",
        newStatus: ActionStatus.MemberAction,
        date: new Date(Date.now() - milliseconds({ days: 1 })),
        action,
      });
      nonMemberEvent = await ctx.dataSource.getRepository(ActionEvent).save({
        title: "Launch",
        description: "Launch",
        newStatus: ActionStatus.Planned,
        date: new Date(Date.now() - milliseconds({ days: 2 })),
        action,
      });
      const deadlineAction = await ctx.dataSource.getRepository(Action).save({
        name: "reminder-groups-admin e2e with deadline",
        body: "reminder-groups-admin e2e with deadline",
        category: [],
      });
      deadlineEvent = await ctx.dataSource.getRepository(ActionEvent).save({
        title: "Member action",
        description: "Member action",
        newStatus: ActionStatus.MemberAction,
        date: new Date(Date.now() - milliseconds({ days: 1 })),
        action: deadlineAction,
      });
      await ctx.dataSource.getRepository(ActionEvent).save({
        title: "Deadline",
        description: "Deadline",
        newStatus: ActionStatus.Resolution,
        date: new Date(Date.now() + milliseconds({ days: 7 })),
        action: deadlineAction,
      });
    });

    const admin = (req: request.Test) =>
      req.set("Authorization", `Bearer ${ctx.adminAccessToken}`);
    const validBody = {
      ...groupBody,
      cohortType: ReminderCohortType.AllUncompleted,
    };
    const create = (eventId: number, body: object) =>
      admin(
        request(ctx.app.getHttpServer())
          .post(`/actions/events/${eventId}/createremindergroup`)
          .send(body),
      );
    const preview = (eventId: number, body: object) =>
      admin(
        request(ctx.app.getHttpServer())
          .post(`/actions/events/${eventId}/checkTentativePlans`)
          .send(body),
      );
    const update = async (eventId: number, body: object) => {
      const created = await create(eventId, validBody).expect(201);
      return admin(
        request(ctx.app.getHttpServer())
          .patch(`/actions/remindergroups/${created.body.id}`)
          .send(body),
      );
    };
    const invalidBodies = {
      "relative timing with no deadline or anchor": {
        event: () => noDeadlineEvent,
        body: {
          ...validBody,
          timingMode: ReminderGroupTimingMode.FromDeadline,
          sendAtAbsolute: undefined,
          sendAtSecondsFromDeadline: 3600,
        },
      },
      "a send range that starts after it ends": {
        event: () => deadlineEvent,
        body: {
          ...validBody,
          timingMode: ReminderGroupTimingMode.WithinRange,
          sendAtAbsolute: undefined,
          send_range_start: new Date(Date.now() + milliseconds({ days: 2 })),
          send_range_end: new Date(Date.now()),
        },
      },
      "a send range with no end": {
        event: () => deadlineEvent,
        body: {
          ...validBody,
          timingMode: ReminderGroupTimingMode.WithinRange,
          sendAtAbsolute: undefined,
          send_range_start: new Date(Date.now()),
        },
      },
      "a relative range that starts after it ends": {
        event: () => deadlineEvent,
        body: {
          ...validBody,
          timingMode: ReminderGroupTimingMode.WithinRelativeRange,
          sendAtAbsolute: undefined,
          relative_range_start_seconds_from_deadline: 3600,
          relative_range_end_seconds_from_deadline: 7200,
        },
      },
      "an absolute group carrying an inverted relative range": {
        event: () => deadlineEvent,
        body: {
          ...validBody,
          relative_range_start_seconds_from_deadline: 3600,
          relative_range_end_seconds_from_deadline: 7200,
        },
      },
    };

    for (const [name, submit] of Object.entries({ preview, create, update })) {
      for (const [label, { event, body }] of Object.entries(invalidBodies)) {
        it(`${name} rejects ${label}`, async () => {
          expect((await submit(event().id, body)).status).toBe(400);
        });
      }
    }

    for (const [name, submit] of Object.entries({ preview, create })) {
      it(`${name} rejects a group on an event that isn't a member action`, async () => {
        expect((await submit(nonMemberEvent.id, validBody)).status).toBe(400);
      });
    }
  });

  it.each([
    ["without a cohort type", {}],
    ["with an unknown cohort type", { cohortType: "everyone" }],
  ])("rejects a group %s", async (_label, cohort) => {
    await createGroup({ ...groupBody, ...cohort }).expect(400);
  });
});
