import { milliseconds } from "date-fns";
import request from "supertest";
import type { Repository } from "typeorm";
import { ActionCategory } from "../src/actions/action-category";
import {
  ActionEvent,
  ActionStatus,
} from "../src/actions/entities/action-event.entity";
import { Action } from "../src/actions/entities/action.entity";
import { Project } from "../src/actions/entities/project.entity";
import { createTestApp, type TestContext } from "./e2e-test-utils";

describe("Projects (e2e)", () => {
  let ctx: TestContext;
  let actionRepo: Repository<Action>;
  let eventRepo: Repository<ActionEvent>;
  let projectRepo: Repository<Project>;

  const server = () => ctx.app.getHttpServer();
  const asAdmin = (req: request.Test) =>
    req.set("Authorization", `Bearer ${ctx.adminAccessToken}`);

  const createAction = async (params: {
    name: string;
    memberActionAt?: Date;
  }) => {
    const action = await actionRepo.save({
      name: params.name,
      category: [],
      body: "Test",
    });
    if (params.memberActionAt) {
      await eventRepo.save({
        title: "Launch",
        description: "Launch",
        newStatus: ActionStatus.MemberAction,
        date: params.memberActionAt,
        action,
      });
    }
    return action;
  };

  const actionProject = async (actionId: number) =>
    (
      await asAdmin(request(server()).get(`/actions/slug/${actionId}`)).expect(
        200,
      )
    ).body.project;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    actionRepo = ctx.dataSource.getRepository(Action);
    eventRepo = ctx.dataSource.getRepository(ActionEvent);
    projectRepo = ctx.dataSource.getRepository(Project);
  });

  afterEach(async () => {
    await actionRepo.query(`UPDATE action SET "projectId" = NULL`);
    await projectRepo.query("DELETE FROM project");
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("rejects non-admins", async () => {
    await request(server())
      .get("/projects")
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(401);
    await request(server())
      .post("/projects")
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send({ name: "Nope" })
      .expect(401);
  });

  it("creates a project with a trimmed name and lists it", async () => {
    const created = await asAdmin(request(server()).post("/projects"))
      .send({ name: "  Water quality  " })
      .expect(201);
    expect(created.body).toEqual({
      id: expect.any(Number),
      name: "Water quality",
      category: [],
    });

    const list = await asAdmin(request(server()).get("/projects")).expect(200);
    expect(list.body).toEqual([created.body]);
  });

  it("rejects a blank name and a duplicate name", async () => {
    await asAdmin(request(server()).post("/projects"))
      .send({ name: "   " })
      .expect(400);
    await asAdmin(request(server()).post("/projects"))
      .send({ name: "Dup" })
      .expect(201);
    await asAdmin(request(server()).post("/projects"))
      .send({ name: "Dup" })
      .expect(409);
  });

  it("renames a project, refusing a name another project holds", async () => {
    const a = await projectRepo.save({ name: "A" });
    await projectRepo.save({ name: "B" });

    const renamed = await asAdmin(request(server()).patch(`/projects/${a.id}`))
      .send({ name: "A2" })
      .expect(200);
    expect(renamed.body).toEqual({ id: a.id, name: "A2", category: [] });

    await asAdmin(request(server()).patch(`/projects/${a.id}`))
      .send({ name: "B" })
      .expect(409);
    await asAdmin(request(server()).patch(`/projects/999999`))
      .send({ name: "C" })
      .expect(404);
  });

  it("sets and clears a project's category, rejecting unknown or repeated values", async () => {
    const project = await projectRepo.save({ name: "Categorized" });
    const patch = () =>
      asAdmin(request(server()).patch(`/projects/${project.id}`));

    const set = await patch()
      .send({ category: [ActionCategory.Poverty, ActionCategory.Meta] })
      .expect(200);
    expect(set.body).toEqual({
      id: project.id,
      name: "Categorized",
      category: [ActionCategory.Poverty, ActionCategory.Meta],
    });

    await patch()
      .send({ category: ["climate"] })
      .expect(400);
    await patch()
      .send({ category: [ActionCategory.Poverty, ActionCategory.Poverty] })
      .expect(400);
    await patch().send({ category: "poverty" }).expect(400);

    const cleared = await patch().send({ category: [] }).expect(200);
    expect(cleared.body.category).toEqual([]);
    expect((await projectRepo.findOneByOrFail({ id: project.id })).name).toBe(
      "Categorized",
    );
  });

  it("assigns and clears an action's project", async () => {
    const project = await projectRepo.save({ name: "Assign" });
    const action = await createAction({ name: "Assignable" });

    await asAdmin(request(server()).put(`/projects/actions/${action.id}`))
      .send({ projectId: project.id })
      .expect(200);
    expect(await actionProject(action.id)).toEqual({
      id: project.id,
      name: "Assign",
      category: [],
    });

    await asAdmin(request(server()).put(`/projects/actions/${action.id}`))
      .send({ projectId: null })
      .expect(200);
    expect(await actionProject(action.id)).toBeNull();
  });

  it("rejects assigning a missing project, a missing action, or no projectId", async () => {
    const project = await projectRepo.save({ name: "Exists" });
    const action = await createAction({ name: "Target" });

    await asAdmin(request(server()).put(`/projects/actions/${action.id}`))
      .send({ projectId: 999999 })
      .expect(404);
    await asAdmin(request(server()).put(`/projects/actions/999999`))
      .send({ projectId: project.id })
      .expect(404);
    await asAdmin(request(server()).put(`/projects/actions/${action.id}`))
      .send({})
      .expect(400);
  });

  it("lists a project's steps in member-action order, unscheduled last", async () => {
    const now = Date.now();
    const project = await projectRepo.save({ name: "Ordered" });
    const unscheduled = await createAction({ name: "Unscheduled" });
    const second = await createAction({
      name: "Second",
      memberActionAt: new Date(now + milliseconds({ weeks: 1 })),
    });
    const first = await createAction({
      name: "First",
      memberActionAt: new Date(now),
    });
    for (const action of [unscheduled, second, first]) {
      await actionRepo.update(action.id, { project: { id: project.id } });
    }

    const res = await asAdmin(
      request(server()).get(`/projects/${project.id}`),
    ).expect(200);

    expect(res.body.name).toBe("Ordered");
    expect(res.body.steps.map((s: { actionId: number }) => s.actionId)).toEqual(
      [first.id, second.id, unscheduled.id],
    );
    expect(res.body.steps[2].memberActionAt).toBeNull();
  });

  it("deletes a project and unassigns its actions", async () => {
    const project = await projectRepo.save({ name: "Doomed" });
    const action = await createAction({ name: "Orphan" });
    await actionRepo.update(action.id, { project: { id: project.id } });

    await asAdmin(request(server()).delete(`/projects/${project.id}`)).expect(
      200,
    );

    expect(await projectRepo.existsBy({ id: project.id })).toBe(false);
    expect(await actionProject(action.id)).toBeNull();
  });
});
