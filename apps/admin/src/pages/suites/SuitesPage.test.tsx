import type { ActionSuiteDto } from "@alliance/shared/client";
import { makeAction, makeEvent } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, setSystemTime } from "bun:test";
import { createMemoryRouter, RouterProvider } from "react-router";
import { ToastProvider } from "../../ui/ToastProvider";
import NewSuiteDialog from "./NewSuiteDialog";
import SuitesPage from "./SuitesPage";

afterEach(cleanup);
// formatDate drops the year within the current one, so the dates assert under a fixed clock.
beforeEach(() => setSystemTime(new Date("2026-03-01T12:00:00Z")));
afterEach(() => setSystemTime());

const listed = (id: number, name: string): ActionSuiteDto => ({
  id,
  name,
  actions: [],
  events: [],
  reminderGroups: [],
  generalUpdates: [],
  isPartitioned: false,
});

let suites: ActionSuiteDto[] = [];
let suitesStatus = 200;
let tasksStatus = 200;
const launch = makeEvent({
  newStatus: "member_action",
  date: "2026-01-06T03:00:00Z",
  suiteManaged: true,
});
const tasks = [
  {
    ...makeAction({ id: 7, name: "Heat survey", events: [launch] }),
    suite: { id: 1 },
  },
  {
    ...makeAction({ id: 8, name: "Phone bank", events: [] }),
    suite: { id: 2 },
  },
  { ...makeAction({ id: 9, name: "Letters", events: [] }), suite: { id: 2 } },
  {
    ...makeAction({
      id: 10,
      name: "Canvass",
      events: [
        makeEvent({
          newStatus: "member_action",
          date: "2026-04-01T02:00:00Z",
          suiteManaged: true,
        }),
      ],
    }),
    suite: { id: 4 },
  },
];

serveApi(
  routes({
    "GET /actions/suites": () =>
      suitesStatus === 200
        ? Response.json(suites)
        : Response.json({ message: "Suites are resting" }, { status: 400 }),
    "GET /actions/all": () =>
      tasksStatus === 200
        ? Response.json(tasks)
        : Response.json({ message: "Tasks are resting" }, { status: 400 }),
  }),
);

afterEach(() => {
  suites = [];
  suitesStatus = 200;
  tasksStatus = 200;
});

const renderPage = (url = "/tasks/suites") => {
  const router = createMemoryRouter(
    [
      {
        path: "/tasks/suites",
        element: <SuitesPage />,
        children: [{ path: "new", element: <NewSuiteDialog /> }],
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
  return router;
};

it("shows the loading region, and neither the empty nor the failed state, while suites load", () => {
  renderPage();

  expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();
  expect(screen.queryByText("No suites yet")).toBeNull();
  expect(screen.queryByText("Couldn't load suites")).toBeNull();
});

it("says there are no suites yet and offers to create one", async () => {
  renderPage();

  expect(await screen.findByText("No suites yet")).toBeTruthy();
  expect(screen.getAllByRole("link", { name: "New suite…" })).toHaveLength(2);
});

it("says why suites couldn't load", async () => {
  suitesStatus = 400;
  renderPage();

  expect(await screen.findByText("Couldn't load suites")).toBeTruthy();
  expect(screen.getByText("Suites are resting")).toBeTruthy();
  expect(screen.queryByText("No suites yet")).toBeNull();
});

it("lists each suite with its phase, shared dates in Pacific time and tasks", async () => {
  suites = [listed(1, "January"), listed(2, "Spring"), listed(3, "Unbuilt")];
  renderPage();

  const january = (
    await screen.findByRole("link", { name: "January" })
  ).closest("tr")!;
  expect(within(january).getByRole("link").getAttribute("href")).toBe(
    "/tasks/suites/1",
  );
  expect(within(january).getByText("Members taking action")).toBeTruthy();
  expect(within(january).getByText("Mon, Jan 5, 7:00 PM PT")).toBeTruthy();
  expect(within(january).getByText("Heat survey")).toBeTruthy();

  const spring = screen.getByRole("link", { name: "Spring" }).closest("tr")!;
  expect(within(spring).getByText("Draft")).toBeTruthy();
  expect(within(spring).getByText("2 tasks")).toBeTruthy();

  const unbuilt = screen.getByRole("link", { name: "Unbuilt" }).closest("tr")!;
  expect(within(unbuilt).getByText("No tasks yet")).toBeTruthy();
  expect(screen.getByText("3 suites")).toBeTruthy();
});

it("calls a suite launched for a start still ahead scheduled, not a draft", async () => {
  suites = [listed(4, "April")];
  renderPage();

  const april = (await screen.findByRole("link", { name: "April" })).closest(
    "tr",
  )!;
  expect(within(april).getByText("Scheduled")).toBeTruthy();
  expect(within(april).queryByText("Draft")).toBeNull();
});

it("keeps the suites and says what is unknown when the tasks fail to load", async () => {
  suites = [listed(1, "January")];
  tasksStatus = 400;
  renderPage();

  const row = (await screen.findByRole("link", { name: "January" })).closest(
    "tr",
  )!;
  expect(within(row).queryByText("Draft")).toBeNull();
  expect(within(row).getAllByText("—")).toHaveLength(4);
  expect(
    screen.getByText(/Couldn't load tasks\. Tasks are resting/),
  ).toBeTruthy();
});

it("filters suites by name and offers to clear a search that finds none", async () => {
  suites = [listed(1, "January"), listed(2, "Spring")];
  renderPage("/tasks/suites?q=spr");

  expect(await screen.findByRole("link", { name: "Spring" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "January" })).toBeNull();
  expect(screen.getByText("1 of 2 suites")).toBeTruthy();

  cleanup();
  renderPage("/tasks/suites?q=zzz");
  fireEvent.click(await screen.findByRole("button", { name: "Clear filters" }));
  expect(await screen.findByRole("link", { name: "January" })).toBeTruthy();
});

it("opens New suite over the list from its URL, and closing it leaves the list", async () => {
  suites = [listed(1, "January")];
  const router = renderPage("/tasks/suites/new?q=jan");

  fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

  expect(await screen.findByRole("link", { name: "January" })).toBeTruthy();
  expect(router.state.location.pathname).toBe("/tasks/suites");
  expect(router.state.location.search).toBe("?q=jan");
});
