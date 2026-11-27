import type { ActionSuiteDto } from "@alliance/shared/client";
import { makeAction, makeEvent } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "bun:test";
import { createMemoryRouter, RouterProvider } from "react-router";
import { ToastProvider } from "../../ui/ToastProvider";
import SuitePage from "./SuitePage";
import { suiteReminderHref } from "./suiteRules";

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) =>
  new Date(Date.now() + days * DAY).toISOString();

const draft: ActionSuiteDto = {
  id: 3,
  name: "Suite",
  actions: [makeAction({ status: "draft", events: [] })],
  events: [],
  reminderGroups: [],
  generalUpdates: [],
  isPartitioned: false,
};
let suite = draft;
let suiteRequests = 0;

serveApi(
  routes({
    "GET /actions/suite/:id": () => {
      suiteRequests++;
      return Response.json(suite);
    },
  }),
);

afterEach(() => {
  suite = draft;
  suiteRequests = 0;
});

const renderPage = (initialEntry = "/tasks/suites/3") =>
  render(
    <ToastProvider>
      <RouterProvider
        router={createMemoryRouter(
          [{ path: "/tasks/suites/:suiteId", element: <SuitePage /> }],
          { initialEntries: [initialEntry] },
        )}
      />
    </ToastProvider>,
    queryWrapper(),
  );

// The general updates tab names no phase, so each one counted is the header's
// or the side panel's.
const GENERAL_UPDATES = "/tasks/suites/3?tab=general-updates";

it("tells staff nothing of a draft reaches members until they launch", async () => {
  renderPage(GENERAL_UPDATES);

  expect(
    await screen.findByText("Nothing is visible to members until you launch."),
  ).toBeTruthy();
  expect(screen.getAllByText("Draft")).toHaveLength(2);
});

it("calls a suite launched for a start still ahead scheduled, not a draft to launch", async () => {
  suite = {
    ...draft,
    events: [
      makeEvent({ id: 1, newStatus: "member_action", date: inDays(1) }),
      makeEvent({ id: 2, newStatus: "office_action", date: inDays(8) }),
    ],
  };
  renderPage(GENERAL_UPDATES);

  expect(
    await screen.findByText(
      /^Nothing is visible to members until they start, /,
    ),
  ).toBeTruthy();
  expect(screen.getAllByText("Scheduled")).toHaveLength(2);
  expect(screen.queryByText("Draft")).toBeNull();
});

it("doesn't warn about a scheduled suite's general update shown from its members start", async () => {
  const start = inDays(1);
  suite = {
    ...draft,
    events: [
      makeEvent({ id: 1, newStatus: "member_action", date: start }),
      makeEvent({ id: 2, newStatus: "office_action", date: inDays(8) }),
    ],
    generalUpdates: [
      {
        id: 1,
        name: "Notice",
        startDate: start,
        endDate: null,
        priority: 0,
        schema: {},
      },
    ],
  };
  renderPage(GENERAL_UPDATES);

  expect(
    await screen.findByText(
      /^Nothing is visible to members until they start, /,
    ),
  ).toBeTruthy();
  expect(screen.queryByText(/general update of this/)).toBeNull();
});

it("warns that a draft's task is already visible through its own events", async () => {
  suite = { ...draft, actions: [makeAction({ status: "member_action" })] };
  renderPage();

  expect(
    await screen.findByText(/1 task of this draft suite is already visible/),
  ).toBeTruthy();
  expect(screen.queryByText(/Nothing is visible/)).toBeNull();
});

it("warns that a draft's general update past its start is already shown", async () => {
  suite = {
    ...draft,
    generalUpdates: [
      {
        id: 1,
        name: "Notice",
        startDate: inDays(-1),
        endDate: null,
        priority: 0,
        schema: {},
      },
    ],
  };
  renderPage();

  expect(
    await screen.findByText(
      "1 general update of this draft suite is already shown to members.",
    ),
  ).toBeTruthy();
  expect(screen.queryByText(/Nothing is visible/)).toBeNull();
});

it("warns that a draft's task opens on a future event of its own", async () => {
  suite = {
    ...draft,
    actions: [
      makeAction({
        status: "draft",
        events: [makeEvent({ date: inDays(2), suiteManaged: false })],
      }),
    ],
  };
  renderPage();

  expect(
    await screen.findByText(
      /^1 task of this draft suite opens to members from .* through events of its own, not at launch\.$/,
    ),
  ).toBeTruthy();
  expect(screen.queryByText(/Nothing is visible/)).toBeNull();
});

it("warns that a draft's general update shows from its future start", async () => {
  suite = {
    ...draft,
    generalUpdates: [
      {
        id: 1,
        name: "Notice",
        startDate: inDays(2),
        endDate: null,
        priority: 0,
        schema: {},
      },
    ],
  };
  renderPage();

  expect(
    await screen.findByText(
      /^1 general update of this draft suite is shown to members from .*, not at launch\.$/,
    ),
  ).toBeTruthy();
  expect(screen.queryByText(/Nothing is visible/)).toBeNull();
});

it("finds no suite for an id that isn't a number, without asking the server", async () => {
  renderPage("/tasks/suites/abc");

  expect(await screen.findByText("Suite not found")).toBeTruthy();
  expect(suiteRequests).toBe(0);
});

it("says a task-less suite has no tasks yet on a tab that needs them", async () => {
  suite = { ...draft, actions: [] };
  renderPage("/tasks/suites/3?tab=tasks");
  expect(await screen.findByText("No tasks yet")).toBeTruthy();
});

it("shows a task-less suite's general updates tab", async () => {
  suite = { ...draft, actions: [] };
  renderPage(GENERAL_UPDATES);

  await screen.findByRole("heading", { level: 1, name: "Suite" });
  expect(screen.queryByText("No tasks yet")).toBeNull();
});

it("links a reminder to the suite's Reminders tab on it", () => {
  expect(suiteReminderHref({ suiteId: 3, reminderId: 5 })).toBe(
    "/tasks/suites/3?tab=reminders&reminder=5",
  );
});
