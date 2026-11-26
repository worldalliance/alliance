import type {
  ActionEventDto,
  ActionStatus,
  ActionSuiteDto,
  CreateActionEventDto,
} from "@alliance/shared/client";
import { makeEvent } from "@alliance/shared/lib/testFixtures";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, jest, setSystemTime } from "bun:test";
import { MemoryRouter } from "react-router";
import CreateEventForm from "../../../components/CreateEventForm";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import { adminActionListItem } from "../../../lib/testing/adminActionListItem";
import { formatZonedDateTime } from "../../../ui/DateTimePicker";
import { ToastProvider } from "../../../ui/ToastProvider";
import { LAUNCH_CONFIRM_TEXT } from "./eventRules";
import { EventsTab } from "./EventsTab";

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

const renderActionForm = (params: {
  addToAction: jest.Mock;
  events?: ActionEventDto[];
}) => {
  render(
    <ToastProvider>
      <MemoryRouter>
        <EventsTab
          task={adminActionListItem(1, "Task", { events: params.events ?? [] })}
          admin={{ addEvent: params.addToAction }}
        />
      </MemoryRouter>
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Add event" }));
};

const chooseStatus = (status: ActionStatus) =>
  fireEvent.change(screen.getByLabelText("Status this event sets"), {
    target: { value: status },
  });

const launchNow = () => {
  chooseStatus("member_action");
  fireEvent.click(screen.getByLabelText("Take effect now"));
};

const typeLaunchPhrase = async () => {
  fireEvent.change(await screen.findByPlaceholderText(LAUNCH_CONFIRM_TEXT), {
    target: { value: LAUNCH_CONFIRM_TEXT },
  });
  fireEvent.click(screen.getByRole("button", { name: "Launch" }));
};

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "Add event" }));

const addEvent = async () => {
  submit();
  await typeLaunchPhrase();
};

const sent = (status: number, body: object) => ({
  [status < 400 ? "data" : "error"]: body,
  response: Response.json(body, { status }),
});

const pacific = (date: Date) =>
  formatZonedDateTime(date, {
    timeZone: LAUNCH_TIME_ZONE,
    precision: "minute",
  });

const setDate = (label: RegExp, date: Date) =>
  fireEvent.change(screen.getByLabelText(label), {
    target: { value: pacific(date) },
  });

it("keeps a failed add's reason until a later add succeeds", async () => {
  const addToAction = jest
    .fn()
    .mockResolvedValueOnce(
      sent(400, { statusCode: 400, message: "Refused for a reason" }),
    )
    .mockResolvedValueOnce(sent(201, makeEvent({ id: 2 })));
  renderActionForm({ addToAction });
  launchNow();

  await addEvent();
  expect(
    await screen.findByText("Couldn't add: Refused for a reason"),
  ).toBeTruthy();

  await addEvent();
  await waitFor(() => expect(addToAction).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(screen.queryByText(/Refused for a reason/)).toBeNull(),
  );
});

it("resends an action's event acknowledged once staff confirm moving the deadline earlier", async () => {
  const addToAction = jest
    .fn()
    .mockResolvedValueOnce(sent(409, { message: "Moves the deadline" }))
    .mockResolvedValueOnce(sent(201, makeEvent({ id: 2 })));
  renderActionForm({ addToAction });
  launchNow();

  await addEvent();
  fireEvent.click(
    await screen.findByRole("button", { name: "Move deadline earlier" }),
  );

  await waitFor(() => expect(addToAction).toHaveBeenCalledTimes(2));
  expect(addToAction.mock.calls[1][0]).toMatchObject({
    acknowledgeDeadlineShortening: true,
    body: { newStatus: "member_action" },
  });
});

it("adds an action's deadline event after its launch", async () => {
  const addToAction = jest
    .fn()
    .mockResolvedValue(sent(201, makeEvent({ id: 2 })));
  renderActionForm({ addToAction });
  launchNow();

  fireEvent.click(screen.getByLabelText("Add a deadline event"));
  await addEvent();

  await waitFor(() => expect(addToAction).toHaveBeenCalledTimes(2));
  expect(addToAction.mock.calls[1][0]).toMatchObject({
    body: { newStatus: "office_action" },
  });
});

