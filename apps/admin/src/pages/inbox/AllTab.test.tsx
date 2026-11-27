import type { ThreadSummaryDto } from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { resetClock } from "@alliance/shared/lib/useClockMinute";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { milliseconds } from "date-fns";
import { createMemoryRouter, RouterProvider } from "react-router";
import { MmsThreadsLiveContext, OFFLINE } from "../../lib/mmsThreadsLive";
import { AllTab } from "./AllTab";

const summary = (n: number, overrides: Partial<ThreadSummaryDto> = {}) => ({
  threadId: `00000000-0000-4000-8000-00000000000${n}`,
  phoneNumber: `+1415555010${n}`,
  members: [],
  lastMessageBody: `Text ${n}`,
  lastMessageDirection: "inbound" as const,
  lastMessageAt: "2025-03-04T12:00:00Z",
  ...overrides,
});

let requests: URLSearchParams[];
let searchGate: Promise<void>;
let failPage: string | null;

serveApi(
  routes({
    "GET /mms-threads": async ({ request }) => {
      const query = new URL(request.url).searchParams;
      requests.push(query);
      if (query.get("search")) await searchGate;
      if (query.get("page") === failPage) {
        return Response.json({ message: "down" }, { status: 500 });
      }
      return Response.json({
        threads:
          query.get("search") === "999"
            ? []
            : query.get("page") === "2"
              ? [summary(3)]
              : [
                  summary(1, {
                    members: [{ id: 7, name: "Sam", timeZone: null }],
                    lastMessageDirection: "outbound",
                    lastMessageBody: "See you there",
                  }),
                  summary(2, { lastMessageBody: "" }),
                ],
        hasMore: query.get("search") !== "999",
      });
    },
  }),
);

afterEach(resetClock);

beforeEach(() => {
  requests = [];
  searchGate = Promise.resolve();
  failPage = null;
});

const renderPage = (path = "/inbox?tab=all", live = OFFLINE) => {
  const { wrapper: Wrapper } = queryWrapper();
  const router = createMemoryRouter([{ path: "/inbox", element: <AllTab /> }], {
    initialEntries: [path],
  });
  render(
    <MmsThreadsLiveContext.Provider value={live}>
      <Wrapper>
        <RouterProvider router={router} />
      </Wrapper>
    </MmsThreadsLiveContext.Provider>,
  );
  return router;
};

it("names an admin replying on that number's row", async () => {
  renderPage("/inbox?tab=all", {
    ...OFFLINE,
    composers: [
      { phoneNumber: summary(2).phoneNumber, adminId: 2, adminName: "Priya" },
    ],
  });

  const row = await screen.findByRole("link", { name: /\(415\) 555-0102/ });
  expect(row.textContent).toContain("Priya is replying…");
  expect(screen.getByRole("link", { name: /Sam/ }).textContent).not.toContain(
    "replying",
  );
});

it("lists threads by member name or number, linking to each", async () => {
  renderPage();

  const sam = await screen.findByRole("link", { name: /Sam/ });
  expect(sam.getAttribute("href")).toBe(
    "/inbox/00000000-0000-4000-8000-000000000001?tab=all",
  );
  expect(sam.textContent).toContain("(415) 555-0101");
  expect(sam.textContent).toContain("Staff: See you there");
  expect(sam.textContent).toContain("Mar 4, 2025");
  expect(
    screen.getByRole("link", { name: /\(415\) 555-0102/ }).textContent,
  ).toContain("Sent an attachment");
});

it("searches by the number typed, keeping it in the URL", async () => {
  const router = renderPage();

  fireEvent.change(await screen.findByLabelText("Search by phone number"), {
    target: { value: "(415) 555" },
  });

  await waitFor(() => expect(requests.at(-1)?.get("search")).toBe("(415) 555"));
  expect(router.state.location.search).toBe("?tab=all&q=%28415%29+555");
});

it("pages to older texts and back", async () => {
  renderPage("/inbox?tab=all&page=2");

  expect(await screen.findByText("Text 3")).toBeTruthy();
  expect(requests.at(-1)?.get("page")).toBe("2");
  expect(
    screen.getByRole("link", { name: "Newer texts" }).getAttribute("href"),
  ).toBe("/inbox?tab=all&page=1");
  expect(
    screen.getByRole("link", { name: "Older texts" }).getAttribute("href"),
  ).toBe("/inbox?tab=all&page=3");
});

