import type {
  MemberCompletionRetentionCohortDto,
  MemberCompletionRetentionPointDto,
} from "@alliance/shared/client/types.gen";
import { fireEvent, render, screen } from "@testing-library/react";
import { CohortCompletionGrid, cohortDate } from "./CohortCompletionGrid";

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

const weekOf = (cohortStart: string) => `Week of ${cohortDate(cohortStart)}`;

describe("CohortCompletionGrid", () => {
  it("lays out the newest cohort first across the weeks in range", () => {
    render(
      <CohortCompletionGrid
        cohorts={[
          cohort("2026-01-05", [point(0, 1), point(1, 0.5), point(2, 0.25)]),
          cohort("2026-01-12", [point(0, 0.75)]),
        ]}
        weekRange={{ min: 1, max: 20 }}
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
        cohorts={[cohort("2026-01-05", [point(0, 0.5)])]}
        weekRange={{ min: 0, max: 20 }}
      />,
    );

    fireEvent.mouseEnter(screen.getByText("50%"));

    expect(screen.getByText("Week 0")).toBeTruthy();
    expect(screen.getByText("Call a rep")).toBeTruthy();

    fireEvent.mouseLeave(screen.getByText("50%"));
    expect(screen.queryByText("Week 0")).toBeNull();
  });
});

describe("CohortCompletionGrid keyboard", () => {
  it("moves between cells with the arrow keys and details the focused one", () => {
    render(
      <CohortCompletionGrid
        cohorts={[cohort("2026-01-05", [point(0, 0.5), point(1, 0.25)])]}
        weekRange={{ min: 0, max: 20 }}
      />,
    );

    const first = screen.getByText("50%");
    expect(first.getAttribute("tabindex")).toBe("0");
    fireEvent.focus(first);
    expect(screen.getByText("Week 0")).toBeTruthy();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    const next = screen.getByText("25%");
    expect(next.getAttribute("tabindex")).toBe("0");
    fireEvent.focus(next);
    expect(screen.getByText("Week 1")).toBeTruthy();
  });

  it("keeps its tab stop when the week range drops the focused cell", () => {
    const cohorts = [cohort("2026-01-05", [point(0, 0.5), point(1, 0.25)])];
    const { rerender } = render(
      <CohortCompletionGrid
        cohorts={cohorts}
        weekRange={{ min: 0, max: 20 }}
      />,
    );
    fireEvent.focus(screen.getByText("25%"));
    rerender(
      <CohortCompletionGrid cohorts={cohorts} weekRange={{ min: 0, max: 0 }} />,
    );

    expect(screen.getByText("50%").getAttribute("tabindex")).toBe("0");
  });
});
