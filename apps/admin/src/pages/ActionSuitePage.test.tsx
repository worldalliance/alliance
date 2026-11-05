import type { ActionSuiteDto } from "@alliance/shared/client";
import { makeAction, makeEvent } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import ActionSuitePage from "./ActionSuitePage";
import SuiteLaunchPage from "./SuiteLaunchPage";

const failure = () => Response.json({}, { status: 500 });
const loadSuite = () =>
  Response.json({
    id: 3,
    name: "Suite",
    actions: [makeAction()],
    events: [makeEvent({ id: 1, title: "Launch" })],
    reminderGroups: [],
    generalUpdates: [],
  } satisfies ActionSuiteDto);
const unlaunchedSuite = (events: ActionSuiteDto["events"]) => () =>
  Response.json({
    id: 3,
    name: "Suite",
    actions: [makeAction()],
    events,
    reminderGroups: [],
    generalUpdates: [],
  } satisfies ActionSuiteDto);
let suiteLoad = loadSuite;
let eventDelete = failure;
let eventEdit = failure;

serveApi(
  routes(
    {
      "GET /actions/suite/:id": () => suiteLoad(),
      "DELETE /actions/suite/:suiteId/events/:eventId": () => eventDelete(),
      "PATCH /actions/suite/:suiteId/batchUpdateSuiteEvents/:eventId": () =>
        eventEdit(),
    },
    failure,
  ),
);

afterEach(() => {
  suiteLoad = loadSuite;
  eventDelete = failure;
  eventEdit = failure;
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/suites/3"]}>
      <ToastProvider>
        <Routes>
          <Route path="/suites/:suiteId" element={<ActionSuitePage />} />
          <Route path="/suites/:suiteId/launch" element={<SuiteLaunchPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

it("says when the suite fails to load", async () => {
  suiteLoad = failure;
  renderPage();

  expect(await screen.findByText("Failed to load suite.")).toBeTruthy();
});

it("says why a delete was refused", async () => {
  eventDelete = () =>
    Response.json({ message: "Reminders use it" }, { status: 400 });
  renderPage();

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
  renderPage();

  fireEvent.click(await screen.findByRole("button", { name: "Edit for all" }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  expect(await screen.findByText("Title is too long")).toBeTruthy();
});

it("opens the launch page from the suite and goes back", async () => {
  suiteLoad = unlaunchedSuite([]);
  renderPage();

  fireEvent.click(
    await screen.findByRole("button", { name: "Begin launch process" }),
  );
  expect(
    await screen.findByRole("heading", { name: "Launch Suite" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Back to suite" }));
  expect(
    await screen.findByRole("button", { name: "Begin launch process" }),
  ).toBeTruthy();
});

it("says why a suite with an office taking action event can't launch", async () => {
  suiteLoad = unlaunchedSuite([makeEvent({ newStatus: "office_action" })]);
  renderPage();

  expect(
    await screen.findByText(/already has an office taking action event/),
  ).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Begin launch process" }),
  ).toBeNull();
});

it("offers no launch once the suite has launched", async () => {
  renderPage();

  await screen.findByText("Suite");
  expect(
    screen.queryByRole("button", { name: "Begin launch process" }),
  ).toBeNull();
  expect(screen.queryByText(/already has/)).toBeNull();
});
