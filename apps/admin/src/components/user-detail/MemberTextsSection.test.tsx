import type {
  MmsMessageDto,
  MmsThreadDto,
} from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import type { QueryClient } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useNeedsReplyAdmin } from "../../lib/useMemberTextsAdmin";
import MemberTextsSection from "./MemberTextsSection";

const message = (overrides: Partial<MmsMessageDto>): MmsMessageDto => ({
  id: 1,
  direction: "outbound",
  body: "",
  status: "delivered",
  errorCode: null,
  errorMessage: null,
  createdAt: "2026-11-10T18:00:00Z",
  sentByStaff: false,
  sentByName: null,
  media: [],
  ...overrides,
});

let thread: MmsThreadDto;
let threadFails: boolean;
let kimsThread: MmsThreadDto;
let sentBodies: unknown[];
let sendRefusal: string | null;
let needsReplyGate: Promise<void>;
let postSaved: () => void;
let postGate: Promise<void>;

serveApi(
  routes({
    "GET /mms-threads/7": () =>
      threadFails
        ? Response.json({ message: "down" }, { status: 500 })
        : Response.json(thread),
    "GET /mms-threads/8": () => Response.json(kimsThread),
    "POST /mms-threads/7": async ({ request }) => {
      const body = await request.json();
      sentBodies.push(body);
      if (sendRefusal) {
        postSaved();
        await postGate;
        return Response.json({ message: sendRefusal }, { status: 422 });
      }
      const sent = message({
        id: 99,
        body: body.body,
        sentByStaff: true,
        sentByName: "Alex",
        status: "queued",
      });
      thread = { ...thread, messages: [...thread.messages, sent] };
      postSaved();
      await postGate;
      return Response.json(sent);
    },
    "GET /mms-threads/needs-reply": async () => {
      await needsReplyGate;
      return Response.json([]);
    },
  }),
);

