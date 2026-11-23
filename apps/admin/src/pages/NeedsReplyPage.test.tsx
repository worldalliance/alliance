import type { NeedsReplyThreadDto } from "@alliance/shared/client/types.gen";
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
import { MemoryRouter } from "react-router";
import { MmsThreadsLiveContext, OFFLINE } from "../lib/mmsThreadsLive";
import NeedsReplyPage from "./NeedsReplyPage";

let threads: NeedsReplyThreadDto[];

const threadIdOf = (userId: number) =>
  `00000000-0000-4000-8000-${String(userId).padStart(12, "0")}`;

const waiting = (input: {
  userId: number;
  name: string;
  lastMessageBody: string;
  waitingSince: string;
}): NeedsReplyThreadDto => ({
  threadId: threadIdOf(input.userId),
  phoneNumber: `+1415555${String(input.userId).padStart(4, "0")}`,
  members: [{ id: input.userId, name: input.name, timeZone: null }],
  lastMessageBody: input.lastMessageBody,
  waitingSince: input.waitingSince,
});
let status: number;

serveApi(
  routes({
    "GET /mms-threads/needs-reply-threads": () =>
      Response.json(status === 200 ? threads : { message: "nope" }, {
        status,
      }),
  }),
);

beforeEach(() => {
  status = 200;
  threads = [];
});

afterEach(resetClock);

const renderPage = (live = OFFLINE) => {
  const { wrapper: Wrapper, client } = queryWrapper();
  render(
    <Wrapper>
      <MmsThreadsLiveContext.Provider value={live}>
        <MemoryRouter>
          <NeedsReplyPage />
        </MemoryRouter>
      </MmsThreadsLiveContext.Provider>
    </Wrapper>,
  );
  return client;
};

it("links each waiting number to its thread with its last text", async () => {
  threads = [
    waiting({
      userId: 7,
      name: "Sam",
      lastMessageBody: "Is it still on?",
      waitingSince: new Date().toISOString(),
    }),
    waiting({
      userId: 8,
      name: "Kim",
      lastMessageBody: "",
      waitingSince: new Date().toISOString(),
    }),
  ];
  renderPage();

  const sam = await screen.findByRole("link", { name: /Sam/ });
  expect(sam.getAttribute("href")).toBe(`/texts/${threadIdOf(7)}`);
  expect(sam.textContent).toContain("Is it still on?");
  expect(screen.getByRole("link", { name: /Kim/ }).textContent).toContain(
    "Sent an attachment",
  );
});

it("names a waiting number no member has by its phone number", async () => {
  threads = [
    {
      threadId: threadIdOf(9),
      phoneNumber: "+14155550109",
      members: [],
      lastMessageBody: "Who is this?",
      waitingSince: new Date().toISOString(),
    },
  ];
  renderPage();

  const row = await screen.findByRole("link", { name: /\(415\) 555-0109/ });
  expect(row.getAttribute("href")).toBe(`/texts/${threadIdOf(9)}`);
});

it("names an admin replying to a waiting number on its row, member or not", async () => {
  threads = [
    waiting({
      userId: 7,
      name: "Sam",
      lastMessageBody: "Is it still on?",
      waitingSince: new Date().toISOString(),
    }),
    {
      threadId: threadIdOf(9),
      phoneNumber: "+14155550109",
      members: [],
      lastMessageBody: "Who is this?",
      waitingSince: new Date().toISOString(),
    },
  ];
  renderPage({
    ...OFFLINE,
    composers: [
      { phoneNumber: "+14155550007", adminId: 2, adminName: "Priya" },
      { phoneNumber: "+14155550109", adminId: 3, adminName: "Ana" },
    ],
  });

  const sam = await screen.findByRole("link", { name: /Sam/ });
  expect(sam.textContent).toContain("Priya is replying…");
  expect(sam.textContent).not.toContain("Ana");
  expect(
    screen.getByRole("link", { name: /\(415\) 555-0109/ }).textContent,
  ).toContain("Ana is replying…");
});

it("says when nothing is waiting", async () => {
  renderPage();
  expect(
    await screen.findByText("No texts are waiting for a reply."),
  ).toBeTruthy();
  expect(statusTexts()).toContain("None waiting");
});

it("says when the list failed to load", async () => {
  status = 500;
  renderPage();
  expect(
    await screen.findByText("Couldn't load texts needing a reply."),
  ).toBeTruthy();
});

it("keeps how long each number has waited current", () => {
  jest.useFakeTimers({ now: new Date("2026-11-11T20:00:00Z") });
  try {
    threads = [
      waiting({
        userId: 7,
        name: "Sam",
        lastMessageBody: "Hello?",
        waitingSince: "2026-11-11T19:58:00Z",
      }),
    ];
    const { wrapper: Wrapper, client } = queryWrapper();
    client.setQueryData(queryKeys.needsReplyAdmin(), threads);
    render(
      <Wrapper>
        <MemoryRouter>
          <NeedsReplyPage />
        </MemoryRouter>
      </Wrapper>,
    );
    expect(screen.getByText("Waiting 2 minutes")).toBeTruthy();

    act(() => jest.advanceTimersByTime(milliseconds({ minutes: 3 })));

    expect(screen.getByText("Waiting 5 minutes")).toBeTruthy();
  } finally {
    jest.useRealTimers();
  }
});

