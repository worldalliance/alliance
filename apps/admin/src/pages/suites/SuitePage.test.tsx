import { NodeEnv } from "@alliance/common/node-env";
import { PARTITION_LAUNCH_REFUSED } from "@alliance/common/suite-partition";
import type {
  ActionSuiteDto,
  SuitePartitionDto,
} from "@alliance/shared/client";
import { makeAction, makeEvent } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { setWebRuntimeConfig } from "@alliance/sharedweb/lib/runtimeConfig";
import { deployedWebRuntimeConfig } from "@alliance/sharedweb/lib/testing/runtimeConfig";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, jest } from "bun:test";
import { createMemoryRouter, RouterProvider } from "react-router";
import LeaveGuard from "../../components/LeaveGuard";
import { answerLeaveGuard } from "../../lib/testing/leaveGuard";
import { LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import { ToastProvider } from "../../ui/ToastProvider";
import SuitePage from "./SuitePage";

const failure = () => Response.json({}, { status: 500 });
const loadSuite = () =>
  Response.json({
    id: 3,
    name: "Suite",
    actions: [makeAction()],
    events: [makeEvent({ id: 1, title: "Launch" })],
    reminderGroups: [],
    generalUpdates: [],
    isPartitioned: false,
  } satisfies ActionSuiteDto);
const unlaunchedSuite =
  (events: ActionSuiteDto["events"], isPartitioned = false) =>
  () =>
    Response.json({
      id: 3,
      name: "Suite",
      actions: [makeAction()],
      events,
      reminderGroups: [],
      generalUpdates: [],
      isPartitioned,
    } satisfies ActionSuiteDto);
const partition = {
  versionId: 1,
  parts: [
    {
      id: "00000000-0000-4000-8000-0000000000e1",
      name: "Everyone else",
      text: null,
      fallback: null,
      noRequiredWorkTick: null,
      cells: [],
    },
  ],
  actions: [],
  launched: false,
  launchFailedAt: null,
  launchFailure: null,
} satisfies SuitePartitionDto;
let suiteLoad = loadSuite;
let eventDelete = failure;
let eventEdit = failure;

serveApi(
  routes(
    {
      "GET /actions/suite/:id": () => suiteLoad(),
      "GET /actions/suite/:suiteId/partition": () => Response.json(partition),
      "DELETE /actions/suite/:suiteId/events/:eventId": () => eventDelete(),
      "PATCH /actions/suite/:suiteId/batchUpdateSuiteEvents/:eventId": () =>
        eventEdit(),
    },
    failure,
  ),
);

afterEach(() => {
  jest.restoreAllMocks();
  suiteLoad = loadSuite;
  eventDelete = failure;
  eventEdit = failure;
});

const renderPage = (initialEntry = "/tasks/suites/3") => {
  const router = createMemoryRouter(
    [
      {
        path: "/tasks/suites/:suiteId",
        element: (
          <LeaveGuard>
            <SuitePage />
          </LeaveGuard>
        ),
      },
    ],
    { initialEntries: [initialEntry] },
  );
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
    queryWrapper(),
  );
  return router;
};

it("says when the suite fails to load", async () => {
  suiteLoad = failure;
  renderPage();

  expect(await screen.findByText("Couldn't load this suite")).toBeTruthy();
  expect(screen.getByText(LOAD_FAILED_FALLBACK)).toBeTruthy();
});

it("says why a delete was refused", async () => {
  eventDelete = () =>
    Response.json({ message: "Reminders use it" }, { status: 400 });
  renderPage("/tasks/suites/3?tab=events");

  fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[1]);

  expect(
    await screen.findByText(
      "Reminders use it (events will fail to delete if reminders depend on their existence)",
    ),
  ).toBeTruthy();
});

it("says why an edit was refused", async () => {
  eventEdit = () =>
    Response.json({ message: "Title is too long" }, { status: 400 });
  renderPage("/tasks/suites/3?tab=events");

  fireEvent.click(await screen.findByRole("button", { name: "Edit for all" }));
  expect(screen.getByLabelText("Title")).toBeTruthy();
  expect(screen.getByLabelText("Date")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  expect(await screen.findByText("Title is too long")).toBeTruthy();
});

it("opens the launch page from the suite and goes back", async () => {
  suiteLoad = unlaunchedSuite([]);
  renderPage();

  fireEvent.click(await screen.findByRole("link", { name: "Launch…" }));
  expect(
    await screen.findByRole("heading", { name: "Launch Suite" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Back to suite" }));
  expect(await screen.findByRole("link", { name: "Launch…" })).toBeTruthy();
});

it("says why a suite with an office taking action event can't launch", async () => {
  suiteLoad = unlaunchedSuite([makeEvent({ newStatus: "office_action" })]);
  renderPage();

  expect(
    await screen.findByText(/already has an office taking action event/),
  ).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Launch…" })).toBeNull();
});

it("offers no launch once the suite has launched", async () => {
  renderPage();

  await screen.findByRole("heading", { level: 1, name: "Suite" });
  expect(screen.queryByRole("link", { name: "Launch…" })).toBeNull();
  expect(screen.queryByText(/already has/)).toBeNull();
});

it.each([
  [NodeEnv.Production, true],
  [NodeEnv.Staging, false],
] as const)(
  "offers partitioning only outside production, where partitioned suites can't launch yet: %s",
  async (environment, off) => {
    setWebRuntimeConfig(deployedWebRuntimeConfig(environment));
    suiteLoad = unlaunchedSuite([]);
    renderPage("/tasks/suites/3?tab=partition");

    const button = await screen.findByRole("button", {
      name: "Partition this suite",
    });
    expect(button.hasAttribute("disabled")).toBe(off);
    expect(
      screen.queryByText(
        "Partitioning is off in production until partitioned suites can launch.",
      ) !== null,
    ).toBe(off);
  },
);

it("offers the parts in place of a launch for a suite that uses parts", async () => {
  suiteLoad = unlaunchedSuite([], true);
  renderPage("/tasks/suites/3?tab=partition");

  expect(await screen.findByText(PARTITION_LAUNCH_REFUSED)).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Launch…" })).toBeNull();
  expect(
    await screen.findByRole("heading", { name: "1. Everyone else" }),
  ).toBeTruthy();
});

it("drops one suite's unsaved parts on moving to another", async () => {
  suiteLoad = unlaunchedSuite([], true);
  const router = renderPage("/tasks/suites/4?tab=partition");
  await screen.findByRole("heading", { name: "1. Everyone else" });
  await act(() => router.navigate("/tasks/suites/3?tab=partition"));
  fireEvent.click(await screen.findByRole("button", { name: "Add part" }));
  expect(
    screen.getByRole("heading", { name: "2. Everyone else" }),
  ).toBeTruthy();

  answerLeaveGuard(true);
  await act(() => router.navigate("/tasks/suites/4?tab=partition"));

  expect(
    await screen.findByRole("heading", { name: "1. Everyone else" }),
  ).toBeTruthy();
});
