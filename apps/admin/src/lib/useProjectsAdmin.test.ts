import type {
  ProjectDto,
  ProjectWithStepsDto,
  UpdateProjectDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
  useAssignActionProjectAdmin,
  useCreateActionProjectAdmin,
  useDeleteProjectAdmin,
  useProjectAdmin,
  useProjectsAdmin,
  useUpdateProjectAdmin,
} from "./useProjectsAdmin";

afterEach(cleanup);

const project = (id: number, name: string) =>
  ({ id, name, category: [] }) satisfies ProjectDto;

const ACTION_ID = 10;

const step = {
  actionId: ACTION_ID,
  actionName: "Call your representative",
  memberActionAt: "2026-01-02T00:00:00.000Z",
};

const withSteps = (stored: ProjectDto) =>
  ({
    ...stored,
    steps: stored.id === assignedProjectId ? [step] : [],
  }) satisfies ProjectWithStepsDto;

let stored: ProjectDto[] = [];
let assignedProjectId: number | null = null;
let requests: string[] = [];

serveApi(
  routes({
    "GET /projects": () => Response.json(stored),
    "GET /projects/:id": ({ params }) => {
      const found = stored.find((p) => String(p.id) === params.id);
      return found
        ? Response.json(withSteps(found))
        : Response.json({}, { status: 404 });
    },
    "POST /projects": async ({ request }) => {
      const { name }: { name: string } = await request.json();
      const created = project(3, name);
      stored = [...stored, created];
      requests.push(`create ${name}`);
      return Response.json(created);
    },
    "PATCH /projects/:id": async ({ request, params }) => {
      const body: UpdateProjectDto = await request.json();
      stored = stored.map((p) =>
        String(p.id) === params.id ? { ...p, ...body } : p,
      );
      return Response.json(null);
    },
    "DELETE /projects/:id": ({ params }) => {
      stored = stored.filter((p) => String(p.id) !== params.id);
      return new Response(null, { status: 200 });
    },
    "PUT /projects/actions/:actionId": async ({ request, params }) => {
      const { projectId }: { projectId: number | null } = await request.json();
      assignedProjectId = projectId;
      requests.push(`assign action ${params.actionId} to ${projectId}`);
      return Response.json(null);
    },
  }),
);

beforeEach(() => {
  stored = [project(1, "Clean air"), project(2, "Clean water")];
  assignedProjectId = 1;
  requests = [];
});

const onError = () => {};

const renderProjects = (query = queryWrapper()) => {
  query.client.setQueryData(queryKeys.actionAdmin(ACTION_ID), null);
  return renderHook(
    () => ({
      projects: useProjectsAdmin(),
      project: useProjectAdmin(1),
    }),
    query,
  );
};

const loaded = async (view: ReturnType<typeof renderProjects>) =>
  waitFor(() => {
    expect(view.result.current.projects.data).toBeDefined();
    expect(view.result.current.project.data).toBeDefined();
  });

const actionInvalidated = (query: ReturnType<typeof queryWrapper>) =>
  query.client.getQueryState(queryKeys.actionAdmin(ACTION_ID))?.isInvalidated;

describe("useProjectsAdmin", () => {
  it("loads the projects", async () => {
    const view = renderHook(() => useProjectsAdmin(), queryWrapper());

    await waitFor(() =>
      expect(view.result.current.data).toEqual([
        project(1, "Clean air"),
        project(2, "Clean water"),
      ]),
    );
  });
});

describe("useProjectAdmin", () => {
  it("loads the project with its steps", async () => {
    const view = renderHook(() => useProjectAdmin(1), queryWrapper());

    await waitFor(() =>
      expect(view.result.current.data).toEqual(
        withSteps(project(1, "Clean air")),
      ),
    );
  });
});

describe("useAssignActionProjectAdmin", () => {
  it("assigns the action and refetches the projects' details and the action", async () => {
    const query = queryWrapper();
    const view = renderProjects(query);
    const assign = renderHook(
      () => useAssignActionProjectAdmin({ actionId: ACTION_ID, onError }),
      query,
    );
    await loaded(view);

    await assign.result.current.mutateAsync(2);

    expect(
      query.client.getQueryData<ProjectWithStepsDto>(queryKeys.projectAdmin(1))
        ?.steps,
    ).toEqual([]);
    expect(actionInvalidated(query)).toBe(true);
  });
});

describe("useCreateActionProjectAdmin", () => {
  it("creates the project, assigns the action to it, and reports success once the list has it", async () => {
    const query = queryWrapper();
    const view = renderProjects(query);
    const onSuccess = mock(() =>
      query.client
        .getQueryData<ProjectDto[]>(queryKeys.projectsAdmin())
        ?.map((p) => p.name),
    );
    const create = renderHook(
      () =>
        useCreateActionProjectAdmin({
          actionId: ACTION_ID,
          onSuccess,
          onError,
        }),
      query,
    );
    await loaded(view);

    await create.result.current.mutateAsync("Clean soil");

    expect(requests).toEqual([
      "create Clean soil",
      `assign action ${ACTION_ID} to 3`,
    ]);
    expect(onSuccess.mock.results).toEqual([
      { type: "return", value: ["Clean air", "Clean water", "Clean soil"] },
    ]);
    expect(actionInvalidated(query)).toBe(true);
  });
});

describe("useUpdateProjectAdmin", () => {
  it("refetches the list and the project's details before reporting success", async () => {
    const query = queryWrapper();
    const view = renderProjects(query);
    const onSuccess = mock(() => [
      query.client
        .getQueryData<ProjectDto[]>(queryKeys.projectsAdmin())
        ?.find((p) => p.id === 1)?.name,
      query.client.getQueryData<ProjectWithStepsDto>(queryKeys.projectAdmin(1))
        ?.name,
    ]);
    const update = renderHook(
      () => useUpdateProjectAdmin({ actionId: ACTION_ID, onSuccess, onError }),
      query,
    );
    await loaded(view);

    await update.result.current.mutateAsync({
      id: 1,
      body: { name: "Cleaner air" },
    });

    expect(onSuccess.mock.results).toEqual([
      { type: "return", value: ["Cleaner air", "Cleaner air"] },
    ]);
    expect(actionInvalidated(query)).toBe(true);
  });
});

describe("useDeleteProjectAdmin", () => {
  it("refetches the list but not the deleted project's details", async () => {
    const query = queryWrapper();
    const view = renderProjects(query);
    const remove = renderHook(
      () =>
        useDeleteProjectAdmin({
          actionId: ACTION_ID,
          onSuccess: () => {},
          onError,
        }),
      query,
    );
    await loaded(view);

    await remove.result.current.mutateAsync(1);

    expect(
      query.client.getQueryData<ProjectDto[]>(queryKeys.projectsAdmin()),
    ).toEqual([project(2, "Clean water")]);
    expect(
      query.client.getQueryState(queryKeys.projectAdmin(1))?.isInvalidated,
    ).toBe(false);
    expect(actionInvalidated(query)).toBe(true);
  });
});
