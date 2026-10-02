import type { ProjectDto, ProjectWithStepsDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";
import { useProjectAdmin, useProjectsAdmin } from "./useProjectsAdmin";

afterEach(cleanup);

const project = (id: number, name: string) =>
  ({ id, name, category: [] }) satisfies ProjectDto;

const withSteps = (id: number, name: string) =>
  ({
    ...project(id, name),
    steps: [
      {
        actionId: 10,
        actionName: "Call your representative",
        memberActionAt: "2026-01-02T00:00:00.000Z",
      },
    ],
  }) satisfies ProjectWithStepsDto;

serveApi(
  routes({
    "GET /projects": () =>
      Response.json([project(1, "Clean air"), project(2, "Clean water")]),
    "GET /projects/:id": ({ params }) =>
      Response.json(withSteps(Number(params.id), "Clean air")),
  }),
);

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
      expect(view.result.current.data).toEqual(withSteps(1, "Clean air")),
    );
  });
});
