import type { MemberCompletionRetentionCohortDto } from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen } from "@testing-library/react";
import { fullDateFormatter } from "../TimeSeriesChart";
import CohortRetentionCharts from "./CohortRetentionCharts";

const cohort = (
  cohortStart: string,
  completedCount: number,
): MemberCompletionRetentionCohortDto => ({
  cohortStart,
  cohortSize: 4,
  points: [
    {
      weekIndex: 0,
      actionIndex: 0,
      actionStartDate: cohortStart,
      completionRate: completedCount / 4,
      joinedCount: 4,
      completedCount,
      weekCompletionRate: completedCount / 4,
      weekJoinedCount: 4,
      weekCompletedCount: completedCount,
      actions: [],
    },
  ],
});

const api = serveApi(
  routes({
    "GET /analytics/member-completion-retention": () =>
      Response.json([cohort("2026-01-05", 3), cohort("2026-01-12", 0)]),
  }),
);

const weekOf = (cohortStart: string) =>
  `Week of ${fullDateFormatter.format(new Date(`${cohortStart}T00:00:00Z`))}`;

describe("CohortRetentionCharts", () => {
  it("leaves cohorts without a completion out of the grid", async () => {
    render(<CohortRetentionCharts />, queryWrapper());

    await screen.findByText(weekOf("2026-01-05"));
    expect(screen.queryByText(weekOf("2026-01-12"))).toBeNull();
    expect(screen.getByText("75%")).toBeTruthy();
  });

  it("says so when the cohorts fail to load", async () => {
    api.alsoServing({
      "GET /analytics/member-completion-retention": () =>
        Response.json({ message: "boom" }, { status: 500 }),
    });

    render(<CohortRetentionCharts />, queryWrapper());

    await screen.findByText("Unable to load cohort retention.");
  });
});
