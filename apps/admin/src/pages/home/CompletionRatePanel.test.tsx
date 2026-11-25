import type { ActionStatsWithOnboardingDto } from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { millisecondsInDay } from "date-fns/constants";
import { useActionStats } from "../../lib/useActionStats";
import { actionStat } from "./actionStatFixture";
import { CompletionRatePanel } from "./CompletionRatePanel";

const daysAgo = (days: number) =>
  new Date(Date.now() - days * millisecondsInDay).toISOString();

const stats: ActionStatsWithOnboardingDto[] = [
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

serveApi(routes({ "GET /analytics/action-stats": () => Response.json(stats) }));

const Panel = () => <CompletionRatePanel stats={useActionStats().stats} />;

const chartIn = async (title: string) => {
  const chart = (
    await screen.findByRole("region", { name: title })
  ).querySelector("svg[viewBox]");
  if (!chart) throw new Error(`no chart in ${title}`);
  chart.getBoundingClientRect = () => new DOMRect(0, 0, 1000, 350);
  return chart;
};

describe("CompletionRatePanel", () => {
  it("switches both charts to a 0-100% axis from the one Absolute toggle", async () => {
    render(<Panel />, queryWrapper());
    await chartIn("Cumulative completion rate");
    expect(screen.queryAllByText("100%")).toHaveLength(0);

    fireEvent.click(screen.getByRole("checkbox", { name: "Absolute" }));

    for (const title of [
      "Cumulative completion rate",
      "Non-cumulative completion rate (weekly)",
    ]) {
      expect(
        within(screen.getByRole("region", { name: title })).getByText("100%"),
      ).toBeTruthy();
    }
  });

  it("describes the hovered week, cutting long task names", async () => {
    render(<Panel />, queryWrapper());
    const weekly = await chartIn("Non-cumulative completion rate (weekly)");

    fireEvent.mouseMove(weekly, { clientX: 999 });

    expect(screen.getByText("Completed / joined")).toBeTruthy();
    expect(screen.getByText("6/10")).toBeTruthy();
    expect(screen.getByText("Task 1")).toBeTruthy();
    expect(
      screen.getByText("Call your representative about the new t..."),
    ).toBeTruthy();
  });

  it("describes the hovered day's running average", async () => {
    render(<Panel />, queryWrapper());
    const cumulative = await chartIn("Cumulative completion rate");

    fireEvent.mouseMove(cumulative, { clientX: 999 });

    expect(screen.getByText("Average rate").nextSibling?.textContent).toBe(
      "55.00%",
    );
    expect(screen.getByText("Total tasks").nextSibling?.textContent).toBe("2");
  });
});
