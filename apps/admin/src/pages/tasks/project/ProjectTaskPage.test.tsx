import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import {
  createMemoryRouter,
  Outlet,
  RouterProvider,
  useLocation,
} from "react-router";
import LeaveGuard from "../../../components/LeaveGuard";
import { makeParsedAction } from "../../../lib/testing/parsedAction";
import { ToastProvider } from "../../../ui/ToastProvider";
import ProjectTaskPage from "./ProjectTaskPage";

afterEach(cleanup);

let task: ParsedActionDto;

serveApi(
  routes(
    {
      "GET /actions/adminslug/:id": () => Response.json(task),
      "GET /actions/suite/:id": () =>
        Response.json({
          id: 4,
          name: "Solo",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
          events: [],
          actions: [{ id: 7 }],
        }),
    },
    (request) =>
      request.method === "GET"
        ? Response.json([])
        : Response.json({ message: "not served" }, { status: 500 }),
  ),
);

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

const renderAt = (url: string) => {
  const router = createMemoryRouter(
    [
      {
        element: (
          <LeaveGuard>
            <Suspense>
              <Outlet />
              <Where />
            </Suspense>
          </LeaveGuard>
        ),
        children: [
          {
            path: "/tasks/projects/:projectId/tasks/:actionId",
            element: <ProjectTaskPage />,
          },
          { path: "/tasks/:actionId", element: <p>The task page</p> },
        ],
      },
    ],
    { initialEntries: [url] },
  );
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
    queryWrapper(),
  );
};

const inProject = (id: number) => ({
  id,
  name: "Heat",
  category: [],
});

describe("ProjectTaskPage", () => {
  it("shows the task with its project in the breadcrumb and the release", async () => {
    task = makeParsedAction({
      id: 7,
      name: "Winter heat survey",
      project: inProject(2),
      suite: {
        id: 4,
        name: "Solo",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        events: [],
      },
    });
    renderAt("/tasks/projects/2/tasks/7?tab=events");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Winter heat survey",
      }),
    ).toBeTruthy();
    expect(
      screen.getAllByRole("link", { name: "Heat" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Staff testing")).toBeTruthy();
    expect(screen.getByText("Release")).toBeTruthy();
  });

  it("redirects a task that is not in this project to its own page", async () => {
    task = makeParsedAction({ id: 7, project: undefined });
    renderAt("/tasks/projects/2/tasks/7");

    await waitFor(() =>
      expect(screen.getByTestId("where").textContent).toBe("/tasks/7"),
    );
  });

  it("redirects a task in another project to that project's page for it", async () => {
    task = makeParsedAction({ id: 7, project: inProject(5) });
    renderAt("/tasks/projects/2/tasks/7");

    await waitFor(() =>
      expect(screen.getByTestId("where").textContent).toBe(
        "/tasks/projects/5/tasks/7",
      ),
    );
  });
});
