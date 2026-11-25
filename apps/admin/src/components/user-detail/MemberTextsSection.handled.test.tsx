import type {
  MmsMessageDto,
  MmsThreadDto,
  MmsThreadEventDto,
  MmsThreadEventKind,
} from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { z } from "zod";
import MemberTextsSection from "./MemberTextsSection";

const text = (
  id: number,
  overrides: Partial<MmsMessageDto> = {},
): MmsMessageDto => ({
  id,
  direction: "inbound",
  body: `Text ${id}`,
  status: "received",
  errorCode: null,
  errorMessage: null,
  createdAt: "2026-11-10T18:00:00Z",
  sentByStaff: false,
  sentByName: null,
  events: [],
  media: [],
  ...overrides,
});

const event = (
  id: number,
  kind: MmsThreadEventKind,
  markedByName: string | null = "Alex",
): MmsThreadEventDto => ({
  id,
  kind,
  markedByName,
  createdAt: "2026-11-10T19:00:00Z",
});

const recorded = (params: {
  replyState: MmsThreadDto["replyState"];
  throughId: number;
  kind: MmsThreadEventKind;
}): MmsThreadDto => ({
  ...thread,
  replyState: params.replyState,
  messages: thread.messages.map((m) =>
    m.id === params.throughId
      ? { ...m, events: [...m.events, event(m.events.length + 1, params.kind)] }
      : m,
  ),
});

const throughIdOf = async (request: Request) =>
  z.object({ throughId: z.number() }).parse(await request.json()).throughId;

let thread: MmsThreadDto;
let markedThrough: number[];
let unmarkedThrough: number[];
let markRefusal: string | null;
let sentStatus: "queued" | "undelivered";

serveApi(
  routes({
    "GET /mms-threads/7": () => Response.json(thread),
    "POST /mms-threads/7": () => {
      const sent = text(3, {
        direction: "outbound",
        body: "Happy to help",
        status: sentStatus,
        sentByStaff: true,
        sentByName: "Kim",
      });
      thread = {
        ...thread,
        replyState: sentStatus === "queued" ? "answered" : thread.replyState,
        messages: [...thread.messages, sent],
      };
      return Response.json(sent);
    },
    "POST /mms-threads/7/handled": async ({ request }) => {
      if (markRefusal)
        return Response.json({ message: markRefusal }, { status: 400 });
      const throughId = await throughIdOf(request);
      markedThrough.push(throughId);
      thread = recorded({
        replyState: "handled",
        throughId,
        kind: "marked_handled",
      });
      return new Response(null, { status: 204 });
    },
    "POST /mms-threads/7/needs-reply": async ({ request }) => {
      const throughId = await throughIdOf(request);
      unmarkedThrough.push(throughId);
      thread = recorded({
        replyState: "needs_reply",
        throughId,
        kind: "marked_needs_reply",
      });
      return new Response(null, { status: 204 });
    },
  }),
);

beforeEach(() => {
  thread = {
    threadId: null,
    phoneNumber: "+14155550123",
    textable: true,
    optedOut: false,
    replyState: "needs_reply",
    messages: [text(1), text(2)],
    hasOlder: false,
  };
  markedThrough = [];
  unmarkedThrough = [];
  markRefusal = null;
  sentStatus = "queued";
});

const renderSection = () => {
  const { wrapper: Wrapper, client } = queryWrapper();
  client.setQueryData(queryKeys.needsReplyAdmin(), []);
  render(
    <Wrapper>
      <ToastProvider>
        <MemberTextsSection member={{ id: 7, name: "Sam", timeZone: null }} />
      </ToastProvider>
    </Wrapper>,
  );
};

it("marks the texts handled through the newest one shown", async () => {
  renderSection();
  fireEvent.click(await screen.findByRole("button", { name: "Mark handled" }));

  await screen.findByRole("button", { name: "Mark needs reply" });
  expect(markedThrough).toEqual([2]);
  expect(screen.getAllByText(/^Marked handled by Alex/)).toHaveLength(1);
});

it("marks handled texts as needing a reply again, keeping the marking in the thread", async () => {
  thread = recorded({
    replyState: "handled",
    throughId: 2,
    kind: "marked_handled",
  });
  renderSection();
  fireEvent.click(
    await screen.findByRole("button", { name: "Mark needs reply" }),
  );

  await screen.findByRole("button", { name: "Mark handled" });
  expect(unmarkedThrough).toEqual([2]);
  expect(
    screen
      .getAllByText(/^Marked (handled|needs reply) by/)
      .map((note) => note.textContent?.split(" · ")[0]),
  ).toEqual(["Marked handled by Alex", "Marked needs reply by Alex"]);
});

const sendReply = async () => {
  renderSection();
  await screen.findByRole("button", { name: "Mark handled" });
  fireEvent.change(screen.getByLabelText("Text Sam"), {
    target: { value: "Happy to help" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("Happy to help");
};

it("drops the control once staff send a reply", async () => {
  await sendReply();

  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Mark handled" })).toBeNull(),
  );
});

it("keeps the control when the reply wasn't delivered", async () => {
  sentStatus = "undelivered";
  await sendReply();

  expect(screen.getByRole("button", { name: "Mark handled" })).toBeTruthy();
});

it("notes each marking under the text it followed", async () => {
  thread = {
    ...thread,
    replyState: "answered",
    messages: [
      text(1, { events: [event(1, "marked_handled")] }),
      text(2, { direction: "outbound", sentByStaff: true, sentByName: "Kim" }),
      text(3, { events: [event(2, "marked_handled", null)] }),
    ],
  };
  renderSection();

  await screen.findByText("Text 3");
  expect(
    screen.getAllByText(/^Marked handled by/).map((note) => note.textContent),
  ).toEqual([
    expect.stringMatching(/^Marked handled by Alex · /),
    expect.stringMatching(/^Marked handled by Deleted user · /),
  ]);
  expect(screen.queryByRole("button", { name: "Mark handled" })).toBeNull();
});

it("offers no control for an opted-out member", async () => {
  thread = { ...thread, optedOut: true };
  renderSection();

  await screen.findByText("Opted out");
  expect(screen.queryByRole("button", { name: "Mark handled" })).toBeNull();
});

it("raises a toast when marking handled fails", async () => {
  markRefusal = "That text isn't in this thread.";
  renderSection();
  fireEvent.click(await screen.findByRole("button", { name: "Mark handled" }));

  await screen.findByText("Problem marking Sam's texts handled");
  await waitFor(() =>
    expect(screen.getByText("That text isn't in this thread.")).toBeTruthy(),
  );
});
