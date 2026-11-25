import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { cleanup, render, screen, within } from "@testing-library/react";
import { Suspense } from "react";
import {
  createMemoryRouter,
  Outlet,
  RouterProvider,
  useLocation,
} from "react-router";
import LeaveGuard from "../../components/LeaveGuard";
import { makeParsedAction } from "../../lib/testing/parsedAction";
import { ToastProvider } from "../../ui/ToastProvider";
import TaskPage from "./TaskPage";

afterEach(cleanup);

let task: ParsedActionDto | null;
let taskRequests: number;
let storedCohort: unknown;

serveApi(
  routes(
    {
      "GET /actions/adminslug/:id": () => {
        taskRequests += 1;
        return task
          ? Response.json(
              storedCohort === undefined
                ? task
                : { ...task, cohortExpression: storedCohort },
            )
          : Response.json({ message: "Action not found" }, { status: 404 });
      },
    },
    // The record's lookups and reports: lists that are empty here.
    (request) =>
      request.method === "GET"
        ? Response.json([])
        : Response.json({ message: "not served" }, { status: 500 }),
  ),
);

beforeEach(() => {
  task = makeParsedAction({
    id: 7,
    name: "Winter heat survey",
    status: "draft",
    events: [],
  });
  taskRequests = 0;
  storedCohort = undefined;
});

function Search() {
  return <p data-testid="search">{useLocation().search}</p>;
}

const renderPage = (url: string) => {
  const router = createMemoryRouter(
    [
      {
        element: (
          <LeaveGuard>
            <Suspense>
              <Outlet />
              <Search />
            </Suspense>
          </LeaveGuard>
        ),
        children: [{ path: "/tasks/:actionId", element: <TaskPage /> }],
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

it("shows the task's name, phase and commands", async () => {
  renderPage("/tasks/7");

  expect(
    await screen.findByRole("heading", {
      level: 1,
      name: "Winter heat survey",
    }),
  ).toBeTruthy();
  expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: /^More/ })).toBeTruthy();
  expect(
    screen
      .getByRole("link", { name: /^View member page/ })
      .getAttribute("href"),
  ).toMatch(/\/actions\/7$/);
});

it.each([
  ["updates", "messages", "Messages"],
  ["form-variants", "variants", "Variants"],
  ["cohort-decisions", "activity", "Activity"],
])(
  "lands a link to the old %s tab on its new tab",
  async (old, renamed, label) => {
    renderPage(`/tasks/7?tab=${old}&resp_page=2`);

    expect(
      (await screen.findByRole("tab", { name: label })).getAttribute(
        "aria-selected",
      ),
    ).toBe("true");
    expect(screen.getByTestId("search").textContent).toBe(
      `?tab=${renamed}&resp_page=2`,
    );
  },
);

it("says a task that doesn't exist isn't found", async () => {
  task = null;
  renderPage("/tasks/7");

  expect(await screen.findByText("Task not found")).toBeTruthy();
});

it("says an id that can't exist isn't found, without asking the server", async () => {
  renderPage("/tasks/seven");

  expect(await screen.findByText("Task not found")).toBeTruthy();
  expect(taskRequests).toBe(0);
});

it("marks an archived task", async () => {
  task = makeParsedAction({ id: 7, archived: true });
  renderPage("/tasks/7");

  const header = await screen.findByRole("banner");
  expect(await within(header).findByText("Archived")).toBeTruthy();
});

it("says a stored cohort it can't read is unreadable, not empty", async () => {
  storedCohort = { kind: "not a cohort" };
  jest.spyOn(console, "error").mockImplementation(() => {});
  renderPage("/tasks/7");

  expect(await screen.findByText("Couldn't read the cohort")).toBeTruthy();
});
