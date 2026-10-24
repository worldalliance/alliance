import type {
  ActionSuiteDto,
  CreateActionEventDto,
} from "@alliance/shared/client";
import { makeEvent } from "@alliance/shared/lib/testFixtures";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import CreateEventForm, { type AddActionEvent } from "./CreateEventForm";

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

  fireEvent.click(screen.getByRole("button", { name: "Add Event" }));
  expect(await screen.findByText("Failed to add event")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Add Event" }));
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

  fireEvent.click(screen.getByRole("button", { name: "Add Event" }));
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
  fireEvent.click(screen.getByRole("button", { name: "Add Event" }));

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

  fireEvent.click(screen.getByRole("button", { name: "Add Event" }));

  expect(await screen.findByText("Failed to add event")).toBeTruthy();
});

it("says when a suite's deadline event is refused after its launch", async () => {
  const addToSuite = jest
    .fn()
    .mockResolvedValueOnce({})
    .mockRejectedValueOnce({ statusCode: 500 });
  renderSuiteForm(addToSuite);

  fireEvent.click(screen.getByLabelText("Automatically create deadline event"));
  fireEvent.click(screen.getByRole("button", { name: "Add Event" }));

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
  fireEvent.click(screen.getByRole("button", { name: "Add Event" }));

  expect(
    await screen.findByText(
      "Added the launch event without its deadline event. Add the deadline separately.",
    ),
  ).toBeTruthy();
});
