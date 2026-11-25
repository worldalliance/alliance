import type {
  MmsMessageDto,
  MmsThreadDto,
} from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { retryUnlessRefused } from "@alliance/shared/lib/retryQuery";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import type { DefaultOptions } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ToastProvider } from "../../ui/ToastProvider";
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
  events: [],
  media: [],
  ...overrides,
});

let thread: MmsThreadDto;
let threadFails: boolean;
let threadDelayMs: number;
let sentBodies: unknown[];

serveApi(
  routes({
    "GET /mms-threads/7": async () => {
      await new Promise((resolve) => setTimeout(resolve, threadDelayMs));
      return threadFails
        ? Response.json({ message: "down" }, { status: 500 })
        : Response.json(thread);
    },
    "POST /mms-threads/7": async ({ request }) => {
      const body = await request.json();
      sentBodies.push(body);
      if (body.afterId !== thread.messages.at(-1)?.id) {
        return Response.json(
          { statusCode: 409, error: "newer_texts", message: "Newer texts" },
          { status: 409 },
        );
      }
      const sent = message({ id: 99, body: body.body, sentByStaff: true });
      thread = { ...thread, messages: [...thread.messages, sent] };
      return Response.json(sent);
    },
    "GET /mms-threads/needs-reply-threads": () => Response.json([]),
  }),
);

beforeEach(() => {
  threadFails = false;
  threadDelayMs = 0;
  sentBodies = [];
  thread = {
    threadId: null,
    phoneNumber: "+14155550123",
    textable: true,
    optedOut: false,
    replyState: "answered",
    messages: [
      message({ id: 2, direction: "inbound", body: "What do I do?" }),
      message({ id: 5, body: "Reply here", sentByStaff: true }),
    ],
    hasOlder: false,
  };
});

const renderSection = (queries?: DefaultOptions["queries"]) => {
  const { wrapper: Wrapper, client } = queryWrapper(queries);
  client.setQueryData(queryKeys.needsReplyAdmin(), []);
  render(
    <Wrapper>
      <ToastProvider>
        <MemoryRouter>
          <MemberTextsSection member={{ id: 7, name: "Sam", timeZone: null }} />
        </MemoryRouter>
      </ToastProvider>
    </Wrapper>,
  );
  return client;
};

it("refetches the thread when newer texts refuse a send, and resends after them", async () => {
  renderSection();
  fireEvent.change(await screen.findByLabelText("Text Sam"), {
    target: { value: "Happy to help" },
  });
  thread = {
    ...thread,
    messages: [
      ...thread.messages,
      message({ id: 6, direction: "inbound", body: "Never mind, found it" }),
    ],
  };
  threadDelayMs = 100;
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  const sendAnyway = await screen.findByRole("button", { name: "Send anyway" });
  expect(screen.getByText("Never mind, found it")).toBeTruthy();
  fireEvent.click(sendAnyway);

  expect(await screen.findByText("Happy to help")).toBeTruthy();
  expect(sentBodies).toEqual([
    { body: "Happy to help", afterId: 5 },
    { body: "Happy to help", afterId: 6 },
  ]);
});

it("says at once when the new texts behind a refusal fail to load", async () => {
  renderSection({ retry: retryUnlessRefused(3) });
  fireEvent.change(await screen.findByLabelText("Text Sam"), {
    target: { value: "Happy to help" },
  });
  thread = {
    ...thread,
    messages: [
      ...thread.messages,
      message({ id: 6, direction: "inbound", body: "Never mind, found it" }),
    ],
  };
  threadFails = true;
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  expect(
    await screen.findByText(
      "New texts arrived but couldn't be loaded. Try again in a moment.",
    ),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Send anyway" })).toBeNull();
});

it("refuses a send over a text that loaded while the admin wrote", async () => {
  const client = renderSection();
  fireEvent.change(await screen.findByLabelText("Text Sam"), {
    target: { value: "Happy to help" },
  });
  thread = {
    ...thread,
    messages: [
      ...thread.messages,
      message({ id: 6, direction: "inbound", body: "Never mind, found it" }),
    ],
  };
  await client.invalidateQueries({
    queryKey: queryKeys.memberTextThreadAdmin(7),
  });
  expect(await screen.findByText("Never mind, found it")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  expect(
    await screen.findByRole("button", { name: "Send anyway" }),
  ).toBeTruthy();
  expect(sentBodies).toEqual([{ body: "Happy to help", afterId: 5 }]);
});
