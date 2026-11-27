import type { ActionStatsWithOnboardingDto } from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useActionStats } from "../../lib/useActionStats";
import { LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import { TaskCompletionBarsPanel } from "./TaskCompletionBarsPanel";
import { actionStat } from "./actionStatFixture";

let served: ActionStatsWithOnboardingDto[] = [];
let statsStatus = 200;

afterEach(() => {
  served = [];
  statsStatus = 200;
});

serveApi(
  routes({
    "GET /analytics/action-stats": () =>
      statsStatus === 200
        ? Response.json(served)
        : Response.json({}, { status: statsStatus }),
    "POST /analytics/action-stats/recalculate": () =>
      Response.json({}, { status: 500 }),
  }),
);

const Chart = () => {
  const { stats, recalculate } = useActionStats();
  return <TaskCompletionBarsPanel stats={stats} recalculate={recalculate} />;
};

const renderChart = (
  stats: ActionStatsWithOnboardingDto[],
  { loadFailed = false } = {},
) => {
  served = stats;
  statsStatus = loadFailed ? 500 : 200;
  const { wrapper } = queryWrapper();
  render(<Chart />, { wrapper });
};

describe("TaskCompletionBarsPanel", () => {
  it("counts withdrawals toward each charted task's expected total", async () => {
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

    expect(await screen.findByText("Call a rep")).toBeTruthy();
    expect(screen.getByText(/3\/5/).textContent).toContain("(60%)");
    expect(screen.queryByText("Hidden")).toBeNull();
  });

  it("shows a task's counts while hovering its row", async () => {
    renderChart([
      actionStat({
        actionName: "Call a rep",
        usersCompleted: 3,
        usersJoined: 4,
        usersWithdrawn: 1,
      }),
    ]);

    const row = (await screen.findByText("Call a rep")).closest("g");
    if (!row) throw new Error("no row");
    fireEvent.mouseEnter(row);

    const valueOf = (label: string) =>
      screen
        .getByText(label, { selector: "dt span" })
        .closest("div")
        ?.querySelector("dd")?.textContent;
    expect(valueOf("Withdrawn")).toBe("1");
    expect(valueOf("Completed of joined")).toBe("75%");

    fireEvent.mouseLeave(row);
    expect(screen.queryByText("Completed of joined")).toBeNull();
  });

  it("prompts a recalculation when there are no stats", async () => {
    renderChart([]);

    await screen.findByText("No task stats yet");
    expect(
      screen.getByText("Select Recalculate to generate them."),
    ).toBeTruthy();
  });

  it("says the stats failed to load instead of prompting", async () => {
    renderChart([], { loadFailed: true });

    await screen.findByText("Couldn't load task stats");
    expect(screen.getByText(LOAD_FAILED_FALLBACK)).toBeTruthy();
    expect(screen.queryByText(/Select Recalculate to generate/)).toBeNull();
  });

  it("says a recalculation failed", async () => {
    renderChart([]);
    await screen.findByText("No task stats yet");

    fireEvent.click(screen.getByRole("button", { name: "Recalculate" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Couldn't recalculate task stats.",
      ),
    );
  });
});
