import type { ActionStatsWithOnboardingDto } from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen } from "@testing-library/react";
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
  it("counts withdrawals toward each charted action's expected total", () => {
    renderChart([
      actionStat({
        actionId: 1,
        actionName: "Call a rep",
        usersCompleted: 3,
        usersJoined: 4,
        usersWithdrawn: 1,
      }),
      actionStat({ actionId: 2, actionName: "Hidden", showInChart: false }),
    ]);

    expect(screen.getByText("Call a rep")).toBeTruthy();
    expect(screen.getByText(/3\/5/).textContent).toContain("(60%)");
    expect(screen.queryByText("Hidden")).toBeNull();
  });

  it("shows an action's counts while hovering its row", () => {
    renderChart([
      actionStat({
        actionName: "Call a rep",
        usersCompleted: 3,
        usersJoined: 4,
        usersWithdrawn: 1,
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
});
