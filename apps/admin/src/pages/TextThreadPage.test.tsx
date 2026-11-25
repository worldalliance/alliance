import type {
  MmsMessageDto,
  NumberThreadDto,
} from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { MmsThreadsLiveContext, OFFLINE } from "../lib/mmsThreadsLive";
import { ToastProvider } from "../ui/ToastProvider";
import TextThreadPage from "./TextThreadPage";

const THREAD_ID = "00000000-0000-4000-8000-000000000001";

const inbound = (body: string): MmsMessageDto => ({
  id: 1,
  direction: "inbound",
  body,
  status: "received",
  errorCode: null,
  errorMessage: null,
  createdAt: "2026-11-10T18:00:00Z",
  sentByStaff: false,
  sentByName: null,
  media: [],
  events: [],
});

let thread: NumberThreadDto;
let threadExists: boolean;
let sentBodies: unknown[];
let handledBodies: unknown[];
let needsReplyBodies: unknown[];
let handledRefused: boolean;
let heldThread: Promise<NumberThreadDto> | null;
let newerTextOnSend: MmsMessageDto | null;

serveApi(
  routes({
    [`GET /mms-threads/by-id/${THREAD_ID}`]: async () => {
      if (heldThread) {
        const held = heldThread;
        heldThread = null;
        newerTextOnSend = null;
        return Response.json(await held);
      }
      return threadExists
        ? Response.json(thread)
        : Response.json({ message: "Thread not found" }, { status: 404 });
    },
    [`POST /mms-threads/by-id/${THREAD_ID}`]: async ({ request }) => {
      const body = await request.json();
      sentBodies.push(body);
      if (newerTextOnSend) {
        thread = {
          ...thread,
          messages: [...thread.messages, newerTextOnSend],
        };
        newerTextOnSend = null;
        return Response.json(
          { statusCode: 409, error: "newer_texts", message: "Newer texts" },
          { status: 409 },
        );
      }
      thread = { ...thread, replyState: "answered" };
      return Response.json({
        ...inbound("Happy to help"),
        id: 2,
        direction: "outbound",
        status: "queued",
        sentByStaff: true,
        sentByName: "Alex",
      });
    },
    [`POST /mms-threads/by-id/${THREAD_ID}/opt-out`]: () => {
      thread = { ...thread, optedOut: true };
      return new Response(null, { status: 204 });
    },
    [`POST /mms-threads/by-id/${THREAD_ID}/handled`]: async ({ request }) => {
      handledBodies.push(await request.json());
      if (handledRefused) {
        return Response.json(
          { message: "That text isn't in this thread." },
          { status: 400 },
        );
      }
      thread = { ...thread, replyState: "handled" };
      return new Response(null, { status: 204 });
    },
    [`POST /mms-threads/by-id/${THREAD_ID}/needs-reply`]: async ({
      request,
    }) => {
      needsReplyBodies.push(await request.json());
      thread = { ...thread, replyState: "needs_reply" };
      return new Response(null, { status: 204 });
    },
  }),
);

beforeEach(() => {
  sentBodies = [];
  handledBodies = [];
  needsReplyBodies = [];
  handledRefused = false;
  heldThread = null;
  threadExists = true;
  thread = {
    threadId: THREAD_ID,
    phoneNumber: "+14155550101",
    members: [],
    textable: true,
    optedOut: false,
    replyWindowClosed: false,
    replyState: "needs_reply",
    messages: [inbound("Who is this?")],
    hasOlder: false,
  };
});

