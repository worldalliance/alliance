import type {
  ActionSuiteDto,
  CreateActionEventDto,
} from "@alliance/shared/client";
import { makeEvent } from "@alliance/shared/lib/testFixtures";
import { formatLocalDateTime } from "@alliance/sharedweb/ui/DateTimePicker";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import CreateEventForm, {
  LAUNCH_CONFIRM_TEXT,
  type AddActionEvent,
} from "./CreateEventForm";

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

const renderActionForm = (params: {
  addToAction: AddActionEvent;
  setEventCreatedSuccess?: (eventCreatedSuccess: boolean) => void;
}) =>
  render(
    <ToastProvider>
      <CreateEventForm
        suiteMode={false}
        addToAction={params.addToAction}
        creatingEvent={false}
        setCreatingEvent={() => {}}
        eventCreatedSuccess={false}
        setEventCreatedSuccess={params.setEventCreatedSuccess ?? (() => {})}
      />
    </ToastProvider>,
  );

const addEvent = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Add event" }));
  fireEvent.change(await screen.findByPlaceholderText(LAUNCH_CONFIRM_TEXT), {
    target: { value: LAUNCH_CONFIRM_TEXT },
  });
  fireEvent.click(screen.getByRole("button", { name: "Launch" }));
};

const sent = (status: number, body: object) => ({
  [status < 400 ? "data" : "error"]: body,
  response: Response.json(body, { status }),
});

it("clears a failed add's error once a later add succeeds", async () => {
  const addToAction = jest
    .fn()
    .mockResolvedValueOnce(sent(500, { message: "boom" }))
    .mockResolvedValueOnce(sent(201, makeEvent({ id: 2 })));
  const setEventCreatedSuccess = jest.fn();
  renderActionForm({ addToAction, setEventCreatedSuccess });

  await addEvent();
  expect(await screen.findByText("Failed to add event")).toBeTruthy();

  await addEvent();
  await waitFor(() =>
    expect(setEventCreatedSuccess).toHaveBeenCalledWith(true),
  );
  expect(screen.queryByText("Failed to add event")).toBeNull();
});

it("resends an action's event acknowledged once staff confirm moving the deadline earlier", async () => {
  const addToAction = jest
    .fn()
    .mockResolvedValueOnce(sent(409, { message: "Moves the deadline" }))
    .mockResolvedValueOnce(sent(201, makeEvent({ id: 2 })));
  renderActionForm({ addToAction });

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

  fireEvent.click(screen.getByLabelText("Automatically create deadline event"));
  await addEvent();

  await waitFor(() => expect(addToAction).toHaveBeenCalledTimes(2));
  expect(addToAction.mock.calls[1][0]).toMatchObject({
    body: { newStatus: "office_action" },
  });
});

const renderSuiteForm = (
  addToSuite: (body: CreateActionEventDto) => Promise<ActionSuiteDto | null>,
) =>
  render(
    <ToastProvider>
      <CreateEventForm
        suiteMode={true}
        addToSuite={addToSuite}
        creatingEvent={false}
        setCreatingEvent={() => {}}
        eventCreatedSuccess={false}
        setEventCreatedSuccess={() => {}}
      />
    </ToastProvider>,
  );

it("says when a suite add is refused", async () => {
  renderSuiteForm(() => Promise.reject({ statusCode: 500 }));

  await addEvent();

  expect(await screen.findByText("Failed to add event")).toBeTruthy();
});

it("says when a suite's deadline event is refused after its launch", async () => {
  const addToSuite = jest
    .fn()
    .mockResolvedValueOnce({})
    .mockRejectedValueOnce({ statusCode: 500 });
  renderSuiteForm(addToSuite);

  fireEvent.click(screen.getByLabelText("Automatically create deadline event"));
  await addEvent();

  expect(
    await screen.findByText("Failed to add office action event"),
  ).toBeTruthy();
  expect(addToSuite).toHaveBeenCalledTimes(2);
});

it("says when staff decline to move a suite's deadline after its launch", async () => {
  const addToSuite = jest
    .fn()
    .mockResolvedValueOnce({})
    .mockResolvedValueOnce(null);
  renderSuiteForm(addToSuite);

  fireEvent.click(screen.getByLabelText("Automatically create deadline event"));
  await addEvent();

  expect(
    await screen.findByText(
      "Added the launch event without its deadline event. Add the deadline separately.",
    ),
  ).toBeTruthy();
});

it("sends nothing when staff cancel the launch confirmation", async () => {
  const addToAction = jest.fn();
  renderActionForm({ addToAction });

  fireEvent.click(screen.getByRole("button", { name: "Add event" }));
  fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

  await waitFor(() =>
    expect(screen.queryByText("Launch to members now?")).toBeNull(),
  );
  expect(addToAction).not.toHaveBeenCalled();
});

it("adds an event that doesn't open the action to members without asking", async () => {
  const addToAction = jest
    .fn()
    .mockResolvedValue(sent(201, makeEvent({ id: 2 })));
  renderActionForm({ addToAction });

  fireEvent.change(screen.getByLabelText("Status this event sets"), {
    target: { value: "office_action" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add event" }));

  await waitFor(() => expect(addToAction).toHaveBeenCalledTimes(1));
});

it("dates a launch-now event from the confirmation, not from opening it", async () => {
  const addToAction = jest
    .fn()
    .mockResolvedValue(sent(201, makeEvent({ id: 2 })));
  renderActionForm({ addToAction });

  fireEvent.click(screen.getByRole("button", { name: "Add event" }));
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
  fireEvent.click(screen.getByLabelText("Launch now"));
  fireEvent.change(document.getElementById("eventDate")!, {
    target: { value: formatLocalDateTime(date, "minute") },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add event" }));
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
