import { fireEvent, render, screen } from "@testing-library/react";
import { millisecondsInDay } from "date-fns/constants";
import { actionStat } from "./actionStatFixture";
import CompletionRateCharts from "./CompletionRateCharts";

const daysAgo = (days: number) =>
  new Date(Date.now() - days * millisecondsInDay).toISOString();

const stats = [
  actionStat({
    actionId: 1,
    memberActionEndDate: daysAgo(20),
    usersCompleted: 5,
    usersJoined: 10,
    completionRate: 0.5,
  }),
  actionStat({
    actionId: 2,
    actionName: "Call your representative about the new transit funding bill",
    memberActionEndDate: daysAgo(10),
    usersCompleted: 6,
    usersJoined: 10,
    completionRate: 0.6,
  }),
];

describe("CompletionRateCharts", () => {
  it("switches both charts to a 0-100% axis from either Absolute toggle", () => {
    render(
      <CompletionRateCharts actionStats={stats} actionStatsLoading={false} />,
    );
    expect(screen.queryAllByText("100%")).toHaveLength(0);

    const toggles = screen.getAllByRole("checkbox", { name: "Absolute" });
    expect(toggles).toHaveLength(2);
    fireEvent.click(toggles[1]);

    expect(
      screen
        .getAllByRole("checkbox", { name: "Absolute" })
        .every(
          (toggle) => toggle instanceof HTMLInputElement && toggle.checked,
        ),
    ).toBe(true);
    expect(screen.getAllByText("100%")).toHaveLength(2);
  });

  it("describes the hovered week, cutting long action names", () => {
    render(
      <CompletionRateCharts actionStats={stats} actionStatsLoading={false} />,
    );
    const weekly = screen
      .getByText("Non-Cumulative Completion Rate (Weekly)")
      .closest(".relative")
      ?.querySelector("svg[viewBox]");
    if (!weekly) throw new Error("no weekly chart");
    weekly.getBoundingClientRect = () => new DOMRect(0, 0, 1000, 350);

    fireEvent.mouseMove(weekly, { clientX: 999 });

    expect(screen.getByText("Completed / Joined")).toBeTruthy();
    expect(screen.getByText("6/10")).toBeTruthy();
    expect(screen.getByText("Action 1")).toBeTruthy();
    expect(
      screen.getByText("Call your representative about the new t..."),
    ).toBeTruthy();
  });

  it("describes the hovered day's running average", () => {
    render(
      <CompletionRateCharts actionStats={stats} actionStatsLoading={false} />,
    );
    const cumulative = screen
      .getByText("Cumulative Completion Rate")
      .closest(".relative")
      ?.querySelector("svg[viewBox]");
    if (!cumulative) throw new Error("no cumulative chart");
    cumulative.getBoundingClientRect = () => new DOMRect(0, 0, 1000, 350);

    fireEvent.mouseMove(cumulative, { clientX: 999 });

    expect(screen.getByText("Avg Rate").nextSibling?.textContent).toBe(
      "55.00%",
    );
    expect(screen.getByText("Total Actions").nextSibling?.textContent).toBe(
      "2",
    );
  });
});