const renderPage = (live = OFFLINE) => {
  const { wrapper: Wrapper, client } = queryWrapper();
  client.setQueryData(queryKeys.needsReplyAdmin(), []);
  render(
    <MmsThreadsLiveContext.Provider value={live}>
      <Wrapper>
        <ToastProvider>
          <MemoryRouter initialEntries={[`/texts/${THREAD_ID}`]}>
            <Routes>
              <Route path="/texts/:threadId" element={<TextThreadPage />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </Wrapper>
    </MmsThreadsLiveContext.Provider>,
  );
  return client;
};

it("reports a draft under the number, and shows who else is replying to it", async () => {
  const reported: string[] = [];
  renderPage({
    ...OFFLINE,
    connected: true,
    composers: [
      { phoneNumber: "+14155550101", adminId: 2, adminName: "Priya" },
    ],
    reportComposing: (phoneNumber) => reported.push(phoneNumber),
  });

  fireEvent.change(await screen.findByLabelText("Text (415) 555-0101"), {
    target: { value: "Happy to help" },
  });

  expect(reported).toEqual(["+14155550101"]);
  expect(screen.getByText("Priya is replying…")).toBeTruthy();
});

it("names a number with no member by the number, and sends in its thread", async () => {
  renderPage();

  expect(
    await screen.findByRole("heading", { name: "(415) 555-0101" }),
  ).toBeTruthy();
  expect(screen.getByText("No member has this phone number.")).toBeTruthy();
  expect(screen.getByText(/^\(415\) 555-0101 ·/)).toBeTruthy();

  fireEvent.change(screen.getByLabelText("Text (415) 555-0101"), {
    target: { value: "Happy to help" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  expect(await screen.findByText("Happy to help")).toBeTruthy();
  expect(sentBodies).toEqual([{ body: "Happy to help", afterId: 1 }]);
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Mark handled" })).toBeNull(),
  );
});

it("warns of texts that arrived while staff wrote, and sends anyway after them", async () => {
  newerTextOnSend = { ...inbound("Never mind"), id: 3 };
  renderPage();
  fireEvent.change(await screen.findByLabelText("Text (415) 555-0101"), {
    target: { value: "Happy to help" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  fireEvent.click(await screen.findByRole("button", { name: "Send anyway" }));

  expect(screen.getByText("Never mind")).toBeTruthy();
  await waitFor(() =>
    expect(sentBodies).toEqual([
      { body: "Happy to help", afterId: 1 },
      { body: "Happy to help", afterId: 3 },
    ]),
  );
});

it("shows one error for a thread that doesn't exist", async () => {
  threadExists = false;
  renderPage();

  expect(await screen.findByText("Thread not found")).toBeTruthy();
  expect(screen.queryByText("Failed to load texts")).toBeNull();
});

it("links to the page of each member on the number", async () => {
  thread = {
    ...thread,
    members: [
      { id: 7, name: "Sam", timeZone: "America/New_York" },
      { id: 8, name: "Kim", timeZone: null },
    ],
  };
  renderPage();

  expect(
    await screen.findByRole("heading", { name: "Sam and Kim" }),
  ).toBeTruthy();
  expect(
    screen
      .getByRole("link", { name: "Sam's member page" })
      .getAttribute("href"),
  ).toBe("/member/7");
  expect(screen.getByText("Their local time is unknown")).toBeTruthy();
});

it("shows the local time of the only member on the number", async () => {
  thread = {
    ...thread,
    members: [{ id: 7, name: "Sam", timeZone: "America/New_York" }],
  };
  renderPage();

  expect(await screen.findByText(/^Their local time: /)).toBeTruthy();
});

it("shows the local time the members on the number share", async () => {
  thread = {
    ...thread,
    members: [
      { id: 7, name: "Sam", timeZone: "America/New_York" },
      { id: 8, name: "Kim", timeZone: "America/New_York" },
    ],
  };
  renderPage();

  expect(await screen.findByText(/^Their local time: /)).toBeTruthy();
});

it("explains why staff can't reply once the reply window has closed", async () => {
  thread = { ...thread, replyWindowClosed: true };
  renderPage();

  expect(
    await screen.findByText(/hasn't texted in the last 30 days/),
  ).toBeTruthy();
  expect(screen.queryByLabelText("Text (415) 555-0101")).toBeNull();
});

it("explains that a short code can't be texted, and offers no opt-out", async () => {
  thread = { ...thread, phoneNumber: "72345", textable: false };
  renderPage();

  expect(await screen.findByText(/such as a short code/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Mark opted out" })).toBeNull();
});

it("marks the member view stale after a send or opt-out here", async () => {
  const client = renderPage();
  const memberKey = queryKeys.memberTextThreadAdmin(7);
  const memberViewStale = () => client.getQueryState(memberKey)?.isInvalidated;
  client.setQueryData(memberKey, thread);

  fireEvent.change(await screen.findByLabelText("Text (415) 555-0101"), {
    target: { value: "Happy to help" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(memberViewStale()).toBe(true));

  client.setQueryData(memberKey, thread);
  fireEvent.click(screen.getByRole("button", { name: "Mark opted out" }));
  const buttons = await screen.findAllByRole("button", {
    name: "Mark opted out",
  });
  fireEvent.click(buttons[buttons.length - 1]);
  await waitFor(() => expect(memberViewStale()).toBe(true));
});

it("marks the Texts list stale after a send here", async () => {
  const client = renderPage();
  const listKey = queryKeys.textThreadsAdmin({ page: 1, search: "" });
  client.setQueryData(listKey, { threads: [], hasMore: false });

  fireEvent.change(await screen.findByLabelText("Text (415) 555-0101"), {
    target: { value: "Happy to help" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() =>
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(true),
  );
});

it("marks the number's texts handled through the newest text, then undoes it", async () => {
  const client = renderPage();
  const button = await screen.findByRole("button", { name: "Mark handled" });
  button.focus();

  fireEvent.click(button);

  expect(await screen.findByRole("button", { name: "Mark needs reply" })).toBe(
    document.activeElement,
  );
  expect(handledBodies).toEqual([{ throughId: 1 }]);
  expect(client.getQueryState(queryKeys.needsReplyAdmin())?.isInvalidated).toBe(
    true,
  );

  fireEvent.click(screen.getByRole("button", { name: "Mark needs reply" }));

  expect(await screen.findByRole("button", { name: "Mark handled" })).toBe(
    document.activeElement,
  );
  expect(needsReplyBodies).toEqual([{ throughId: 1 }]);
});

it("shows a mark made while a poll of the thread is in flight", async () => {
  const client = renderPage();
  const button = await screen.findByRole("button", { name: "Mark handled" });
  let answerPoll = () => {};
  const beforeMark = thread;
  heldThread = new Promise<void>((resolve) => {
    answerPoll = resolve;
  }).then(() => beforeMark);
  void client.refetchQueries({
    queryKey: queryKeys.numberTextThreadAdmin(THREAD_ID),
  });
  await waitFor(() => expect(heldThread).toBeNull());

  fireEvent.click(button);
  await waitFor(() =>
    expect(
      client.getQueryState(queryKeys.needsReplyAdmin())?.isInvalidated,
    ).toBe(true),
  );
  answerPoll();

  await waitFor(() => expect(client.isFetching()).toBe(0));
  expect(screen.getByRole("button", { name: "Mark needs reply" })).toBeTruthy();
});

it("says why marking handled failed and keeps offering it", async () => {
  handledRefused = true;
  renderPage();

  fireEvent.click(await screen.findByRole("button", { name: "Mark handled" }));

  expect(
    await screen.findByText("Problem marking (415) 555-0101's texts handled"),
  ).toBeTruthy();
  expect(screen.getByText("That text isn't in this thread.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Mark handled" })).toBeTruthy();
});

it("offers neither mark when no text needs a reply", async () => {
  thread = { ...thread, replyState: "answered" };
  renderPage();

  await screen.findByText("Who is this?");
  expect(screen.queryByRole("button", { name: "Mark handled" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Mark needs reply" })).toBeNull();
});

it("marks the number opted out", async () => {
  renderPage();

  fireEvent.click(
    await screen.findByRole("button", { name: "Mark opted out" }),
  );
  const buttons = await screen.findAllByRole("button", {
    name: "Mark opted out",
  });
  fireEvent.click(buttons[buttons.length - 1]);

  expect(await screen.findByText("Opted out")).toBeTruthy();
});
