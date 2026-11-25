import type { ActionSuiteDto, ReminderGroupDto } from "@alliance/shared/client";
import { makeAction, makeEvent } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, jest } from "bun:test";
import { milliseconds } from "date-fns";
import { MemoryRouter } from "react-router";
import { LAUNCH_CONFIRM_TEXT } from "../../components/CreateEventForm";
import { ToastProvider } from "../../ui/ToastProvider";
import { SuiteEventsTab } from "./SuiteEventsTab";

const inDays = (days: number) =>
  new Date(Date.now() + milliseconds({ days })).toISOString();

const start = makeEvent({
  id: 11,
  title: "Members start",
  newStatus: "member_action",
  date: inDays(2),
  suiteManaged: true,
});
const deadline = makeEvent({
  id: 12,
  title: "Deadline",
  newStatus: "office_action",
  date: inDays(9),
  suiteManaged: true,
});

const suiteOf = (overrides: Partial<ActionSuiteDto> = {}): ActionSuiteDto => ({
  id: 3,
  name: "Suite",
  actions: [makeAction({ id: 5, events: [start, deadline] })],
  events: [start, deadline],
  reminderGroups: [],
  generalUpdates: [],
  isPartitioned: false,
  ...overrides,
});

const renderTab = (suite: ActionSuiteDto) => {
  const updateEvent = jest.fn(() => Promise.resolve(suite));
  const deleteEvent = jest.fn();
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={["/tasks/suites/3?tab=events"]}>
        <SuiteEventsTab
          suite={suite}
          addEvent={() => Promise.resolve(suite)}
          updateEvent={updateEvent}
          deleteEvent={deleteEvent}
        />
      </MemoryRouter>
    </ToastProvider>,
    queryWrapper(),
  );
  return { updateEvent, deleteEvent };
};

it("saves a title change on every task without asking", async () => {
  const { updateEvent } = renderTab(suiteOf());

  fireEvent.click(screen.getByRole("button", { name: "Edit…: Members start" }));
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "Start" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save for every task" }));

  await waitFor(() =>
    expect(updateEvent).toHaveBeenCalledWith(11, {
      title: "Start",
      description: "",
      date: start.date,
    }),
  );
});

it("asks for the launch phrase when an edit moves the members start into the past", async () => {
  const { updateEvent } = renderTab(suiteOf());

  fireEvent.click(screen.getByRole("button", { name: "Edit…: Members start" }));
  fireEvent.change(screen.getByLabelText("Date (Pacific time)"), {
    target: { value: "2020-01-01T10:00" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save for every task" }));

  expect(await screen.findByText("Launch to members now?")).toBeTruthy();
  expect(screen.getByPlaceholderText(LAUNCH_CONFIRM_TEXT)).toBeTruthy();
  const launch = screen.getByRole<HTMLButtonElement>("button", {
    name: "Launch",
  });
  expect(launch.disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() =>
    expect(screen.queryByText("Launch to members now?")).toBeNull(),
  );
  expect(updateEvent).not.toHaveBeenCalled();
});

it("asks before opening the tasks earlier", async () => {
  const { updateEvent } = renderTab(suiteOf());

  fireEvent.click(screen.getByRole("button", { name: "Edit…: Members start" }));
  const tomorrow = new Date(Date.now() + milliseconds({ days: 1 }));
  const local = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(tomorrow)
    .replace(" ", "T");
  fireEvent.change(screen.getByLabelText("Date (Pacific time)"), {
    target: { value: local },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save for every task" }));

  expect(await screen.findByText("Open the tasks earlier?")).toBeTruthy();
  expect(updateEvent).not.toHaveBeenCalled();
});

it("says a deleted members start takes its reminders with it", async () => {
  const group = {
    id: 40,
    name: "Nudge",
    timingMode: "from_deadline",
    cohortType: "all_uncompleted",
    emailMessage: "",
    emailSubject: "",
    textMessage: "",
    pushMessage: "",
    send_range_start: null,
    send_range_end: null,
    sendAtAbsolute: null,
    sendAtSecondsFromDeadline: -3600,
    relative_range_start_seconds_from_deadline: null,
    relative_range_end_seconds_from_deadline: null,
    useSuiteTaskCount: false,
    allSent: false,
    excludeOptionalActions: false,
    excludePreviouslyNotified: false,
    memberActionEvent: { ...start, updatedAt: start.date },
    isMissedSuite: false,
  } satisfies ReminderGroupDto;
  const { deleteEvent } = renderTab(suiteOf({ reminderGroups: [group] }));

  fireEvent.click(
    screen.getByRole("button", { name: "Delete: Members start" }),
  );

  expect(
    await screen.findByText(/The suite's 1 reminder on it is deleted with it/),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Delete event" }));
  await waitFor(() => expect(deleteEvent).toHaveBeenCalledWith(11));
});

it("says a deleted deadline stops the unsent reminders timed from it", async () => {
  const group = {
    id: 41,
    name: "Last call",
    timingMode: "from_deadline",
    cohortType: "all_uncompleted",
    emailMessage: "",
    emailSubject: "",
    textMessage: "",
    pushMessage: "",
    send_range_start: null,
    send_range_end: null,
    sendAtAbsolute: null,
    sendAtSecondsFromDeadline: -3600,
    relative_range_start_seconds_from_deadline: null,
    relative_range_end_seconds_from_deadline: null,
    useSuiteTaskCount: false,
    allSent: false,
    excludeOptionalActions: false,
    excludePreviouslyNotified: false,
    memberActionEvent: { ...start, updatedAt: start.date },
    deadlineEvent: { ...deadline, updatedAt: deadline.date },
    isMissedSuite: false,
  } satisfies ReminderGroupDto;
  renderTab(
    suiteOf({ reminderGroups: [group, { ...group, id: 42, allSent: true }] }),
  );

  fireEvent.click(screen.getByRole("button", { name: "Delete: Deadline" }));

  expect(
    await screen.findByText(
      "The suite's 1 reminder with it as its deadline stops sending, unless timed from a dependency task's deadline.",
      { exact: false },
    ),
  ).toBeTruthy();
  expect(screen.queryByText(/deleted with it/)).toBeNull();
});

it("points a suite with no shared events to its launch", () => {
  renderTab(suiteOf({ events: [] }));

  expect(screen.getByText("No shared events yet")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Go to launch" }).getAttribute("href"),
  ).toBe("/tasks/suites/3?tab=launch");
});
