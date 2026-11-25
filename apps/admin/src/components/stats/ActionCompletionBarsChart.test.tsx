import type { ActionStatsWithOnboardingDto } from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen } from "@testing-library/react";
import { openChartData } from "../../lib/testing/chartData";
import { useActionStats } from "../../lib/useActionStats";
import ActionCompletionBarsChart from "./ActionCompletionBarsChart";
import { actionStat } from "./actionStatFixture";

serveApi(
  routes({
    "GET /analytics/action-stats": () => Response.json([]),
    "POST /analytics/action-stats/recalculate": () =>
      Response.json({}, { status: 500 }),
  }),
);

const Chart = ({
  stats,
  loadFailed,
}: {
  stats: ActionStatsWithOnboardingDto[];
  loadFailed: boolean;
}) => {
  const { recalculate } = useActionStats();
  return (
    <ActionCompletionBarsChart
      actionStats={stats}
      actionStatsLoading={false}
      actionStatsLoadFailed={loadFailed}
      recalculateActionStats={recalculate}
    />
  );
};

const renderChart = (
  stats: ActionStatsWithOnboardingDto[],
  { loadFailed = false } = {},
) => {
  const { wrapper } = queryWrapper();
  render(<Chart stats={stats} loadFailed={loadFailed} />, { wrapper });
};

describe("ActionCompletionBarsChart", () => {
  it("labels each charted action's bar with completed over joined", () => {
    renderChart([
      actionStat({
        actionId: 1,
        actionName: "Call a rep",
        usersCompleted: 3,
        usersJoined: 4,
        usersWithdrawn: 1,
        completionRate: 0.75,
      }),
      actionStat({ actionId: 2, actionName: "Hidden", showInChart: false }),
    ]);

    expect(screen.getByText("Call a rep")).toBeTruthy();
    expect(screen.getByText(/3\/4/).textContent).toContain("(75%)");
    expect(screen.queryByText("Hidden")).toBeNull();
  });

  it("shows an action's counts while hovering its row", () => {
    renderChart([
      actionStat({
        actionName: "Call a rep",
        usersCompleted: 3,
        usersJoined: 4,
        usersWithdrawn: 1,
        completionRate: 0.75,
      }),
    ]);

    const row = screen.getByText("Call a rep").closest("g");
    if (!row) throw new Error("no row");
    fireEvent.mouseEnter(row);

    expect(screen.getByText("Withdrawn:").nextSibling?.textContent).toBe("1");
    expect(screen.getByText("Rate:").nextSibling?.textContent).toBe("75%");

    fireEvent.mouseLeave(row);
    expect(screen.queryByText("Rate:")).toBeNull();
  });

  it("ends the joined part of a bar where its withdrawn part starts, keying the rest as not completed", () => {
    renderChart([
      actionStat({
        usersCompleted: 1,
        usersJoined: 4,
        usersWithdrawn: 1,
        completionRate: 0.25,
      }),
    ]);

    const row = screen.getByText("Call a rep").closest("g");
    const track = row?.querySelector("rect[rx]");
    const withdrawn = row?.querySelector('path[fill="#f97316"]');
    if (!track || !withdrawn) throw new Error("no bar");
    const x = Number(track.getAttribute("x"));
    const width = Number(track.getAttribute("width"));
    const start = Number(withdrawn.getAttribute("d")?.split(" ")[1]);
    expect(start).toBeCloseTo(x + (width * 4) / 5);
    expect(screen.getByText("Joined, not completed")).toBeTruthy();
  });

  it("gives no rate when nobody is still in an action", () => {
    renderChart([
      actionStat({
        actionName: "Call a rep",
        usersCompleted: 0,
        usersJoined: 0,
        usersWithdrawn: 1,
      }),
    ]);

    expect(screen.getByText(/0\/0/).textContent).not.toContain("%");
    const row = screen.getByText("Call a rep").closest("g");
    if (!row) throw new Error("no row");
    fireEvent.mouseEnter(row);

    expect(screen.getByText("Rate:").nextSibling?.textContent).toBe("N/A");
  });

  it("prompts a recalculation when there are no stats", () => {
    renderChart([]);

    expect(
      screen.getByText(
        "No action stats available. Click Recalculate to generate.",
      ),
    ).toBeTruthy();
  });

  it("says the stats failed to load instead of prompting", () => {
    renderChart([], { loadFailed: true });

    expect(screen.getByText("Unable to load action stats.")).toBeTruthy();
    expect(screen.queryByText(/Click Recalculate to generate/)).toBeNull();
  });

  it("says a recalculation failed", async () => {
    renderChart([]);

    fireEvent.click(screen.getByRole("button", { name: "Recalculate" }));

    await screen.findByText("Unable to recalculate action stats.");
  });

  it("lists each charted action's counts in its data table", async () => {
    renderChart([
      actionStat({
        actionId: 1,
        actionName: "Call a rep",
        usersCompleted: 3,
        usersJoined: 4,
        usersWithdrawn: 1,
        completionRate: 0.75,
        memberActionEndDate: "2999-01-01T00:00:00Z",
      }),
      actionStat({
        actionId: 2,
        actionName: "Nobody yet",
        usersCompleted: 0,
        usersJoined: 0,
        usersWithdrawn: 1,
      }),
    ]);

    expect(await openChartData("Action completion stats")).toEqual([
      ["Call a rep", "3", "4", "1", "75%", "Yes"],
      ["Nobody yet", "0", "0", "1", "—", "No"],
    ]);
  });
});
