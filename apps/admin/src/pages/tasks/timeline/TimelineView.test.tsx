import type {
  ActionEventDto,
  ActionStatus,
  AdminActionListItemDto,
} from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { milliseconds } from "date-fns";
import { createMemoryRouter, RouterProvider } from "react-router";
import { adminActionListItem } from "../../../lib/testing/adminActionListItem";
import { ToastProvider } from "../../../ui/ToastProvider";
import { TimelineView } from "./TimelineView";

const daysFromNow = (days: number) =>
  new Date(Date.now() + milliseconds({ days })).toISOString();

const event = (
  id: number,
  days: number,
  newStatus: ActionStatus,
  suiteManaged = false,
): ActionEventDto => ({
  id,
  title: "",
  description: "",
  date: daysFromNow(days),
  newStatus,
  suiteManaged,
});

const suite = {
  id: 5,
  name: "Winter push",
  createdAt: daysFromNow(-30),
  updatedAt: daysFromNow(-30),
  events: [],
};
const project = { id: 9, name: "Heat and repairs", category: [] };

const live = adminActionListItem(1, "Winter heat survey", {
  status: "member_action",
  suite,
  project,
  events: [
    event(1, -3, "member_action", true),
    event(2, 4, "office_action", true),
  ],
});
const draft = adminActionListItem(2, "Report a heat outage", { project });
const archived = adminActionListItem(3, "Old petition", { archived: true });

let loadStatus = 200;
let served: AdminActionListItemDto[] = [];

serveApi(
  routes({
    "GET /actions/all": () =>
      loadStatus === 200
        ? Response.json(served)
        : Response.json({}, { status: loadStatus }),
    "GET /user/tags": () => Response.json([]),
    "GET /tasks/listForms": () => Response.json([]),
  }),
);

beforeEach(() => {
  loadStatus = 200;
  served = [live, draft, archived];
});

const renderView = (url = "/tasks") => {
  const router = createMemoryRouter(
    [
      {
        path: "/tasks",
        element: (
          <ToastProvider>
            <TimelineView />
          </ToastProvider>
        ),
      },
    ],
    { initialEntries: [url] },
  );
  const query = queryWrapper();
  render(<RouterProvider router={router} />, query);
  return { router, query };
};

const group = (name: string) => screen.getByRole("group", { name });

it("groups the tasks by suite, the suite's phase beside its name", async () => {
  renderView();
  await screen.findByRole("link", { name: "Winter heat survey" });

  const winter = group("Winter push");
  expect(
    within(winter)
      .getByRole("link", { name: "Winter push" })
      .getAttribute("href"),
  ).toBe("/tasks/suites/5");
  expect(
    within(winter).getAllByText("Members taking action").length,
  ).toBeGreaterThanOrEqual(2);
  expect(
    within(group("No suite")).getByRole("link", {
      name: "Report a heat outage",
    }),
  ).toBeTruthy();
  expect(screen.queryByText("Old petition")).toBeNull();
});

it("keeps a live suite's phase when only its draft is shown", async () => {
  served = [
    live,
    adminActionListItem(6, "Late addition", { status: "draft", suite }),
  ];
  renderView("/tasks?status=draft");
  await screen.findByRole("link", { name: "Late addition" });

  const winter = group("Winter push");
  expect(within(winter).queryByText("Winter heat survey")).toBeNull();
  expect(within(winter).getByText("Members taking action")).toBeTruthy();
  expect(within(winter).getByText(/^Members take action /)).toBeTruthy();
});

it("groups by project from the URL, and the switch writes it", async () => {
  const { router } = renderView("/tasks?group=project");
  await screen.findByRole("link", { name: "Winter heat survey" });

  const heat = group("Heat and repairs");
  expect(within(heat).getByText("2 tasks")).toBeTruthy();
  expect(
    within(heat)
      .getByRole("link", { name: "Heat and repairs" })
      .getAttribute("href"),
  ).toBe("/tasks/projects/9");

  fireEvent.click(screen.getByRole("button", { name: "Suite" }));
  expect(router.state.location.search).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "Project" }));
  expect(router.state.location.search).toBe("?group=project");
});

it("links each phase bar to its task, saying the phase and its dates", async () => {
  renderView();
  const bar = await screen.findByRole("link", {
    name: /^Winter heat survey: Members taking action \(/,
  });
  expect(bar.getAttribute("href")).toBe("/tasks/1");
});

it("offers to show archived tasks when every task is archived", async () => {
  served = [archived];
  const { router } = renderView();

  fireEvent.click(
    await screen.findByRole("button", { name: "Show archived tasks" }),
  );

  expect(router.state.location.search).toBe("?archived=1");
  expect(
    await screen.findByRole("link", { name: "Old petition" }),
  ).toBeTruthy();
  expect(screen.getByText("Archived")).toBeTruthy();
});

it("says no task matches the statuses, and can show every status", async () => {
  served = [adminActionListItem(4, "Wrapped up", { status: "completed" })];
  renderView();

  expect(
    await screen.findByText("No tasks match the selected statuses."),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Show every status" }));

  expect(await screen.findByRole("link", { name: "Wrapped up" })).toBeTruthy();
  expect(document.activeElement?.tagName).not.toBe("BODY");
});

it("says there are no tasks yet", async () => {
  served = [];
  renderView();
  expect(await screen.findByText("No tasks yet")).toBeTruthy();
  expect(screen.getByText("Create one from the List view.")).toBeTruthy();
});

it("says the tasks failed to load instead of showing none", async () => {
  loadStatus = 500;
  renderView();
  expect(await screen.findByText("Couldn't load tasks")).toBeTruthy();
  expect(screen.queryByText("No tasks yet")).toBeNull();
});

it("shows the loading region and neither empty nor failed while loading", () => {
  renderView();
  expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();
  expect(screen.queryByText("No tasks yet")).toBeNull();
  expect(screen.queryByText("Couldn't load tasks")).toBeNull();
});
