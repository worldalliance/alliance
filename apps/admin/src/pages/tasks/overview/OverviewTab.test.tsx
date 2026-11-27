import { makeEvent, makeProfile } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import {
  createMemoryRouter,
  Outlet,
  RouterProvider,
  useLocation,
} from "react-router";
import LeaveGuard from "../../../components/LeaveGuard";
import { memberHref } from "../../../lib/hrefs";
import { adminActionListItem } from "../../../lib/testing/adminActionListItem";
import { makeParsedAction } from "../../../lib/testing/parsedAction";
import { ToastProvider } from "../../../ui/ToastProvider";
import TaskPage from "../TaskPage";
import { responseFilterParams } from "./ResponseStatistics";

afterEach(cleanup);

let task: ParsedActionDto;
let writes: string[];

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

const api = serveApi(
  routes(
    {
      "GET /actions/adminslug/:id": () => Response.json(task),
      "GET /analytics/action-stats/:actionId": () =>
        Response.json({
          usersWithdrawn: 3,
          usersDismissed: 0,
          lastCalculatedAt: ago(1),
        }),
      "GET /actions/:id/incomplete-users": () =>
        Response.json([makeProfile(5)]),
      "GET /projects/:id": ({ params }) =>
        Response.json({
          id: Number(params.id),
          name: "Heat and repairs",
          category: [],
          slug: "heat",
          steps: [
            {
              actionId: 7,
              actionName: "Winter heat survey",
              memberActionAt: null,
            },
          ],
        }),
    },
    (request) => {
      if (request.method === "GET") return Response.json([]);
      writes.push(`${request.method} ${new URL(request.url).pathname}`);
      return Response.json({ message: "not served" }, { status: 500 });
    },
  ),
);

beforeEach(() => {
  task = makeParsedAction({
    id: 7,
    name: "Winter heat survey",
    status: "draft",
    events: [],
  });
  writes = [];
});

function Search() {
  return <p data-testid="search">{useLocation().search}</p>;
}

const renderPage = () => {
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
    { initialEntries: ["/tasks/7"] },
  );
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
    queryWrapper(),
  );
};

it("says a task without events has nothing to report and where its readiness is", async () => {
  renderPage();

  const progress = await screen.findByRole("region", { name: "Progress" });
  expect(within(progress).getByText(/It has no events yet/)).toBeTruthy();
  expect(screen.queryByRole("region", { name: "Events" })).toBeNull();
  expect(
    screen.queryByRole("region", { name: "Completion over time" }),
  ).toBeNull();

  await userEvent.click(
    within(progress).getByRole("button", { name: "Open details" }),
  );
  expect(screen.getByTestId("search").textContent).toBe("?tab=details");
});

it("opens the Events tab from the phase", async () => {
  renderPage();

  await userEvent.click(
    await screen.findByRole("button", { name: "Draft: open events" }),
  );
  expect(screen.getByTestId("search").textContent).toBe("?tab=events");
});

it("lists who failed to complete, each linking to their member record", async () => {
  task = makeParsedAction({
    id: 7,
    status: "office_action",
    events: [
      makeEvent({ id: 1, newStatus: "member_action", date: ago(9) }),
      makeEvent({ id: 2, newStatus: "office_action", date: ago(2) }),
    ],
    usersJoined: 4,
    usersCompleted: 3,
  });
  renderPage();

  const progress = await screen.findByRole("region", { name: "Progress" });
  expect(within(progress).getByText("Failed to complete")).toBeTruthy();
  expect(within(progress).getByText("75% completion rate")).toBeTruthy();

  const panel = screen.getByRole("region", {
    name: "Members who failed to complete",
  });
  await userEvent.click(
    await within(panel).findByRole("button", { name: "Show 1 member" }),
  );
  expect(
    within(panel).getByRole("link", { name: "User 5" }).getAttribute("href"),
  ).toBe(memberHref(5));
});

it("asks before deleting the task's project, and deletes nothing when declined", async () => {
  task = makeParsedAction({
    id: 7,
    status: "draft",
    events: [],
    project: { id: 3, name: "Heat and repairs", category: [] },
  });
  renderPage();

  await userEvent.click(
    await screen.findByRole("button", { name: "Delete project…" }),
  );
  const dialog = await screen.findByRole("dialog");
  expect(
    within(dialog).getByText(
      /Its 1 task will no longer belong to a project, and members stop seeing the project's name on them\./,
    ),
  ).toBeTruthy();
  await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(writes).toEqual([]);
});

