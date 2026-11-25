import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, setSystemTime } from "bun:test";
import { MemoryRouter } from "react-router";
import { AwayTab } from "./AwayTab";
import { defaultAwayWindow } from "./awayWindow";

const asked: { from: string | null; to: string | null }[] = [];
let later: Promise<Response> | null = null;
let firstEmpty = false;

serveApi(
  routes({
    "GET /user/admin/awayranges": ({ request }) => {
      const params = new URL(request.url).searchParams;
      asked.push({ from: params.get("from"), to: params.get("to") });
      if (asked.length > 1 && later) return later;
      if (firstEmpty) return Response.json([]);
      return Response.json([
        {
          id: 1,
          userId: 10,
          userName: "Ana Lee",
          startDate: "2030-03-05T08:00:00.000Z",
          endDate: "2030-03-12T07:00:00.000Z",
          reason: "vacation",
          note: "Hiking",
          createdAt: "2030-01-01T00:00:00.000Z",
        },
        {
          id: 2,
          userId: 10,
          userName: "Ana Lee",
          startDate: "2030-03-20T07:00:00.000Z",
          endDate: "2030-03-21T07:00:00.000Z",
          reason: "other",
          note: "Wedding",
          createdAt: "2030-01-01T00:00:00.000Z",
        },
      ]);
    },
  }),
);

afterEach(() => {
  setSystemTime();
  asked.length = 0;
  later = null;
  firstEmpty = false;
});

const renderPage = (url = "/members?tab=away") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <AwayTab />
    </MemoryRouter>,
    queryWrapper(),
  );

it("defaults to next Tuesday 7pm through the following Tuesday 11:59pm, Pacific", async () => {
  setSystemTime(new Date("2026-10-29T18:00:00Z"));
  renderPage();

  expect(await screen.findByText("1 member away at some point")).toBeTruthy();
  expect(asked.at(-1)).toEqual({
    from: "2026-11-04T03:00:00.000Z",
    to: "2026-11-11T07:59:00.000Z",
  });
  expect(
    screen.getByLabelText<HTMLInputElement>("From (Pacific time)").value,
  ).toBe("2026-11-03T19:00");
  expect(
    screen.getByLabelText<HTMLInputElement>("Through (Pacific time)").value,
  ).toBe("2026-11-10T23:59");
  expect(screen.getAllByRole("link", { name: "Ana Lee" })).toHaveLength(2);
  expect(screen.getByText("Hiking")).toBeTruthy();
});

it("asks for a start before the end", async () => {
  const { container } = renderPage();
  const [from, to] = container.querySelectorAll('input[type="datetime-local"]');
  fireEvent.change(from, { target: { value: "2030-03-10T10:00" } });
  fireEvent.change(to, { target: { value: "2030-03-01T10:00" } });

  expect(await screen.findByText("Pick a start before the end")).toBeTruthy();
});

it("keeps a chosen window in the URL", async () => {
  renderPage(
    "/members?tab=away&from=2030-03-01T08:00:00.000Z&to=2030-03-31T07:00:00.000Z",
  );

  await screen.findByText("1 member away at some point");
  expect(asked.at(-1)).toEqual({
    from: "2030-03-01T08:00:00.000Z",
    to: "2030-03-31T07:00:00.000Z",
  });
});

it("starts the default window today when today is Tuesday in Pacific time", () => {
  const tuesdayMorningPt = new Date("2026-11-03T15:00:00Z");
  const tuesdayNightPt = new Date("2026-11-04T05:00:00Z");
  const expected = {
    from: new Date("2026-11-04T03:00:00.000Z"),
    to: new Date("2026-11-11T07:59:00.000Z"),
  };

  expect(defaultAwayWindow(tuesdayMorningPt)).toEqual(expected);
  expect(defaultAwayWindow(tuesdayNightPt)).toEqual(expected);
});

const changeFrom = (container: HTMLElement) => {
  const [from] = container.querySelectorAll('input[type="datetime-local"]');
  fireEvent.change(from, { target: { value: "2030-03-02T10:00" } });
};
const WINDOW_URL =
  "/members?tab=away&from=2030-03-01T08:00:00.000Z&to=2030-03-31T07:00:00.000Z";

it("dims the previous window's rows and drops its count while a new window loads", async () => {
  let respond = (_: Response) => {};
  later = new Promise((resolve) => (respond = resolve));
  const { container } = renderPage(WINDOW_URL);
  await screen.findByText("1 member away at some point");

  changeFrom(container);
  await waitFor(() => expect(asked).toHaveLength(2));
  expect(screen.queryByText("1 member away at some point")).toBeNull();
  expect(container.querySelector('[aria-busy="true"] table')).toBeTruthy();

  respond(Response.json([]));
  expect(await screen.findByText("0 members away at some point")).toBeTruthy();
  expect(container.querySelector('[aria-busy="true"]')).toBeNull();
});

it("doesn't show the previous window's rows when a new window fails", async () => {
  later = Promise.resolve(Response.json({}, { status: 500 }));
  const { container } = renderPage(WINDOW_URL);
  await screen.findByText("1 member away at some point");

  changeFrom(container);
  expect(await screen.findByText("Couldn't load away periods")).toBeTruthy();
  expect(screen.queryByText("Ana Lee")).toBeNull();
  expect(screen.queryByText(/away at some point/)).toBeNull();
});

it("shows loading, not an empty window, while a window after an empty one loads", async () => {
  firstEmpty = true;
  later = new Promise(() => {});
  const { container } = renderPage(WINDOW_URL);
  await screen.findByText("Nobody is away in this window");

  changeFrom(container);
  await waitFor(() => expect(asked).toHaveLength(2));
  expect(screen.queryByText("Nobody is away in this window")).toBeNull();
  expect(screen.queryByText(/away at some point/)).toBeNull();
});
