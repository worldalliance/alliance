import type {
  NeedsReplyThreadDto,
  NumberThreadDto,
} from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { ToastProvider } from "../../ui/ToastProvider";
import InboxPage from "./InboxPage";
import NoThreadOpen from "./NoThreadOpen";
import ThreadPage from "./ThreadPage";

const threadIdOf = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

const waiting = (n: number, name: string): NeedsReplyThreadDto => ({
  threadId: threadIdOf(n),
  phoneNumber: `+1415555010${n}`,
  members: [{ id: n, name, timeZone: null }],
  lastMessageBody: `Text from ${name}`,
  waitingSince: new Date().toISOString(),
});

const numberThread = (n: number, name: string): NumberThreadDto => ({
  threadId: threadIdOf(n),
  phoneNumber: `+1415555010${n}`,
  members: [{ id: n, name, timeZone: null }],
  textable: true,
  optedOut: false,
  replyWindowClosed: false,
  replyState: "needs_reply",
  messages: [],
  hasOlder: false,
});

serveApi(
  routes({
    "GET /mms-threads/needs-reply-threads": () =>
      Response.json([waiting(1, "Sam"), waiting(2, "Kim")]),
    "GET /mms-threads/by-id/:threadId": ({ params }) =>
      Response.json(
        params.threadId === threadIdOf(1)
          ? numberThread(1, "Sam")
          : numberThread(2, "Kim"),
      ),
    "GET /mms-threads": () => Response.json({ threads: [], hasMore: false }),
  }),
);

const renderInbox = (path = "/inbox") => {
  const { wrapper: Wrapper } = queryWrapper();
  const router = createMemoryRouter(
    [
      {
        element: <InboxPage />,
        children: [
          { path: "/inbox", element: <NoThreadOpen /> },
          { path: "/inbox/:threadId", element: <ThreadPage /> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <Wrapper>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </Wrapper>,
  );
  return router;
};

it("names the browser tab", () => {
  renderInbox();

  expect(document.title).toBe("Inbox - Admin");
});

it("names the browser tab after the open thread's contact", async () => {
  renderInbox(`/inbox/${threadIdOf(1)}`);

  await waitFor(() => expect(document.title).toBe("Sam - Admin"));
});

it("says what to open while no thread is open", async () => {
  renderInbox();

  expect(await screen.findByText("No thread open")).toBeTruthy();
  expect(screen.getByText(/Open a thread to see its number/)).toBeTruthy();
});

it("opens a thread beside the list, keeping the list and marking its row", async () => {
  const router = renderInbox();
  const list = await screen.findByRole("list", { name: "Needs reply" });

  fireEvent.click(within(list).getByRole("link", { name: /Sam/ }));

  expect(
    await screen.findByRole("heading", { level: 1, name: "Sam" }),
  ).toBeTruthy();
  expect(router.state.location.pathname).toBe(`/inbox/${threadIdOf(1)}`);
  expect(
    screen.queryByText(/^Phone numbers .* longest waiting first\.$/),
  ).toBeNull();
  expect(screen.getByRole("list", { name: "Needs reply" })).toBe(list);
  expect(
    within(list)
      .getByRole("link", { name: /Sam/ })
      .getAttribute("aria-current"),
  ).toBe("page");
  expect(
    within(list)
      .getByRole("link", { name: /Kim/ })
      .getAttribute("aria-current"),
  ).toBeNull();
});

it("keeps the queue in the URL when a thread opens from it, and the thread when the queue changes", async () => {
  const router = renderInbox(`/inbox/${threadIdOf(2)}`);
  await screen.findByRole("heading", { level: 1, name: "Kim" });

  fireEvent.click(screen.getByRole("tab", { name: "All" }));

  await waitFor(() => expect(router.state.location.search).toBe("?tab=all"));
  expect(router.state.location.pathname).toBe(`/inbox/${threadIdOf(2)}`);
  expect(screen.getByRole("heading", { level: 1, name: "Kim" })).toBeTruthy();
});

it("goes back to the All queue with its search and page from an open thread", async () => {
  const router = renderInbox(`/inbox/${threadIdOf(2)}?tab=all&q=415&page=2`);
  await screen.findByRole("heading", { level: 1, name: "Kim" });

  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByRole(
      "link",
      { name: "All" },
    ),
  );

  await waitFor(() => expect(router.state.location.pathname).toBe("/inbox"));
  expect(router.state.location.search).toBe("?tab=all&q=415&page=2");
  expect(
    screen.getByRole("tab", { name: "All" }).getAttribute("aria-selected"),
  ).toBe("true");
});