it("deletes the project once confirmed, then focuses the events below it", async () => {
  task = makeParsedAction({
    id: 7,
    status: "planned",
    events: [makeEvent({ id: 1, newStatus: "planned", date: ago(1) })],
    project: { id: 3, name: "Heat and repairs", category: [] },
  });
  api.alsoServing({
    "DELETE /projects/:id": ({ params }) => {
      writes.push(`DELETE /projects/${params.id}`);
      task = { ...task, project: null };
      return new Response(null, { status: 204 });
    },
  });
  renderPage();

  await userEvent.click(
    await screen.findByRole("button", { name: "Delete project…" }),
  );
  const dialog = await screen.findByRole("dialog");
  await userEvent.click(
    within(dialog).getByRole("button", { name: "Delete project" }),
  );
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("list", { name: "Events" }),
    ),
  );
  expect(writes).toEqual(["DELETE /projects/3"]);
  await waitFor(() =>
    expect(screen.queryByRole("region", { name: /^Project/ })).toBeNull(),
  );
});

it("says the task's place in its project", async () => {
  const project = { id: 3, name: "Heat and repairs", category: [] };
  task = makeParsedAction({ id: 7, status: "draft", events: [], project });
  api.alsoServing({
    "GET /actions/all": () =>
      Response.json([
        adminActionListItem(6, "Boiler check", {
          project,
          memberActionStart: "2025-03-03T20:00:00.000Z",
          memberActionDeadline: "2025-03-10T19:00:00.000Z",
        }),
        adminActionListItem(7, "Winter heat survey", { project }),
      ]),
  });
  renderPage();

  expect(await screen.findByText("This task is step 2 of 2.")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Boiler check" }).getAttribute("href"),
  ).toBe("/tasks/projects/3/tasks/6");
  expect(
    screen.getByText("Winter heat survey", {
      selector: "[aria-current='step']",
    }),
  ).toBeTruthy();
  expect(screen.getByText(/^Mar 3, 2025 – Mar 10, 2025 ·/)).toBeTruthy();
  expect(screen.getByText(/^Unscheduled ·/)).toBeTruthy();
});

it("lists an archived task among its project's steps", async () => {
  const project = { id: 3, name: "Heat and repairs", category: [] };
  task = makeParsedAction({
    id: 7,
    status: "draft",
    events: [],
    project,
    archived: true,
  });
  api.alsoServing({
    "GET /actions/all": () =>
      Response.json([
        adminActionListItem(6, "Boiler check", { project }),
        adminActionListItem(7, "Winter heat survey", {
          project,
          archived: true,
        }),
      ]),
  });
  renderPage();

  expect(await screen.findByText("This task is step 2 of 2.")).toBeTruthy();
});

it("says a failed responses load failed, not that there are none", async () => {
  task = makeParsedAction({
    id: 7,
    status: "member_action",
    taskFormId: 11,
    events: [makeEvent({ id: 1, newStatus: "member_action", date: ago(2) })],
  });
  api.alsoServing({
    "GET /tasks/adminForm/:id": ({ params }) =>
      Response.json({ id: Number(params.id), title: "Form", schema: {} }),
    "GET /tasks/responses/:id": () => Response.json({}, { status: 500 }),
  });
  renderPage();

  expect(
    await screen.findByText("Couldn't load the form's responses."),
  ).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: "Response statistics" }),
  ).toBeTruthy();
  expect(screen.queryByText("No responses yet.")).toBeNull();
});

it("says the withdrawn count isn't counted yet before the daily job runs", async () => {
  task = makeParsedAction({
    id: 7,
    status: "member_action",
    events: [makeEvent({ id: 1, newStatus: "member_action", date: ago(0) })],
  });
  api.alsoServing({
    "GET /analytics/action-stats/:actionId": () =>
      Response.json({}, { status: 404 }),
  });
  renderPage();

  expect(
    await screen.findByText("Not counted yet: counted daily at 9:00 UTC"),
  ).toBeTruthy();
  expect(screen.queryByText("Couldn't load")).toBeNull();
  expect(screen.queryByText(/withdrawn count/)).toBeNull();
});

it("opens the Responses tab filtered to the answer picked", () => {
  expect(
    responseFilterParams({ fieldId: "q1", op: "equals", value: "yes" }),
  ).toEqual({
    resp_tab: "replays",
    resp_filterField: "q1",
    resp_filterOp: "equals",
    resp_filterValue: "yes",
  });
  expect(responseFilterParams({ fieldId: "q1", op: "no-response" })).toEqual({
    resp_tab: "replays",
    resp_filterField: "q1",
    resp_filterOp: "no-response",
  });
});
