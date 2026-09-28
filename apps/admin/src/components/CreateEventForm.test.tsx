import { client } from "@alliance/shared/client/client.gen";
import { makeEvent } from "@alliance/shared/lib/testFixtures";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { adminActionListItem } from "../lib/testing/adminActionListItem";
import CreateEventForm from "./CreateEventForm";

const { baseUrl, fetch } = client.getConfig();

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  client.setConfig({ baseUrl, fetch });
});

const action = adminActionListItem(1, "Action");

it("clears a failed add's error once a later add succeeds", async () => {
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce(Response.json({ message: "boom" }, { status: 500 }))
    .mockResolvedValueOnce(
      Response.json(makeEvent({ id: 2 }), { status: 201 }),
    );
  client.setConfig({ baseUrl: "http://localhost", fetch: fetchMock });
  const setAction = jest.fn();
  render(
    <ToastProvider>
      <CreateEventForm
        suiteMode={false}
        action={action}
        setAction={setAction}
        creatingEvent={false}
        setCreatingEvent={() => {}}
        eventCreatedSuccess={false}
        setEventCreatedSuccess={() => {}}
      />
    </ToastProvider>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Add Event" }));
  expect(await screen.findByText("Failed to add event")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Add Event" }));
  await waitFor(() => expect(setAction).toHaveBeenCalled());
  expect(screen.queryByText("Failed to add event")).toBeNull();
});
