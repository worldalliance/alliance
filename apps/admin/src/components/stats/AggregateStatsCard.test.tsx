import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen } from "@testing-library/react";
import { actionStat } from "./actionStatFixture";
import AggregateStatsCard from "./AggregateStatsCard";

serveApi(
  routes({
    "GET /analytics/aggregate-stats": () => Response.json({ signedUsers: 40 }),
  }),
);

describe("AggregateStatsCard", () => {
  it("leaves onboarding and optional actions out of completion reliability", async () => {
    render(
      <AggregateStatsCard
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
    );

    await screen.findByText("40");
    expect(screen.getByText(/75\.00/)).toBeTruthy();
    expect(screen.getByText(/25\.0/)).toBeTruthy();
  });
});
