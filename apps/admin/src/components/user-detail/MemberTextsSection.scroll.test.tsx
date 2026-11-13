import type {
  MmsMessageDto,
  MmsThreadDto,
} from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import MemberTextsSection from "./MemberTextsSection";

const text = (id: number): MmsMessageDto => ({
  id,
  direction: "inbound",
  body: `Text ${id}`,
  status: "received",
  errorCode: null,
  errorMessage: null,
  createdAt: new Date(Date.UTC(2026, 10, 1, 0, id)).toISOString(),
  sentByStaff: false,
  sentByName: null,
  media: [],
});

const page = (ids: number[], hasOlder: boolean): MmsThreadDto => ({
  phoneNumber: "+14155550123",
  textable: true,
  optedOut: false,
  messages: ids.map(text),
  hasOlder,
});

let newest: MmsThreadDto;
let olderFails: boolean;
let befores: (string | null)[];
let olderGate: Promise<void>;

serveApi(
  routes({
    "GET /mms-threads/7": async ({ request }) => {
      const before = new URL(request.url).searchParams.get("before");
      if (before === null) return Response.json(newest);
      befores.push(before);
      await olderGate;
      return olderFails
        ? Response.json({ message: "down" }, { status: 500 })
        : Response.json(page([1, 2], false));
    },
  }),
);

beforeEach(() => {
  newest = page([3, 4, 5], true);
  olderFails = false;
  befores = [];
  olderGate = Promise.resolve();
  tops = {};
});

const renderSection = () => {
  const { wrapper: Wrapper, client } = queryWrapper();
  render(
    <Wrapper>
      <MemberTextsSection member={{ id: 7, name: "Sam" }} />
    </Wrapper>,
  );
  return client;
};

const bodies = () =>
  screen.getAllByText(/^Text \d+$/).map((element) => element.textContent);

let tops: Record<string, number>;

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetTop", {
    configurable: true,
    get(this: HTMLElement) {
      return tops[this.dataset.textId ?? ""] ?? 0;
    },
  });
});

afterAll(() => {
  Reflect.deleteProperty(HTMLElement.prototype, "offsetTop");
});

const scrollTo = (log: HTMLElement, top: number) => {
  log.scrollTop = top;
  fireEvent.scroll(log);
};

it("loads older texts above, keeping the reader's place", async () => {
  renderSection();
  const log = await screen.findByRole("region", { name: "Text history" });
  Object.defineProperty(log, "scrollHeight", { get: () => 1000 });
  tops = { 3: 50 };
  scrollTo(log, 0);

  fireEvent.click(screen.getByRole("button", { name: "Show older texts" }));
  tops = { 3: 450 };

  await screen.findByText("Text 1");
  expect(befores).toEqual(["3"]);
  expect(bodies()).toEqual(["Text 1", "Text 2", "Text 3", "Text 4", "Text 5"]);
  expect(log.scrollTop).toBe(400);
  expect(screen.queryByRole("button", { name: "Show older texts" })).toBeNull();
});

it("keeps focus on Show older texts while it loads, then moves it to the thread", async () => {
  let releaseOlder = () => {};
  olderGate = new Promise((resolve) => (releaseOlder = resolve));
  renderSection();
  const button = await screen.findByRole("button", {
    name: "Show older texts",
  });
  button.focus();

  fireEvent.click(button);
  await waitFor(() => expect(befores).toEqual(["3"]));
  expect(button.getAttribute("aria-disabled")).toBe("true");
  expect(document.activeElement).toBe(button);
  fireEvent.click(button);

  releaseOlder();
  await screen.findByText("Text 1");
  expect(befores).toEqual(["3"]);
  expect(document.activeElement).toBe(
    screen.getByRole("region", { name: "Text history" }),
  );
});

it("keeps the reader's place when a poll lands before older texts do", async () => {
  let releaseOlder = () => {};
  olderGate = new Promise((resolve) => (releaseOlder = resolve));
  const client = renderSection();
  const log = await screen.findByRole("region", { name: "Text history" });
  let height = 1000;
  Object.defineProperty(log, "scrollHeight", { get: () => height });
  tops = { 3: 150 };
  scrollTo(log, 100);

  fireEvent.click(screen.getByRole("button", { name: "Show older texts" }));
  await waitFor(() => expect(befores).toEqual(["3"]));
  height = 1050;
  newest = page([4, 5, 6], true);
  await client.refetchQueries({
    queryKey: queryKeys.memberTextThreadAdmin(7),
  });
  await screen.findByText("Text 6");

  height = 1450;
  tops = { 3: 550 };
  releaseOlder();
  await screen.findByText("Text 1");
  expect(log.scrollTop).toBe(500);
});

