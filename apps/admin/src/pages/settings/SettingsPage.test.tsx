import type { PushDto } from "@alliance/shared/client/types.gen";
import { makeUser } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ToastProvider } from "../../ui/ToastProvider";
import { pickUser } from "../../ui/UserSelect.testing";
import SettingsPage from "./SettingsPage";

const failure = () => Response.json({}, { status: 500 });
const ana = () => Response.json([makeUser({ id: 7, name: "Ana" })]);
let userList = failure;

const acceptedPush: PushDto = {
  id: 3,
  expoPushToken: "ExponentPushToken[x]",
  createdAt: "2026-11-25T20:00:00.000Z",
  updatedAt: "2026-11-25T20:00:00.000Z",
  body: "hi",
  screen: null,
  receiptId: "receipt",
  ticketStatus: "ok",
  receiptStatus: "pending",
  errorCode: null,
  errorMessage: null,
  lastCheckedStatusAt: null,
  idempotencyKey: "key",
  openedAt: null,
};
let sendAnswer: () => Response | Promise<Response>;
let sent: unknown[];

serveApi(
  routes({
    "GET /user/list": () => userList(),
    "POST /user/sendPushNotification": async ({ request }) => {
      sent.push(await request.json());
      return sendAnswer();
    },
  }),
);

beforeEach(() => {
  sendAnswer = () => Response.json(acceptedPush);
  sent = [];
});
afterEach(() => {
  userList = failure;
});

const renderPage = () => {
  const query = queryWrapper();
  render(
    <MemoryRouter initialEntries={["/settings"]}>
      <ToastProvider>
        <SettingsPage />
      </ToastProvider>
    </MemoryRouter>,
    query,
  );
  return query;
};

const pickAna = async () =>
  pickUser(await screen.findByLabelText("Recipient"), {
    query: "Ana",
    name: "Ana",
  });
const pressSend = () =>
  fireEvent.click(screen.getByRole("button", { name: "Send test push" }));
const answerConfirm = async (button: string) => {
  const dialog = await screen.findByRole("dialog", {
    name: "Send a test push to Ana?",
  });
  // The page acts on the answer after a resolved promise, outside the click.
  await act(async () =>
    fireEvent.click(within(dialog).getByRole("button", { name: button })),
  );
};
const send = async () => {
  pressSend();
  await answerConfirm("Send push");
};

it("says when the user list fails to load", async () => {
  renderPage();

  expect(await screen.findByText("Failed to load users.")).toBeTruthy();
});

it("stays quiet when a refetch fails after the users loaded", async () => {
  userList = ana;
  const query = renderPage();
  await waitFor(() => expect(query.client.isFetching()).toBe(0));

  userList = failure;
  await query.client.refetchQueries();
  await waitFor(() => expect(query.client.isFetching()).toBe(0));

  expect(screen.queryByText("Failed to load users.")).toBeNull();
});

it("says what is missing instead of sending", async () => {
  userList = ana;
  const query = renderPage();
  await waitFor(() => expect(query.client.isFetching()).toBe(0));
  fireEvent.change(screen.getByLabelText("Message"), {
    target: { value: "  " },
  });
  pressSend();

  expect(await screen.findByText("Choose a member")).toBeTruthy();
  expect(screen.getByText("Enter a message")).toBeTruthy();
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByLabelText("Recipient")),
  );
  expect(sent).toEqual([]);
});

it("sends the trimmed message to the picked member and shows the response", async () => {
  userList = ana;
  renderPage();
  await pickAna();
  fireEvent.change(screen.getByLabelText("Message"), {
    target: { value: " hello " },
  });
  await send();

  expect(
    await screen.findByText("Sent: Expo accepted it for delivery"),
  ).toBeTruthy();
  expect(sent).toEqual([{ userId: 7, message: "hello" }]);
  expect(screen.getByLabelText("Push record as JSON").textContent).toContain(
    '"receiptStatus": "pending"',
  );
});

it("reports a push Expo refused as a failure, though the server answered", async () => {
  userList = ana;
  sendAnswer = () =>
    Response.json({
      ...acceptedPush,
      receiptId: null,
      receiptStatus: null,
      ticketStatus: "error",
      errorCode: "MessageTooBig",
      errorMessage: "The message is too big.",
    });
  renderPage();
  await pickAna();
  await send();

  expect(
    await screen.findByText(
      "Couldn't send: Expo refused it. The message is too big.",
    ),
  ).toBeTruthy();
  expect(screen.queryByText(/^Sent/)).toBeNull();
});

it("marks the shown response as an earlier send's when a later send is refused", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  userList = ana;
  renderPage();
  await pickAna();
  await send();
  await screen.findByText("Sent: Expo accepted it for delivery");

  sendAnswer = () =>
    Response.json({ message: "User has no expo push token" }, { status: 400 });
  await send();

  expect(
    await screen.findByText("Couldn't send: User has no expo push token"),
  ).toBeTruthy();
  expect(screen.queryByText(/^Sent/)).toBeNull();
  expect(
    screen.getByText(
      "The last send failed. This is the push an earlier send recorded for Ana.",
    ),
  ).toBeTruthy();
  expect(screen.getByLabelText("Push record as JSON")).toBeTruthy();
});

it("sends nothing when the confirmation is cancelled", async () => {
  userList = ana;
  renderPage();
  await pickAna();
  pressSend();
  await answerConfirm("Cancel");

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(sent).toEqual([]);
  expect(screen.queryByText("Sending…")).toBeNull();
});

it("doesn't ask for a retry when the server fails the send", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  userList = ana;
  sendAnswer = failure;
  renderPage();
  await pickAna();
  await send();

  expect(
    await screen.findByText(
      "Couldn't send: The server hit an error sending it.",
    ),
  ).toBeTruthy();
});

it("keeps the last response shown while a resend is pending", async () => {
  userList = ana;
  renderPage();
  await pickAna();
  await send();
  await screen.findByText("Sent: Expo accepted it for delivery");

  let answer: (response: Response) => void = () => {};
  sendAnswer = () => new Promise((resolve) => (answer = resolve));
  await send();

  expect(await screen.findByText("Sending…")).toBeTruthy();
  expect(screen.getByLabelText("Push record as JSON")).toBeTruthy();
  answer(Response.json(acceptedPush));
  await screen.findByText("Sent: Expo accepted it for delivery");
});