beforeEach(() => {
  threadFails = false;
  sentBodies = [];
  sendRefusal = null;
  needsReplyGate = Promise.resolve();
  postSaved = () => {};
  postGate = Promise.resolve();
  thread = {
    phoneNumber: "+14155550123",
    textable: true,
    optedOut: false,
    messages: [
      message({ id: 1, body: "New action is live" }),
      message({ id: 2, direction: "inbound", body: "What do I do?" }),
      message({
        id: 3,
        body: "Reply here",
        sentByStaff: true,
        sentByName: "Alex",
        status: "undelivered",
        errorMessage: "Unreachable destination handset",
      }),
      message({ id: 5, body: "Left the team since", sentByStaff: true }),
    ],
    hasOlder: false,
  };
  kimsThread = {
    phoneNumber: "+14155550188",
    textable: true,
    optedOut: false,
    messages: [message({ id: 6, direction: "inbound", body: "Hi" })],
    hasOlder: false,
  };
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
  return client;
};

it("shows who sent each text, and why one failed", async () => {
  renderSection();

  expect(await screen.findByText("What do I do?")).toBeTruthy();
  expect(screen.getByText(/^Automated ·/)).toBeTruthy();
  expect(screen.getByText(/^Sam ·/)).toBeTruthy();
  expect(screen.getByText(/^Alex ·/)).toBeTruthy();
  expect(screen.getByText(/^Deleted user ·/)).toBeTruthy();
  expect(
    screen.getByText(/Not delivered: Unreachable destination handset/),
  ).toBeTruthy();
});

const needsReplyInvalidated = (client: QueryClient) =>
  client.getQueryState(queryKeys.needsReplyAdmin())?.isInvalidated;

it("sends a text, adds it to the thread and refreshes Needs Reply", async () => {
  const client = renderSection();
  fireEvent.change(await screen.findByLabelText("Text Sam"), {
    target: { value: "Happy to help" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  expect(await screen.findByText("Happy to help")).toBeTruthy();
  expect(sentBodies).toEqual([{ body: "Happy to help" }]);
  await waitFor(() => expect(needsReplyInvalidated(client)).toBe(true));
});

it("frees the composer without waiting for Needs Reply to refresh", async () => {
  needsReplyGate = new Promise(() => {});
  const { wrapper: Wrapper } = queryWrapper();
  const NeedsReplyObserver = () => {
    useNeedsReplyAdmin();
    return null;
  };
  render(
    <Wrapper>
      <ToastProvider>
        <NeedsReplyObserver />
        <MemberTextsSection member={{ id: 7, name: "Sam", timeZone: null }} />
      </ToastProvider>
    </Wrapper>,
  );
  fireEvent.change(await screen.findByLabelText("Text Sam"), {
    target: { value: "Happy to help" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  expect(await screen.findByText("Happy to help")).toBeTruthy();
  await waitFor(() =>
    expect(screen.getByLabelText<HTMLTextAreaElement>("Text Sam").value).toBe(
      "",
    ),
  );
  expect(screen.getByRole("button", { name: "Send" })).toBeTruthy();
});

it("shows a sent text once when a poll fetched it before the send answered", async () => {
  let openGate = () => {};
  postGate = new Promise((resolve) => (openGate = resolve));
  const saved = new Promise<void>((resolve) => (postSaved = resolve));
  const client = renderSection();
  fireEvent.change(await screen.findByLabelText("Text Sam"), {
    target: { value: "Happy to help" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await saved;
  await client.refetchQueries({
    queryKey: queryKeys.memberTextThreadAdmin(7),
  });
  openGate();

  await waitFor(() =>
    expect(screen.getByLabelText("Text Sam").textContent).toBe(""),
  );
  expect(screen.getAllByText("Happy to help")).toHaveLength(1);
  expect(
    cachedBodies(client, 7)?.filter((body) => body === "Happy to help"),
  ).toHaveLength(1);
});

const renderSamThenKim = () => {
  const { wrapper: Wrapper, client } = queryWrapper();
  client.setQueryData(queryKeys.memberTextThreadAdmin(8), kimsThread);
  const section = (member: { id: number; name: string }) => (
    <Wrapper>
      <ToastProvider>
        <MemberTextsSection member={{ ...member, timeZone: null }} />
      </ToastProvider>
    </Wrapper>
  );
  const { rerender } = render(section({ id: 7, name: "Sam" }));
  return {
    client,
    moveToKim: () => rerender(section({ id: 8, name: "Kim" })),
  };
};

const cachedBodies = (client: QueryClient, userId: number) =>
  client
    .getQueryData<MmsThreadDto>(queryKeys.memberTextThreadAdmin(userId))
    ?.messages.map((m) => m.body);

it("starts a fresh thread and draft when the page moves to another member", async () => {
  const { moveToKim } = renderSamThenKim();
  fireEvent.change(await screen.findByLabelText("Text Sam"), {
    target: { value: "Meant for Sam" },
  });
  const samsThread = screen.getByRole("region", { name: "Text history" });

  moveToKim();

  expect(screen.getByText("Hi")).toBeTruthy();
  expect(screen.queryByText("What do I do?")).toBeNull();
  expect(screen.getByLabelText<HTMLTextAreaElement>("Text Kim").value).toBe("");
  expect(screen.getByRole("region", { name: "Text history" })).not.toBe(
    samsThread,
  );
});

it("keeps a send that answers after the page moves on in the first member's thread", async () => {
  let openGate = () => {};
  postGate = new Promise((resolve) => (openGate = resolve));
  const saved = new Promise<void>((resolve) => (postSaved = resolve));
  const { client, moveToKim } = renderSamThenKim();
  fireEvent.change(await screen.findByLabelText("Text Sam"), {
    target: { value: "Meant for Sam" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await saved;
  moveToKim();
  openGate();

  await waitFor(() =>
    expect(cachedBodies(client, 7)).toContain("Meant for Sam"),
  );
  expect(cachedBodies(client, 8)).not.toContain("Meant for Sam");
  expect(screen.queryByText("Meant for Sam")).toBeNull();
});

it("says a send failed after the page moved on, naming its member", async () => {
  sendRefusal = "Twilio refused this number.";
  let openGate = () => {};
  postGate = new Promise((resolve) => (openGate = resolve));
  const saved = new Promise<void>((resolve) => (postSaved = resolve));
  const { moveToKim } = renderSamThenKim();
  fireEvent.change(await screen.findByLabelText("Text Sam"), {
    target: { value: "Meant for Sam" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await saved;
  moveToKim();
  openGate();

  expect(
    await screen.findByText(
      'Twilio refused this number. Your text: "Meant for Sam"',
    ),
  ).toBeTruthy();
  expect(screen.getByText("Problem sending text to Sam")).toBeTruthy();
});

it("replaces the composer for an opted-out member", async () => {
  thread = { ...thread, optedOut: true };
  renderSection();

  expect(await screen.findByText("Opted out")).toBeTruthy();
  expect(screen.queryByLabelText("Text Sam")).toBeNull();
  expect(screen.getByText(/opt back in by\s+texting START/)).toBeTruthy();
});

it("says in the thread that a member with no phone number can't be texted", async () => {
  thread = {
    phoneNumber: null,
    textable: false,
    optedOut: false,
    messages: [],
    hasOlder: false,
  };
  renderSection();

  expect(
    await screen.findByText(
      "No phone number on file, so this member can't be texted.",
    ),
  ).toBeTruthy();
  expect(screen.getAllByText(/phone number/)).toHaveLength(1);
  expect(
    within(screen.getByRole("region", { name: "Text history" })).getByText(
      /No phone number/,
    ),
  ).toBeTruthy();
  expect(screen.queryByText(/No texts/)).toBeNull();
  expect(screen.queryByLabelText("Text Sam")).toBeNull();
});

it("says a member whose number isn't valid can't be texted", async () => {
  thread = { ...thread, phoneNumber: "12345", textable: false };
  renderSection();

  expect(
    await screen.findByText(
      /phone number isn't valid, so they\s+can't be texted/,
    ),
  ).toBeTruthy();
  expect(screen.queryByLabelText("Text Sam")).toBeNull();
  expect(screen.queryByRole("button", { name: "Mark opted out" })).toBeNull();
});

it("dates a text from an earlier year with its year", async () => {
  thread = {
    ...thread,
    messages: [
      message({ id: 1, createdAt: "2020-03-04T12:00:00Z" }),
      message({
        id: 2,
        direction: "inbound",
        createdAt: new Date().toISOString(),
      }),
    ],
  };
  renderSection();

  expect(await screen.findByText(/^Automated · Mar 4, 2020,/)).toBeTruthy();
  expect(screen.getByText(/^Sam ·/).textContent).not.toMatch(/\d{4}/);
});

it("shows images inline, other files as downloads, and uncopied ones as loading or unavailable", async () => {
  thread = {
    ...thread,
    messages: [
      message({
        id: 4,
        direction: "inbound",
        media: [
          { id: 10, contentType: "image/jpeg", status: "ready", inline: true },
          { id: 11, contentType: "video/mp4", status: "ready", inline: false },
          { id: 12, contentType: "image/png", status: "copying", inline: true },
          {
            id: 13,
            contentType: "image/png",
            status: "unavailable",
            inline: true,
          },
        ],
      }),
    ],
  };
  renderSection();

  const image = await screen.findByAltText<HTMLImageElement>(
    "Image texted by Sam",
  );
  expect(image.src).toMatch(/\/mms-threads\/media\/10$/);
  expect(
    screen
      .getByRole("link", { name: "Download attachment (video/mp4)" })
      .getAttribute("href"),
  ).toMatch(/\/mms-threads\/media\/11$/);
  expect(screen.getByText("Attachment still loading…")).toBeTruthy();
  expect(screen.getByText("Attachment unavailable")).toBeTruthy();
});

it("says a poll failed beside the heading, keeping the thread", async () => {
  const client = renderSection();
  await screen.findByText("What do I do?");

  threadFails = true;
  await client.refetchQueries({
    queryKey: queryKeys.memberTextThreadAdmin(7),
  });

  const error = await screen.findByText(/Could not refresh texts/);
  const heading = screen.getByRole("heading", { name: "Texts" });
  expect(heading.parentElement?.contains(error)).toBe(true);
  expect(screen.getByText("What do I do?")).toBeTruthy();
});

it("scrolls to a text staff send while reading older ones, even once a reply follows it", async () => {
  let openGate = () => {};
  postGate = new Promise((resolve) => (openGate = resolve));
  const saved = new Promise<void>((resolve) => (postSaved = resolve));
  const client = renderSection();
  const log = await screen.findByRole("region", { name: "Text history" });
  Object.defineProperties(log, {
    scrollHeight: { value: 1000 },
    clientHeight: { value: 200 },
  });
  log.scrollTop = 100;
  fireEvent.scroll(log);

  fireEvent.change(screen.getByLabelText("Text Sam"), {
    target: { value: "Happy to help" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await saved;
  const reply = message({ id: 100, direction: "inbound", body: "Thanks!" });
  thread = { ...thread, messages: [...thread.messages, reply] };
  await client.refetchQueries({
    queryKey: queryKeys.memberTextThreadAdmin(7),
  });
  await screen.findByText("Thanks!");
  expect(log.scrollTop).toBe(100);
  openGate();

  await waitFor(() => expect(log.scrollTop).toBe(1000));
});
