import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen } from "@testing-library/react";
import DailyStatsSection from "./DailyStatsSection";

const day = (dayId: number, date: string, actionsCompleted: number) => ({
  dayId,
  date,
  actionsCompleted,
  anonFormSubmissions: 0,
  signedMembers: 0,
  invitesCreated: 0,
  invitesAccepted: 0,
  suspendedMembers: 0,
});

serveApi(
  routes({
    "GET /analytics/daily-stats": () =>
      Response.json([
        day(1, "2026-02-01T12:00:00Z", 3),
        day(2, "2026-02-02T12:00:00Z", 7),
      ]),
  }),
);

it("shows the range's days inline, newest first", async () => {
  render(<DailyStatsSection />, queryWrapper());

  await screen.findByRole("region", { name: "Daily stats 2 days" });
  const rows = screen.getAllByRole("row").slice(1);
  expect(rows.map((row) => row.textContent)).toEqual([
    "February 2, 2026700000",
    "February 1, 2026300000",
  ]);
  expect(
    screen.getByRole("region", { name: "Daily stats table" }).tabIndex,
  ).toBe(0);
});
