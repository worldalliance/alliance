import type {
  MemberCompletionRetentionCohortDto,
  MemberCompletionRetentionPointDto,
} from "@alliance/shared/client/types.gen";
import { fireEvent, render, screen } from "@testing-library/react";
import { fullDateFormatter } from "../TimeSeriesChart";
import CohortCompletionGrid from "./CohortCompletionGrid";

const point = (
  weekIndex: number,
  weekCompletionRate: number,
): MemberCompletionRetentionPointDto => ({
  weekIndex,
  actionIndex: weekIndex,
  actionStartDate: "2026-01-12",
  completionRate: weekCompletionRate,
  joinedCount: 4,
  completedCount: 4 * weekCompletionRate,
  weekCompletionRate,
  weekJoinedCount: 4,
  weekCompletedCount: 4 * weekCompletionRate,
  actions: [{ actionId: 9, actionName: "Call a rep", memberCount: 4 }],
});

const cohort = (
  cohortStart: string,
  points: MemberCompletionRetentionPointDto[],
): MemberCompletionRetentionCohortDto => ({
  cohortStart,
  cohortSize: 4,
  points,
});

const weekOf = (cohortStart: string) =>
  `Week of ${fullDateFormatter.format(new Date(`${cohortStart}T00:00:00Z`))}`;

describe("CohortCompletionGrid", () => {
  it("lays out the newest cohort first across the weeks in range", () => {
    render(
      <CohortCompletionGrid
        filteredRetentionCohorts={[
          cohort("2026-01-05", [point(0, 1), point(1, 0.5), point(2, 0.25)]),
          cohort("2026-01-12", [point(0, 0.75)]),
        ]}
        weekRange={{ min: 1, max: 20 }}
        retentionLoading={false}
      />,
    );

    expect(screen.queryByText("W0")).toBeNull();
    expect(screen.getByText("W1")).toBeTruthy();
    expect(screen.getByText("W2")).toBeTruthy();
    expect(screen.queryByText("W3")).toBeNull();
    const rows = screen.getAllByText(/^Week of /).map((el) => el.textContent);
    expect(rows).toEqual([weekOf("2026-01-12"), weekOf("2026-01-05")]);
    expect(screen.queryByText("100%")).toBeNull();
    expect(screen.getByText("50%")).toBeTruthy();
  });

  it("details the hovered cell", () => {
    render(
      <CohortCompletionGrid
        filteredRetentionCohorts={[cohort("2026-01-05", [point(0, 0.5)])]}
        weekRange={{ min: 0, max: 20 }}
        retentionLoading={false}
      />,
    );

    fireEvent.mouseEnter(screen.getByText("50%"));

    expect(screen.getByText("Week 0")).toBeTruthy();
    expect(screen.getByText("Call a rep")).toBeTruthy();

    fireEvent.mouseLeave(screen.getByText("50%"));
    expect(screen.queryByText("Week 0")).toBeNull();
  });
});