it("labels the deadline time picker apart from the launch picker", () => {
  renderActionForm({ addToAction: jest.fn() });
  chooseStatus("member_action");
  fireEvent.click(screen.getByLabelText("Add a deadline event"));

  expect(screen.getByLabelText(/^Deadline \(/)).not.toBe(
    screen.getByLabelText(/^Date \(/),
  );
});

it("never dates an event now unless staff choose it", async () => {
  const addToAction = jest.fn();
  renderActionForm({ addToAction });
  chooseStatus("member_action");

  submit();

  expect(
    await screen.findByText("Choose a date and time, or take effect now"),
  ).toBeTruthy();
  expect(screen.queryByText("Launch to members now?")).toBeNull();
  expect(addToAction).not.toHaveBeenCalled();
});

it("offers the statuses in use, and the rest only behind More statuses", () => {
  renderActionForm({ addToAction: jest.fn() });
  const options = () =>
    Array.from(
      screen.getByLabelText<HTMLSelectElement>("Status this event sets")
        .options,
    ).map((option) => option.value);

  expect(options()).toEqual([
    "",
    "member_action",
    "office_action",
    "completed",
  ]);
  fireEvent.click(screen.getByRole("button", { name: "More statuses" }));
  expect(options()).toContain("abandoned");
});

const renderSuiteForm = (params: {
  addToSuite: (body: CreateActionEventDto) => Promise<ActionSuiteDto | null>;
  setCreatingEvent?: (creatingEvent: boolean) => void;
}) =>
  render(
    <ToastProvider>
      <MemoryRouter>
        <CreateEventForm
          suiteMode={true}
          addToSuite={params.addToSuite}
          creatingEvent={false}
          setCreatingEvent={params.setCreatingEvent ?? (() => {})}
          eventCreatedSuccess={false}
          setEventCreatedSuccess={() => {}}
        />
      </MemoryRouter>
    </ToastProvider>,
  );

it("says when a suite add is refused", async () => {
  renderSuiteForm({ addToSuite: () => Promise.reject({ statusCode: 500 }) });
  launchNow();

  await addEvent();

  expect(
    await screen.findByText("Couldn't add: Couldn't add the event."),
  ).toBeTruthy();
});

it("says when a suite's deadline event is refused after its launch", async () => {
  const addToSuite = jest
    .fn()
    .mockResolvedValueOnce({})
    .mockRejectedValueOnce({ statusCode: 500 });
  renderSuiteForm({ addToSuite });
  launchNow();

  fireEvent.click(screen.getByLabelText("Add a deadline event"));
  await addEvent();

  expect(await screen.findByText(/its deadline event wasn't/)).toBeTruthy();
  expect(addToSuite).toHaveBeenCalledTimes(2);
});

it("says when staff decline to move a suite's deadline after its launch", async () => {
  const addToSuite = jest
    .fn()
    .mockResolvedValueOnce({})
    .mockResolvedValueOnce(null);
  renderSuiteForm({ addToSuite });
  launchNow();

  fireEvent.click(screen.getByLabelText("Add a deadline event"));
  await addEvent();

  expect(
    await screen.findByText(
      /Added the launch event without its deadline event\. Add the deadline separately\./,
    ),
  ).toBeTruthy();
});

it("asks a suite's typed phrase for any event that can show a draft", async () => {
  renderSuiteForm({ addToSuite: jest.fn() });
  chooseStatus("office_action");
  fireEvent.click(screen.getByLabelText("Take effect now"));

  submit();

  expect(await screen.findByPlaceholderText(LAUNCH_CONFIRM_TEXT)).toBeTruthy();
  expect(screen.getByText(/This skips the suite launch checks/)).toBeTruthy();
});

it("sends nothing when staff cancel the launch confirmation", async () => {
  const addToAction = jest.fn();
  renderActionForm({ addToAction });
  launchNow();

  submit();
  fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

  await waitFor(() =>
    expect(screen.queryByText("Launch to members now?")).toBeNull(),
  );
  expect(addToAction).not.toHaveBeenCalled();
});

it("holds the add pending while the launch confirmation is open", async () => {
  const setCreatingEvent = jest.fn();
  renderSuiteForm({ addToSuite: jest.fn(), setCreatingEvent });
  launchNow();

  submit();
  await screen.findByText("Launch to members now?");
  expect(setCreatingEvent).toHaveBeenLastCalledWith(true);

  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(setCreatingEvent).toHaveBeenLastCalledWith(false));
});

const launched = [
  makeEvent({
    id: 1,
    newStatus: "member_action",
    date: "2026-01-01T00:00:00.000Z",
  }),
];

it("adds an event to a launched task that members already see without asking", async () => {
  const addToAction = jest
    .fn()
    .mockResolvedValue(sent(201, makeEvent({ id: 2 })));
  renderActionForm({ addToAction, events: launched });

  chooseStatus("office_action");
  fireEvent.click(screen.getByLabelText("Take effect now"));
  submit();

  await waitFor(() => expect(addToAction).toHaveBeenCalledTimes(1));
});

it("asks the typed phrase before an event other than a launch shows a draft", async () => {
  const addToAction = jest
    .fn()
    .mockResolvedValue(sent(201, makeEvent({ id: 2 })));
  renderActionForm({ addToAction });

  chooseStatus("completed");
  fireEvent.click(screen.getByLabelText("Take effect now"));
  submit();

  expect(
    await screen.findByText("Make this draft visible to members?"),
  ).toBeTruthy();
  expect(addToAction).not.toHaveBeenCalled();
  fireEvent.change(screen.getByPlaceholderText(LAUNCH_CONFIRM_TEXT), {
    target: { value: LAUNCH_CONFIRM_TEXT },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add event" }));

  await waitFor(() => expect(addToAction).toHaveBeenCalledTimes(1));
  expect(addToAction.mock.calls[0][0]).toMatchObject({
    body: { newStatus: "completed" },
  });
});

it("confirms before a Draft event hides a launched task", async () => {
  const addToAction = jest.fn();
  renderActionForm({ addToAction, events: launched });

  fireEvent.click(screen.getByRole("button", { name: "More statuses" }));
  chooseStatus("draft");
  fireEvent.click(screen.getByLabelText("Take effect now"));
  submit();

  expect(await screen.findByText("Make this task a draft again?")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() =>
    expect(screen.queryByText("Make this task a draft again?")).toBeNull(),
  );
  expect(addToAction).not.toHaveBeenCalled();
});

it("won't offer a second launch on a task that has one", () => {
  renderActionForm({ addToAction: jest.fn(), events: launched });

  const option = screen.getByRole<HTMLOptionElement>("option", {
    name: /Members taking action/,
  });
  expect(option.disabled).toBe(true);
});

it("dates a launch-now event from the confirmation, not from opening it", async () => {
  const addToAction = jest
    .fn()
    .mockResolvedValue(sent(201, makeEvent({ id: 2 })));
  renderActionForm({ addToAction });
  launchNow();

  submit();
  const phrase = await screen.findByPlaceholderText(LAUNCH_CONFIRM_TEXT);
  await new Promise((resolve) => setTimeout(resolve, 30));
  const confirmedAt = Date.now();
  fireEvent.change(phrase, { target: { value: LAUNCH_CONFIRM_TEXT } });
  fireEvent.click(screen.getByRole("button", { name: "Launch" }));

  await waitFor(() => expect(addToAction).toHaveBeenCalledTimes(1));
  const { body } = addToAction.mock.calls[0][0];
  expect(new Date(body.date).getTime()).toBeGreaterThanOrEqual(confirmedAt);
});

const scheduleAt = (date: Date) => {
  chooseStatus("member_action");
  setDate(/^Date \(/, date);
  submit();
};

it("asks to launch now when the scheduled launch time has already passed", async () => {
  renderActionForm({ addToAction: jest.fn() });

  scheduleAt(new Date(Date.now() - 60 * 60 * 1000));

  expect(await screen.findByText("Launch to members now?")).toBeTruthy();
  expect(screen.getByText(/opens to its members immediately/)).toBeTruthy();
});

it("asks to schedule a launch set for later", async () => {
  renderActionForm({ addToAction: jest.fn() });

  scheduleAt(new Date(Date.now() + 24 * 60 * 60 * 1000));

  expect(await screen.findByText("Schedule this launch?")).toBeTruthy();
});

it("refuses a deadline already before the launch without asking", async () => {
  const addToAction = jest.fn();
  renderActionForm({ addToAction });
  launchNow();
  fireEvent.click(screen.getByLabelText("Add a deadline event"));
  setDate(/^Deadline \(/, new Date(Date.now() - 60_000));
  submit();

  expect(
    await screen.findByText(
      "The deadline must come after the launch. Pick a later one.",
      { selector: "[role=alert]" },
    ),
  ).toBeTruthy();
  expect(screen.queryByText("Launch to members now?")).toBeNull();
  expect(addToAction).not.toHaveBeenCalled();
});

describe("when time passes while the launch confirmation is open", () => {
  const later = (minutes: number) => new Date(Date.now() + minutes * 60_000);

  afterEach(() => setSystemTime());

  it("refuses a scheduled launch whose time has passed", async () => {
    const addToAction = jest.fn();
    renderActionForm({ addToAction });
    scheduleAt(later(5));
    expect(await screen.findByText("Schedule this launch?")).toBeTruthy();

    setSystemTime(later(10));
    await typeLaunchPhrase();

    expect(
      await screen.findByText(
        /The launch time passed before you confirmed\. Pick a new time\./,
      ),
    ).toBeTruthy();
    expect(addToAction).not.toHaveBeenCalled();
  });

  it("refuses a launch now that would follow its deadline", async () => {
    const addToAction = jest.fn();
    renderActionForm({ addToAction });
    launchNow();
    fireEvent.click(screen.getByLabelText("Add a deadline event"));
    setDate(/^Deadline \(/, later(5));
    submit();
    expect(await screen.findByText("Launch to members now?")).toBeTruthy();

    setSystemTime(later(10));
    await typeLaunchPhrase();

    expect(
      await screen.findByText(
        "The deadline must come after the launch. Pick a later one.",
      ),
    ).toBeTruthy();
    expect(addToAction).not.toHaveBeenCalled();
  });
});