it("keeps a loaded list, and its place, when a later poll fails", async () => {
  threads = [
    waiting({
      userId: 7,
      name: "Sam",
      lastMessageBody: "Is it still on?",
      waitingSince: new Date().toISOString(),
    }),
  ];
  const client = renderPage();
  await screen.findByRole("link", { name: /Sam/ });

  status = 500;
  await client
    .refetchQueries({ queryKey: queryKeys.needsReplyAdmin() })
    .catch(() => {});

  const error = await screen.findByText(
    /Could not refresh texts needing a reply/,
  );
  const heading = screen.getByRole("heading", { name: "Needs reply" });
  expect(heading.parentElement?.contains(error)).toBe(true);
  expect(screen.getByRole("link", { name: /Sam/ })).toBeTruthy();
});

it("names the browser tab", () => {
  renderPage();

  expect(document.title).toBe("Needs reply - Admin");
});

describe("while staff point at or focus the list", () => {
  const thread = (userId: number, name: string) =>
    waiting({
      userId,
      name,
      lastMessageBody: "Hello?",
      waitingSince: new Date().toISOString(),
    });
  const rowNames = () =>
    screen
      .getAllByRole("link")
      .map((link) => link.querySelector(".font-medium")?.textContent);
  const poll = (client: ReturnType<typeof renderPage>) =>
    act(() => client.refetchQueries({ queryKey: queryKeys.needsReplyAdmin() }));

  const setHidden = (hidden: boolean) => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => hidden,
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
  };

  beforeEach(() => {
    threads = [thread(7, "Sam"), thread(8, "Kim")];
  });
  afterEach(() => {
    Reflect.deleteProperty(document, "hidden");
  });

  it("keeps the row of a number no longer waiting in place and adds arrivals below", async () => {
    const client = renderPage();
    await screen.findByRole("link", { name: /Sam/ });
    fireEvent.pointerEnter(screen.getByRole("list"));

    threads = [thread(9, "Lee"), thread(8, "Kim")];
    await poll(client);

    await screen.findByRole("link", { name: /Lee/ });
    expect(rowNames()).toEqual(["Sam", "Kim", "Lee"]);
    expect(screen.getByRole("link", { name: /Sam/ }).textContent).toContain(
      "No longer waiting",
    );
    expect(statusTexts()).toContain("2 waiting");

    fireEvent.pointerLeave(screen.getByRole("list"));

    expect(rowNames()).toEqual(["Lee", "Kim"]);
  });

  it("holds the rows while a row has keyboard focus", async () => {
    const client = renderPage();
    const sam = await screen.findByRole("link", { name: /Sam/ });
    act(() => sam.focus());

    threads = [thread(8, "Kim")];
    await poll(client);
    await screen.findByText("No longer waiting");
    expect(rowNames()).toEqual(["Sam", "Kim"]);

    act(() => sam.blur());
    expect(rowNames()).toEqual(["Kim"]);
  });

  it("doesn't hold the rows for focus a click left on a row", async () => {
    const client = renderPage();
    const sam = await screen.findByRole("link", { name: /Sam/ });
    // happy-dom matches :focus-visible on any focus; browsers skip the focus a click leaves.
    const matches = sam.matches.bind(sam);
    jest
      .spyOn(sam, "matches")
      .mockImplementation(
        (selector) => selector !== ":focus-visible" && matches(selector),
      );
    act(() => sam.focus());

    threads = [thread(8, "Kim")];
    await poll(client);

    await waitFor(() => expect(rowNames()).toEqual(["Kim"]));
  });

  it("applies the latest order once the tab is hidden", async () => {
    const client = renderPage();
    await screen.findByRole("link", { name: /Sam/ });
    fireEvent.pointerEnter(screen.getByRole("list"));
    threads = [thread(8, "Kim")];
    await poll(client);
    await screen.findByText("No longer waiting");

    setHidden(true);

    expect(rowNames()).toEqual(["Kim"]);
  });

  it("lets go of focus once the list empties while the tab is hidden", async () => {
    const client = renderPage();
    await screen.findByRole("link", { name: /Sam/ });
    act(() => screen.getByRole("link", { name: /Sam/ }).focus());

    setHidden(true);
    threads = [];
    await poll(client);
    await screen.findByText("No texts are waiting for a reply.");
    setHidden(false);
    threads = [thread(8, "Kim")];
    await poll(client);
    await screen.findByRole("link", { name: /Kim/ });
    threads = [thread(9, "Lee")];
    await poll(client);

    await screen.findByRole("link", { name: /Lee/ });
    expect(rowNames()).toEqual(["Lee"]);
  });

  it("lets go of focus once hiding the tab drops the focused row", async () => {
    const client = renderPage();
    const sam = await screen.findByRole("link", { name: /Sam/ });
    act(() => sam.focus());
    threads = [thread(8, "Kim")];
    await poll(client);
    await screen.findByText("No longer waiting");

    setHidden(true);
    setHidden(false);
    threads = [thread(9, "Lee"), thread(8, "Kim")];
    await poll(client);

    await screen.findByRole("link", { name: /Lee/ });
    expect(rowNames()).toEqual(["Lee", "Kim"]);
  });

  it("lets go once the pointer leaves, even after the list emptied", async () => {
    const client = renderPage();
    await screen.findByRole("link", { name: /Sam/ });
    fireEvent.pointerEnter(screen.getByRole("list"));
    setHidden(true);
    threads = [];
    await poll(client);
    fireEvent.pointerLeave(
      await screen.findByText("No texts are waiting for a reply."),
    );
    setHidden(false);
    threads = [thread(8, "Kim")];
    await poll(client);
    await screen.findByRole("link", { name: /Kim/ });
    threads = [thread(9, "Lee")];
    await poll(client);

    await screen.findByRole("link", { name: /Lee/ });
    expect(rowNames()).toEqual(["Lee"]);
  });
});

const statusTexts = () =>
  screen.getAllByRole("status").map((status) => status.textContent);
