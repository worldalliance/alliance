import type { EventLogListDto } from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, jest, spyOn } from "bun:test";
import { MemoryRouter } from "react-router";
import type { EventLogWsEvent } from "../../lib/useEventLogWebSocket";
import * as eventLogSocket from "../../lib/useEventLogWebSocket";
import { ToastProvider } from "../../ui/ToastProvider";
import EventLogPage from "./EventLogPage";

let onNewEvent: ((event: EventLogWsEvent) => void) | null = null;

// Stable, like the real hook's callbacks: the stream resets when they change.
const socket = {
  isConnected: true,
  setOnNewEvent: (handler: typeof onNewEvent) => {
    onNewEvent = handler;
  },
  setOnInviteCreated: () => {},
};
beforeEach(() => {
  spyOn(eventLogSocket, "useEventLogWebSocket").mockReturnValue(socket);
});

let newOnServer: EventLogListDto["items"] = [];

const listPage = (page: number) =>
  ({
    items: [
      ...(page === 1 ? newOnServer : []),
      {
        id: `fetched-${page}`,
        event: "account_created",
        message: `Fetched on page ${page}`,
        blob: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        userId: null,
      },
    ],
    totalCount: 120 + (page === 1 ? newOnServer.length : 0),
    page,
    limit: 50,
    totalPages: 3,
  }) satisfies EventLogListDto;

const listRequests: string[] = [];
serveApi(
  routes({
    "GET /eventlog": ({ request }) => {
      const search = new URL(request.url).searchParams;
      listRequests.push(search.toString());
      return Response.json(listPage(Number(search.get("page"))));
    },
  }),
);

afterEach(() => {
  listRequests.length = 0;
  newOnServer = [];
  onNewEvent = null;
  jest.restoreAllMocks();
});

let arrivals = 0;
const arrive = (message: string, id = `live-${++arrivals}`) =>
  act(() =>
    onNewEvent?.({
      id,
      event: "sms_inbound",
      message,
      createdAt: "2026-01-02T00:00:00.000Z",
    }),
  );

const renderPage = async (url = "/activity") => {
  const { wrapper: QueryProvider } = queryWrapper();
  const page = () => (
    <QueryProvider>
      <MemoryRouter initialEntries={[url]}>
        <ToastProvider>
          <EventLogPage />
        </ToastProvider>
      </MemoryRouter>
    </QueryProvider>
  );
  const view = render(page());
  await screen.findByText(/^Fetched on page/);
  return { rerender: () => view.rerender(page()) };
};

const messages = () =>
  screen
    .getAllByRole("button", { name: /^Details: / })
    .map((button) => button.getAttribute("aria-label")?.slice(9));

it("puts an event that arrives while nobody reads at the top", async () => {
  await renderPage();
  await arrive("Hello");
  expect(messages()).toEqual(["Hello", "Fetched on page 1"]);
});

it("holds events while a row is open, and shows them on request", async () => {
  await renderPage();
  fireEvent.click(
    screen.getByRole("button", { name: "Details: Fetched on page 1" }),
  );
  await arrive("First");
  await arrive("Second");
  expect(messages()).toEqual(["Fetched on page 1"]);

  const scrollTo = spyOn(Element.prototype, "scrollTo");
  const focus = spyOn(HTMLElement.prototype, "focus");
  fireEvent.click(screen.getByRole("button", { name: "Show 2 new events" }));
  expect(messages()).toEqual(["Second", "First", "Fetched on page 1"]);
  expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  expect(focus).toHaveBeenCalledWith({ preventScroll: true });
});

it("holds events a refetch brings while a row is open", async () => {
  const { rerender } = await renderPage();
  fireEvent.click(
    screen.getByRole("button", { name: "Details: Fetched on page 1" }),
  );
  await arrive("From the socket", "socket-1");
  newOnServer = [
    {
      id: "refetched-1",
      event: "sms_inbound",
      message: "From the refetch",
      blob: null,
      createdAt: "2026-01-03T00:00:00.000Z",
      userId: null,
    },
    {
      id: "socket-1",
      event: "sms_inbound",
      message: "From the socket",
      blob: null,
      createdAt: "2026-01-02T00:00:00.000Z",
      userId: null,
    },
  ];
  spyOn(eventLogSocket, "useEventLogWebSocket").mockReturnValue({
    ...socket,
    isConnected: false,
  });
  rerender();
  spyOn(eventLogSocket, "useEventLogWebSocket").mockReturnValue(socket);
  rerender();
  await waitFor(() => expect(listRequests).toHaveLength(2));
  await screen.findByRole("button", { name: "Show 2 new events" });
  expect(messages()).toEqual(["Fetched on page 1"]);
  expect(screen.getByText(/122 events/)).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Show 2 new events" }));
  expect(messages()).toEqual([
    "From the refetch",
    "From the socket",
    "Fetched on page 1",
  ]);
  expect(screen.getByText(/122 events/)).toBeTruthy();
});

it("loads only the page a pasted link names", async () => {
  await renderPage("/activity?page=3");
  expect(listRequests).toEqual(["page=3&limit=50"]);
});

it("refetches page 1 after the socket reconnects", async () => {
  const { rerender } = await renderPage();
  spyOn(eventLogSocket, "useEventLogWebSocket").mockReturnValue({
    ...socket,
    isConnected: false,
  });
  rerender();
  spyOn(eventLogSocket, "useEventLogWebSocket").mockReturnValue(socket);
  rerender();
  await waitFor(() =>
    expect(listRequests).toEqual(["page=1&limit=50", "page=1&limit=50"]),
  );
});

it("streams again on page 1 after a row was opened on another page", async () => {
  await renderPage("/activity?page=2");
  fireEvent.click(
    screen.getByRole("button", { name: "Details: Fetched on page 2" }),
  );
  await arrive("Ignored off page 1");
  expect(messages()).toEqual(["Fetched on page 2"]);

  fireEvent.click(screen.getByRole("button", { name: /previous/i }));
  await screen.findByText("Fetched on page 1");
  await arrive("Back on page 1");
  expect(messages()).toEqual(["Back on page 1", "Fetched on page 1"]);
});

it("doesn't repeat an event the refetched page already has", async () => {
  await renderPage();
  await arrive("Already fetched", "fetched-1");
  expect(messages()).toEqual(["Fetched on page 1"]);
});

it("announces every arrival, the same message twice included", async () => {
  await renderPage();
  await arrive("Text failed");
  const status = screen.getByText(/^New event: Text failed/);
  const first = status.textContent;
  await arrive("Text failed");
  expect(status.textContent).not.toBe(first);
});
