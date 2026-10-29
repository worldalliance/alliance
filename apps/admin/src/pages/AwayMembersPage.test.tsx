import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, setSystemTime } from "bun:test";
import { MemoryRouter } from "react-router";
import AwayMembersPage, { defaultAwayWindow } from "./AwayMembersPage";

const asked: { from: string | null; to: string | null }[] = [];

serveApi(
  routes({
    "GET /user/admin/awayranges": ({ request }) => {
      const params = new URL(request.url).searchParams;
      asked.push({ from: params.get("from"), to: params.get("to") });
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

afterEach(() => setSystemTime());

const renderPage = () =>
  render(
    <MemoryRouter>
      <AwayMembersPage />
    </MemoryRouter>,
    queryWrapper(),
  );

it("defaults to next Tuesday 7pm through the following Tuesday 11:59pm, Pacific", async () => {
  setSystemTime(new Date("2026-10-29T18:00:00Z"));
  renderPage();

  expect(
    await screen.findByText("1 member away at some point in this window."),
  ).toBeTruthy();
  expect(asked.at(-1)).toEqual({
    from: "2026-11-04T03:00:00.000Z",
    to: "2026-11-11T07:59:00.000Z",
  });
  expect(screen.getByText("Nov 3, 2026 at 7:00 PM PT")).toBeTruthy();
  expect(screen.getByText("Nov 10, 2026 at 11:59 PM PT")).toBeTruthy();
  expect(screen.getAllByRole("link", { name: "Ana Lee" })).toHaveLength(2);
  expect(screen.getByText("Hiking")).toBeTruthy();
});

it("asks for a start before the end", async () => {
  const { container } = renderPage();
  const [from, to] = container.querySelectorAll('input[type="datetime-local"]');
  fireEvent.change(from, { target: { value: "2030-03-10T10:00" } });
  fireEvent.change(to, { target: { value: "2030-03-01T10:00" } });

  expect(await screen.findByText("Pick a start before the end.")).toBeTruthy();
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
