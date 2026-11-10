import { addDays } from "date-fns";
import request from "supertest";
import type { Repository } from "typeorm";
import {
  ActionEvent,
  ActionStatus,
} from "../src/actions/entities/action-event.entity";
import { ActionSuite } from "../src/actions/entities/action-suite.entity";
import { Action } from "../src/actions/entities/action.entity";
import { Project } from "../src/actions/entities/project.entity";
import { ReminderGroup } from "../src/actions/entities/reminder-group.entity";
import { Form } from "../src/tasks/entities/form.entity";
import { createTestApp, type TestContext } from "./e2e-test-utils";

const announcement = {
  name: "Member Action announcement",
  timingMode: "event_launch",
  cohortType: "all_uncompleted",
  emailSubject: "New task",
  emailMessage: "Hi",
  textMessage: "Hi",
  pushMessage: "Hi",
  useSuiteTaskCount: true,
  excludeOptionalActions: false,
  excludePreviouslyNotified: false,
};

describe("Project actions (e2e)", () => {
  let ctx: TestContext;
  let actionRepo: Repository<Action>;
  let eventRepo: Repository<ActionEvent>;
  let suiteRepo: Repository<ActionSuite>;
  let projectRepo: Repository<Project>;
  let formRepo: Repository<Form>;
  let reminderRepo: Repository<ReminderGroup>;

  const server = () => ctx.app.getHttpServer();
  const asAdmin = (req: request.Test) =>
    req.set("Authorization", `Bearer ${ctx.adminAccessToken}`);

  const createInProject = (projectId: number, name: string) =>
    asAdmin(request(server()).post(`/projects/${projectId}/actions`)).send({
      name,
      shortDescription: `${name} short`,
    });

  const schedule = (actionId: number, body: object) =>
    asAdmin(request(server()).post(`/actions/${actionId}/release`)).send(body);

  const releaseBody = (launchAt: Date, reminders: object[] = []) => ({
    launch: {
      title: "Members taking action",
      description: "",
      newStatus: ActionStatus.MemberAction,
      date: launchAt.toISOString(),
    },
    deadline: {
      title: "Office taking action",
      description: "",
      newStatus: ActionStatus.OfficeAction,
      date: addDays(launchAt, 7).toISOString(),
    },
    reminders,
  });

  const liveEvents = (actionId: number) =>
    eventRepo.find({ where: { action: { id: actionId } } });

  beforeAll(async () => {
    ctx = await createTestApp([]);
    actionRepo = ctx.dataSource.getRepository(Action);
    eventRepo = ctx.dataSource.getRepository(ActionEvent);
    suiteRepo = ctx.dataSource.getRepository(ActionSuite);
    projectRepo = ctx.dataSource.getRepository(Project);
    formRepo = ctx.dataSource.getRepository(Form);
    reminderRepo = ctx.dataSource.getRepository(ReminderGroup);
  });

  afterEach(async () => {
    await actionRepo.query(`UPDATE action SET "projectId" = NULL`);
    await projectRepo.query("DELETE FROM project");
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("rejects non-admins", async () => {
    const project = await projectRepo.save({ name: "Non-admin" });
    await request(server())
      .post(`/projects/${project.id}/actions`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send({ name: "Nope", shortDescription: "Nope" })
      .expect(401);
  });

  it("creates a draft with its own suite, a blank task form and a staff cohort", async () => {
    const project = await projectRepo.save({ name: "Empty" });

    const created = await createInProject(project.id, "First step").expect(201);

    const action = await actionRepo.findOneOrFail({
      where: { id: created.body.id },
      relations: { suite: { actions: true }, project: true, events: true },
    });
    expect(action.project?.id).toBe(project.id);
    expect(action.shortDescription).toBe("First step short");
    expect(action.cohortExpression).toEqual({ type: "Staff" });
    expect(action.staffPreview).toBe(false);
    expect(action.events).toEqual([]);
    expect(action.suite?.name).toBe("First step");
    expect(action.suite?.actions?.map(({ id }) => id)).toEqual([action.id]);
    const form = await formRepo.findOneByOrFail({ id: action.taskFormId! });
    expect(form.title).toBe("First step form");
    expect(form.slug).toBe("v1");
  });

  it("copies the cohort of the last step in project order", async () => {
    const project = await projectRepo.save({ name: "Copying" });
    const launched = await actionRepo.save({
      name: "Launched",
      category: [],
      body: "x",
      project,
      cohortExpression: { type: "AllMembers" },
    });
    await eventRepo.save({
      title: "Launch",
      description: "",
      newStatus: ActionStatus.MemberAction,
      date: addDays(new Date(), -3),
      action: launched,
    });
    await actionRepo.save({
      name: "Unscheduled draft",
      category: [],
      body: "x",
      project,
      cohortExpression: { type: "CompletedAction", actionId: launched.id },
    });

    const created = await createInProject(project.id, "Next").expect(201);

    const action = await actionRepo.findOneByOrFail({ id: created.body.id });
    expect(action.cohortExpression).toEqual({
      type: "CompletedAction",
      actionId: launched.id,
    });
  });

  it("creates nothing when the action can't be saved", async () => {
    const project = await projectRepo.save({ name: "Broken cohort" });
    await actionRepo.save({
      name: "Bad cohort",
      category: [],
      body: "x",
      project,
      cohortExpression: {
        type: "Tag",
        tagId: "00000000-0000-0000-0000-000000000000",
      },
    });
    const suitesBefore = await suiteRepo.count();
    const formsBefore = await formRepo.count();

    await createInProject(project.id, "Never saved").expect(400);

    expect(await suiteRepo.count()).toBe(suitesBefore);
    expect(await formRepo.count()).toBe(formsBefore);
    expect(await actionRepo.findOneBy({ name: "Never saved" })).toBeNull();
  });

  it("404s for a missing project", async () => {
    await createInProject(999_999, "Orphan").expect(404);
  });

  it("schedules launch, deadline and reminders on the action's suite", async () => {
    const project = await projectRepo.save({ name: "Scheduling" });
    const { body } = await createInProject(project.id, "To schedule").expect(
      201,
    );
    const launchAt = addDays(new Date(), 5);

    await schedule(body.id, releaseBody(launchAt, [announcement])).expect(201);

    const events = await liveEvents(body.id);
    expect(
      events.map(({ newStatus, suiteManaged }) => ({
        newStatus,
        suiteManaged,
      })),
    ).toEqual(
      expect.arrayContaining([
        { newStatus: ActionStatus.MemberAction, suiteManaged: true },
        { newStatus: ActionStatus.OfficeAction, suiteManaged: true },
      ]),
    );
    const groups = await reminderRepo.find({
      where: { memberActionEvent: { action: { id: body.id } } },
      relations: { actionSuite: true },
    });
    expect(groups.map((group) => group.actionSuite?.id)).toEqual([
      body.suite.id,
    ]);
  });

  it("creates no events when a reminder is rejected", async () => {
    const project = await projectRepo.save({ name: "Bad reminder" });
    const { body } = await createInProject(project.id, "Rolled back").expect(
      201,
    );

    await schedule(
      body.id,
      releaseBody(addDays(new Date(), 5), [
        {
          ...announcement,
          cohortType: "group_leads_with_uncompleted",
          excludePreviouslyNotified: true,
        },
      ]),
    ).expect(400);

    expect(await liveEvents(body.id)).toEqual([]);
  });

  it("refuses a deadline before launch, a past launch, a second schedule and a shared suite", async () => {
    const project = await projectRepo.save({ name: "Refusals" });
    const { body } = await createInProject(project.id, "Refused").expect(201);
    const launchAt = addDays(new Date(), 5);

    await schedule(body.id, {
      ...releaseBody(launchAt),
      deadline: { ...releaseBody(launchAt).deadline, date: launchAt },
    }).expect(400);
    await schedule(body.id, releaseBody(addDays(new Date(), -1))).expect(400);
    expect(await liveEvents(body.id)).toEqual([]);
    await schedule(body.id, releaseBody(launchAt)).expect(201);
    await schedule(body.id, releaseBody(launchAt)).expect(400);

    const other = await createInProject(project.id, "Other").expect(201);
    await actionRepo.update(other.body.id, { suite: { id: body.suite.id } });
    await schedule(other.body.id, releaseBody(launchAt)).expect(400);
    await reschedule(body.id, { deadline: addDays(launchAt, 8) }).expect(400);
  });

  it("unschedules before launch, removing events and reminders", async () => {
    const project = await projectRepo.save({ name: "Unscheduling" });
    const { body } = await createInProject(project.id, "Undo").expect(201);
    await schedule(
      body.id,
      releaseBody(addDays(new Date(), 5), [announcement]),
    ).expect(201);

    await asAdmin(
      request(server()).delete(`/actions/${body.id}/release`),
    ).expect(200);

    expect(await liveEvents(body.id)).toEqual([]);
    expect(
      await reminderRepo.count({
        where: { memberActionEvent: { action: { id: body.id } } },
      }),
    ).toBe(0);
  });

  const reschedule = (actionId: number, body: object) =>
    asAdmin(request(server()).patch(`/actions/${actionId}/release`)).send(body);

  const eventDates = async (actionId: number) =>
    Object.fromEntries(
      (await liveEvents(actionId)).map((e) => [e.newStatus, e.date.getTime()]),
    );

  it("moves the launch and deadline together, or neither", async () => {
    const project = await projectRepo.save({ name: "Rescheduling" });
    const { body } = await createInProject(project.id, "Moved").expect(201);
    await schedule(body.id, releaseBody(addDays(new Date(), 5))).expect(201);
    const before = await eventDates(body.id);

    const launch = addDays(new Date(), 10);
    await reschedule(body.id, {
      launch,
      deadline: addDays(launch, -1),
    }).expect(400);
    expect(await eventDates(body.id)).toEqual(before);

    await reschedule(body.id, {
      launch,
      deadline: addDays(launch, 7),
    }).expect(200);
    expect(await eventDates(body.id)).toEqual({
      [ActionStatus.MemberAction]: launch.getTime(),
      [ActionStatus.OfficeAction]: addDays(launch, 7).getTime(),
    });
  });

  it("locks the launch once it has passed, but not the deadline", async () => {
    const project = await projectRepo.save({ name: "Locked launch" });
    const { body } = await createInProject(project.id, "Locked").expect(201);
    await schedule(body.id, releaseBody(addDays(new Date(), 5))).expect(201);
    const launched = addDays(new Date(), -1);
    await eventRepo.update(
      { action: { id: body.id }, newStatus: ActionStatus.MemberAction },
      { date: launched },
    );

    await reschedule(body.id, { launch: addDays(new Date(), 2) }).expect(400);
    await reschedule(body.id, { deadline: addDays(new Date(), -1) }).expect(
      400,
    );
    const deadline = addDays(new Date(), 9);
    await reschedule(body.id, { deadline }).expect(200);
    expect(await eventDates(body.id)).toEqual({
      [ActionStatus.MemberAction]: launched.getTime(),
      [ActionStatus.OfficeAction]: deadline.getTime(),
    });
  });

  it("refuses to unschedule after launch", async () => {
    const project = await projectRepo.save({ name: "Launched" });
    const { body } = await createInProject(project.id, "Live").expect(201);
    await schedule(body.id, releaseBody(addDays(new Date(), 5))).expect(201);
    await eventRepo.update(
      { action: { id: body.id }, newStatus: ActionStatus.MemberAction },
      { date: addDays(new Date(), -1) },
    );

    await asAdmin(
      request(server()).delete(`/actions/${body.id}/release`),
    ).expect(400);
  });

  it("keeps the suite when only staff preview changes", async () => {
    const project = await projectRepo.save({ name: "Staff testing" });
    const { body } = await createInProject(project.id, "Preview").expect(201);

    await asAdmin(request(server()).patch(`/actions/${body.id}`))
      .send({ staffPreview: true })
      .expect(200);

    const action = await actionRepo.findOneOrFail({
      where: { id: body.id },
      relations: { suite: true },
    });
    expect(action.staffPreview).toBe(true);
    expect(action.suite?.id).toBe(body.suite.id);
  });

  it("renames a suite only while it holds just the renamed action", async () => {
    const project = await projectRepo.save({ name: "Renaming" });
    const { body } = await createInProject(project.id, "Old name").expect(201);

    await asAdmin(request(server()).patch(`/actions/${body.id}`))
      .send({ name: "New name", suiteId: body.suite.id })
      .expect(200);
    expect((await suiteRepo.findOneByOrFail({ id: body.suite.id })).name).toBe(
      "New name",
    );

    await actionRepo.save({
      name: "Sibling",
      category: [],
      body: "x",
      suite: { id: body.suite.id },
    });
    await asAdmin(request(server()).patch(`/actions/${body.id}`))
      .send({ name: "Newer name", suiteId: body.suite.id })
      .expect(200);
    expect((await suiteRepo.findOneByOrFail({ id: body.suite.id })).name).toBe(
      "New name",
    );
  });

  it("keeps a sole-action suite's name when a save leaves the action's name as it was", async () => {
    const project = await projectRepo.save({ name: "Unchanged name" });
    const { body } = await createInProject(project.id, "Same name").expect(201);
    await suiteRepo.update(body.suite.id, { name: "Week 2: curated" });

    await asAdmin(request(server()).patch(`/actions/${body.id}`))
      .send({ name: "Same name", suiteId: body.suite.id, body: "Edited" })
      .expect(200);
    expect((await suiteRepo.findOneByOrFail({ id: body.suite.id })).name).toBe(
      "Week 2: curated",
    );
  });
});