it("keeps the place the reader scrolled to while older texts load", async () => {
  let releaseOlder = () => {};
  olderGate = new Promise((resolve) => (releaseOlder = resolve));
  renderSection();
  const log = await screen.findByRole("region", { name: "Text history" });
  Object.defineProperty(log, "scrollHeight", { get: () => 1000 });
  tops = { 3: 150, 4: 300, 5: 450 };
  scrollTo(log, 100);

  fireEvent.click(screen.getByRole("button", { name: "Show older texts" }));
  await waitFor(() => expect(befores).toEqual(["3"]));
  scrollTo(log, 350);

  tops = { 3: 550, 4: 700, 5: 850 };
  releaseOlder();
  await screen.findByText("Text 1");
  expect(log.scrollTop).toBe(750);
});

it("reads out only the polled newest page, not older texts loaded above", async () => {
  renderSection();
  fireEvent.click(
    await screen.findByRole("button", { name: "Show older texts" }),
  );
  await screen.findByText("Text 1");

  const live = within(screen.getByRole("log"));
  expect(live.queryByText("Text 2")).toBeNull();
  expect(live.getByText("Text 3")).toBeTruthy();
});

it("keeps texts a poll's newest page no longer holds", async () => {
  const client = renderSection();
  fireEvent.click(
    await screen.findByRole("button", { name: "Show older texts" }),
  );
  await screen.findByText("Text 1");

  newest = page([4, 5, 6], true);
  await client.refetchQueries({
    queryKey: queryKeys.memberTextThreadAdmin(7),
  });

  await screen.findByText("Text 6");
  expect(bodies()).toEqual([
    "Text 1",
    "Text 2",
    "Text 3",
    "Text 4",
    "Text 5",
    "Text 6",
  ]);
});

it("keeps texts that slide out of the newest page before older ones load", async () => {
  const client = renderSection();
  await screen.findByText("Text 3");

  newest = page([4, 5, 6], true);
  await client.refetchQueries({
    queryKey: queryKeys.memberTextThreadAdmin(7),
  });

  await screen.findByText("Text 6");
  expect(bodies()).toEqual(["Text 3", "Text 4", "Text 5", "Text 6"]);
  fireEvent.click(screen.getByRole("button", { name: "Show older texts" }));
  await screen.findByText("Text 1");
  expect(befores).toEqual(["3"]);
});

it("keeps a text's element when it slides out of the newest page", async () => {
  const client = renderSection();
  fireEvent.click(
    await screen.findByRole("button", { name: "Show older texts" }),
  );
  await screen.findByText("Text 1");
  const slid = screen.getByText("Text 3");

  newest = page([4, 5, 6], true);
  await client.refetchQueries({
    queryKey: queryKeys.memberTextThreadAdmin(7),
  });

  await screen.findByText("Text 6");
  expect(screen.getByText("Text 3")).toBe(slid);
  const live = within(screen.getByRole("log"));
  expect(live.getByText("Text 3")).toBe(slid);
  expect(live.queryByText("Text 2")).toBeNull();
});

it("drops older texts once the member's number changes", async () => {
  const client = renderSection();
  fireEvent.click(
    await screen.findByRole("button", { name: "Show older texts" }),
  );
  await screen.findByText("Text 1");

  newest = { ...page([8, 9], true), phoneNumber: "+14155550199" };
  await client.refetchQueries({
    queryKey: queryKeys.memberTextThreadAdmin(7),
  });

  await screen.findByText("Text 8");
  expect(bodies()).toEqual(["Text 8", "Text 9"]);
  expect(screen.getByRole("button", { name: "Show older texts" })).toBeTruthy();
});

it("drops an older page that lands after the member's number changes", async () => {
  let releaseOlder = () => {};
  olderGate = new Promise((resolve) => (releaseOlder = resolve));
  const client = renderSection();
  fireEvent.click(
    await screen.findByRole("button", { name: "Show older texts" }),
  );
  await waitFor(() => expect(befores).toEqual(["3"]));

  newest = { ...page([8, 9], true), phoneNumber: "+14155550199" };
  await client.refetchQueries({
    queryKey: queryKeys.memberTextThreadAdmin(7),
  });
  await screen.findByText("Text 8");
  releaseOlder();

  await screen.findByRole("button", { name: "Show older texts" });
  expect(bodies()).toEqual(["Text 8", "Text 9"]);
});

