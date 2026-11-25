import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen } from "@testing-library/react";
import { actionStat } from "./actionStatFixture";
import { KeyStats } from "./KeyStats";

const api = serveApi(
  routes({
    "GET /analytics/aggregate-stats": () => Response.json({ signedUsers: 40 }),
  }),
);

describe("KeyStats", () => {
  it("leaves onboarding and optional tasks out of completion reliability", async () => {
    render(
      <KeyStats
        actionStats={[
          actionStat({ usersCompleted: 3, usersJoined: 4 }),
          actionStat({ usersCompleted: 0, usersJoined: 10, onboarding: true }),
          actionStat({ usersCompleted: 0, usersJoined: 10, optional: true }),
        ]}
        parsedContractStatusHistory={[
          {
            date: "2026-02-01",
            activeCount: 30,
            churnedCount: 10,
            totalEverSigned: 40,
            parsedDate: new Date("2026-02-01T00:00:00Z"),
          },
        ]}
      />,
      queryWrapper(),
    );

    await screen.findByText("40");
    expect(screen.getByText(/75\.00/)).toBeTruthy();
    expect(screen.getByText(/25\.0/)).toBeTruthy();
  });

  it("says so when the stats fail to load", async () => {
    api.alsoServing({
      "GET /analytics/aggregate-stats": () =>
        Response.json({ message: "boom" }, { status: 500 }),
    });

    render(
      <KeyStats actionStats={[]} parsedContractStatusHistory={[]} />,
      queryWrapper(),
    );

    await screen.findByText("Couldn't load the organization's stats");
  });
});