it("opens the next page at its first row", async () => {
  renderPage();

  const rows = (await screen.findByRole("list", { name: "All" })).parentElement;
  if (!rows) throw new Error("no rows pane");
  rows.scrollTop = 400;
  fireEvent.click(screen.getByRole("link", { name: "Older texts" }));

  expect(rows.scrollTop).toBe(0);
});

it("says when a search matches nothing", async () => {
  renderPage("/inbox?tab=all&q=999");

  expect(await screen.findByText("No results")).toBeTruthy();
});

it("keeps the current page up while the next loads, offering no page past it", async () => {
  renderPage();

  fireEvent.click(await screen.findByRole("link", { name: "Older texts" }));

  expect(screen.getByText("See you there", { exact: false })).toBeTruthy();
  expect(screen.getByText("Loading texts…").getAttribute("role")).toBe(
    "status",
  );
  expect(
    screen.getByRole("link", { name: "Newer texts" }).getAttribute("href"),
  ).toBe("/inbox?tab=all&page=1");
  expect(screen.queryByRole("link", { name: "Older texts" })).toBeNull();
  expect(await screen.findByText("Text 3")).toBeTruthy();
  expect(screen.queryByText("Loading texts…")).toBeNull();
});

it("asks for digits instead of listing every thread for a name", async () => {
  renderPage("/inbox?tab=all&q=Sam");

  expect(
    await screen.findByText("Search by the digits of a phone number."),
  ).toBeTruthy();
  expect(screen.queryByRole("link", { name: /Sam/ })).toBeNull();
  expect(requests).toEqual([]);
});

it("takes no more of a typed search than the server does, on a phone keypad", async () => {
  renderPage("/inbox?tab=all");

  const box = await screen.findByLabelText("Search by phone number");
  expect(box.getAttribute("maxlength")).toBe("40");
  expect(box.getAttribute("inputmode")).toBe("tel");
});

it("refuses a longer search from the URL", async () => {
  renderPage(`/inbox?tab=all&q=${"5".repeat(41)}`);

  expect(
    await screen.findByText("Search by at most 40 characters."),
  ).toBeTruthy();
  expect(requests).toEqual([]);
});

it("drops the previous rows while a new search loads", async () => {
  let answer = () => {};
  searchGate = new Promise((resolve) => (answer = resolve));
  renderPage();
  fireEvent.change(await screen.findByLabelText("Search by phone number"), {
    target: { value: "999" },
  });

  expect(await screen.findByRole("status", { name: "Loading" })).toBeTruthy();
  expect(screen.queryByText("See you there", { exact: false })).toBeNull();
  answer();
  expect(await screen.findByText("No results")).toBeTruthy();
});

it("says no more texts past the last page of a search", async () => {
  renderPage("/inbox?tab=all&q=999&page=3");

  expect(await screen.findByText("No more texts")).toBeTruthy();
});

it("offers the newer page when a page fails to load", async () => {
  failPage = "5";
  renderPage("/inbox?tab=all&page=5");

  expect(
    (await screen.findByRole("link", { name: "Newer texts" })).getAttribute(
      "href",
    ),
  ).toBe("/inbox?tab=all&page=4");
});

it("dates a row from yesterday once the page stays open past midnight", () => {
  jest.useFakeTimers({ now: new Date(2026, 10, 16, 23, 59) });
  const { wrapper: Wrapper, client } = queryWrapper({ staleTime: Infinity });
  client.setQueryData(queryKeys.textThreadsAdmin({ page: 1, search: "" }), {
    threads: [
      summary(1, { lastMessageAt: new Date(2026, 10, 16, 21).toISOString() }),
    ],
    hasMore: false,
  });
  const router = createMemoryRouter([{ path: "/inbox", element: <AllTab /> }], {
    initialEntries: ["/inbox?tab=all"],
  });
  render(
    <Wrapper>
      <RouterProvider router={router} />
    </Wrapper>,
  );
  expect(screen.getByText("9:00 PM")).toBeTruthy();

  act(() => jest.advanceTimersByTime(milliseconds({ minutes: 2 })));

  expect(screen.getByText("Nov 16")).toBeTruthy();
});
