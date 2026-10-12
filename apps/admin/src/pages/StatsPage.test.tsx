import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, render, screen } from "@testing-library/react";
import StatsPage from "./StatsPage";

afterEach(cleanup);

let clickRatesStatus = 200;

serveApi(
  routes({
    "GET /analytics/daily-stats": () => Response.json([]),
    "GET /analytics/action-stats": () => Response.json([]),
    "GET /analytics/action-completion-curves": () => Response.json([]),
    "GET /analytics/member-completion-retention": () => Response.json([]),
    "GET /analytics/time-to-churn": () => Response.json([]),
    "GET /analytics/contract-status-history": () => Response.json([]),
    "GET /analytics/aggregate-stats": () => Response.json(null),
    "GET /analytics/invite-funnel": () => Response.json(null),
    "GET /analytics/reminder-group-click-rates": () =>
      clickRatesStatus === 200
        ? Response.json([])
        : Response.json({}, { status: clickRatesStatus }),
  }),
);

afterEach(() => {
  clickRatesStatus = 200;
});

const renderPage = () => {
  const { wrapper } = queryWrapper();
  render(<StatsPage />, { wrapper });
};

describe("StatsPage reminder click rates", () => {
  it("says so when there are none in range", async () => {
    renderPage();

    await screen.findByText(/No sent reminder groups with email\/text link/);
  });

  it("says the load failed instead of reporting none", async () => {
    clickRatesStatus = 500;

    renderPage();

    await screen.findByText("Unable to load reminder click rates.");
    expect(
      screen.queryByText(/No sent reminder groups with email\/text link/),
    ).toBeNull();
  });
});