it("announces when older texts fail to load", async () => {
  olderFails = true;
  renderSection();
  const button = await screen.findByRole("button", {
    name: "Show older texts",
  });
  const status = within(
    screen.getByRole("region", { name: "Text history" }),
  ).getByRole("status");
  fireEvent.click(button);

  await waitFor(() =>
    expect(status.textContent).toBe("Couldn't load older texts."),
  );
  expect(
    await screen.findByRole("button", { name: "Show older texts" }),
  ).toBeTruthy();
});

it("leaves the reader's place alone after older texts fail to load", async () => {
  olderFails = true;
  const client = renderSection();
  const log = await screen.findByRole("region", { name: "Text history" });
  Object.defineProperty(log, "scrollHeight", { get: () => 1000 });
  tops = { 3: 50 };
  scrollTo(log, 0);
  fireEvent.click(screen.getByRole("button", { name: "Show older texts" }));
  await screen.findByText("Couldn't load older texts.");

  scrollTo(log, 300);
  newest = page([4, 5, 6], true);
  await client.refetchQueries({
    queryKey: queryKeys.memberTextThreadAdmin(7),
  });

  await screen.findByText("Text 6");
  expect(log.scrollTop).toBe(300);
});

it("keeps the reader's place as an image above them loads", async () => {
  renderSection();
  const log = await screen.findByRole("region", { name: "Text history" });
  Object.defineProperty(log, "scrollHeight", { get: () => 1000 });
  tops = { 3: 150, 4: 300, 5: 450 };
  scrollTo(log, 250);

  tops = { 3: 150, 4: 556, 5: 706 };
  fireEvent.load(screen.getByText("Text 3"));

  expect(log.scrollTop).toBe(506);
});

it("keeps the reader's place when a poll brings a new text", async () => {
  const client = renderSection();
  const log = await screen.findByRole("region", { name: "Text history" });
  Object.defineProperty(log, "scrollHeight", { get: () => 1000 });
  scrollTo(log, 100);

  newest = page([3, 4, 5, 6], true);
  await client.refetchQueries({
    queryKey: queryKeys.memberTextThreadAdmin(7),
  });

  await screen.findByText("Text 6");
  expect(log.scrollTop).toBe(100);
});

it("keeps the end in view as an image loads", async () => {
  newest = {
    ...page([], false),
    messages: [
      {
        ...text(4),
        media: [
          { id: 10, contentType: "image/jpeg", status: "ready", inline: true },
        ],
      },
    ],
  };
  renderSection();
  const image = await screen.findByAltText("Image texted by Sam");
  const log = screen.getByRole("region", { name: "Text history" });
  Object.defineProperty(log, "scrollHeight", { value: 1256 });

  fireEvent.load(image);

  expect(log.scrollTop).toBe(1256);
});

describe("at the end of the thread", () => {
  let paneHeight: number;

  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => paneHeight,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
  });

  it("opens there and follows a poll's new text", async () => {
    paneHeight = 1000;
    const client = renderSection();
    const log = await screen.findByRole("region", { name: "Text history" });
    expect(log.scrollTop).toBe(1000);

    paneHeight = 1100;
    newest = page([4, 5, 6], true);
    await client.refetchQueries({
      queryKey: queryKeys.memberTextThreadAdmin(7),
    });

    await screen.findByText("Text 6");
    expect(log.scrollTop).toBe(1100);
  });

  it("follows a poll that makes the last text taller", async () => {
    const staffText = (
      status: MmsMessageDto["status"],
      errorMessage: string | null,
    ): MmsThreadDto => ({
      ...newest,
      messages: newest.messages.map((message) =>
        message.id === 5
          ? { ...message, direction: "outbound", status, errorMessage }
          : message,
      ),
    });
    newest = staffText("sent", null);
    paneHeight = 1000;
    const client = renderSection();
    const log = await screen.findByRole("region", { name: "Text history" });

    paneHeight = 1040;
    newest = staffText("undelivered", "Unknown destination");
    await client.refetchQueries({
      queryKey: queryKeys.memberTextThreadAdmin(7),
    });

    await screen.findByText(/Unknown destination/);
    expect(log.scrollTop).toBe(1040);
  });
});
