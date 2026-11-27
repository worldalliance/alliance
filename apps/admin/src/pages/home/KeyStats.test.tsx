import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, render, screen, within } from "@testing-library/react";
import { useActionStats } from "../../lib/useActionStats";
import { LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import { actionStat } from "./actionStatFixture";
import { KeyStats } from "./KeyStats";

const api = serveApi(
  routes({
    "GET /analytics/aggregate-stats": () => Response.json({ signedUsers: 40 }),
    "GET /analytics/action-stats": () =>
      Response.json([
        actionStat({ usersCompleted: 3, usersJoined: 4 }),
        actionStat({ usersCompleted: 0, usersJoined: 10, onboarding: true }),
        actionStat({ usersCompleted: 0, usersJoined: 10, optional: true }),
      ]),
    "GET /analytics/contract-status-history": () =>
      Response.json([
        {
          date: "2026-02-01",
          activeCount: 30,
          churnedCount: 10,
          totalEverSigned: 40,
        },
      ]),
  }),
);

const Stats = () => <KeyStats stats={useActionStats().stats} />;

const tile = (label: string) => screen.getByText(label).parentElement!;

describe("KeyStats", () => {
  it("leaves onboarding and optional tasks out of completion reliability", async () => {
    render(<Stats />, queryWrapper());

    await screen.findByText("40");
    expect(await screen.findByText(/75\.00/)).toBeTruthy();
    expect(await screen.findByText(/25\.0/)).toBeTruthy();
  });

  it("says so when the stats fail to load", async () => {
    api.alsoServing({
      "GET /analytics/aggregate-stats": () =>
        Response.json({ message: "boom" }, { status: 500 }),
    });

    render(<Stats />, queryWrapper());

    await screen.findByText("Couldn't load the organization's stats");
    expect(screen.getByText(LOAD_FAILED_FALLBACK)).toBeTruthy();
  });

  it("says a tile's number couldn't load instead of showing none", async () => {
    api.alsoServing({
      "GET /analytics/contract-status-history": () =>
        Response.json({ message: "boom" }, { status: 500 }),
    });

    render(<Stats />, queryWrapper());

    await screen.findByText("40");
    expect(
      await within(tile("All-time churn")).findByText("Couldn't load"),
    ).toBeTruthy();
    expect(
      within(tile("Churn in the last 30 days")).getByText("Couldn't load"),
    ).toBeTruthy();
  });

  it("says when completion reliability fails to refresh", async () => {
    const query = queryWrapper();
    render(<Stats />, query);
    await screen.findByText(/75\.00/);
    api.alsoServing({
      "GET /analytics/action-stats": () =>
        Response.json({ message: "boom" }, { status: 500 }),
    });

    await act(() =>
      query.client.refetchQueries({ queryKey: queryKeys.actionStatsAdmin() }),
    );

    expect(
      await screen.findByText(/Couldn't refresh completion reliability/),
    ).toBeTruthy();
  });
});
