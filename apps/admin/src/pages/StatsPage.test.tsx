import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import StatsPage from "./StatsPage";

afterEach(cleanup);

let clickRatesStatus = 200;
let dailyStatsStatus = 200;
let dailyStatsRequests: URL[] = [];
let inviteFunnelStatus = 200;

serveApi(
  routes({
    "GET /analytics/daily-stats": ({ request }) => {
      dailyStatsRequests.push(new URL(request.url));
      return dailyStatsStatus === 200
        ? Response.json([])
        : Response.json({}, { status: dailyStatsStatus });
    },
    "GET /analytics/action-stats": () => Response.json([]),
    "GET /analytics/action-completion-curves": () => Response.json([]),
    "GET /analytics/member-completion-retention": () => Response.json([]),
    "GET /analytics/time-to-churn": () => Response.json([]),
    "GET /analytics/contract-status-history": () => Response.json([]),
    "GET /analytics/aggregate-stats": () => Response.json(null),
    "GET /analytics/invite-funnel": () =>
      inviteFunnelStatus === 200
        ? Response.json({
            invitesCreated: 4,
            invitesUsed: 3,
            contractSigned: 2,
            onboardingCompleted: 1,
          })
        : Response.json({}, { status: inviteFunnelStatus }),
    "GET /analytics/reminder-group-click-rates": () =>
      clickRatesStatus === 200
        ? Response.json([])
        : Response.json({}, { status: clickRatesStatus }),
  }),
);

afterEach(() => {
  clickRatesStatus = 200;
  dailyStatsStatus = 200;
  dailyStatsRequests = [];
  inviteFunnelStatus = 200;
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

const dateInput = (label: string) => {
  const input = screen.getByText(label).closest("div")?.querySelector("input");
  if (!input) throw new Error(`no input labelled ${label}`);
  return input;
};

describe("StatsPage daily stats", () => {
  it("says the load failed instead of reporting none", async () => {
    dailyStatsStatus = 500;

    renderPage();

    await screen.findByText(
      "Unable to load analytics right now. Please try again soon.",
    );
    expect(screen.queryByText("No daily stats for this range.")).toBeNull();
  });

  it("refuses a range that ends before it starts without requesting it", async () => {
    renderPage();
    await screen.findByText("No daily stats for this range.");

    fireEvent.change(dateInput("Start date"), {
      target: { value: "2026-02-10" },
    });
    fireEvent.change(dateInput("End date"), {
      target: { value: "2026-02-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    await screen.findByText("Start date must be before the end date.");
    expect(
      dailyStatsRequests.some(
        (url) => url.searchParams.get("date") === "2026-02-10T00:00:00.000Z",
      ),
    ).toBe(false);
  });

  it("clears a refused range once a quick range applies", async () => {
    renderPage();
    await screen.findByText("No daily stats for this range.");

    fireEvent.change(dateInput("Start date"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    await screen.findByText("Please provide valid start and end dates.");

    fireEvent.click(screen.getByRole("button", { name: "Last 30 days" }));

    expect(
      screen.queryByText("Please provide valid start and end dates."),
    ).toBeNull();
  });

  it("requests a valid range once applied", async () => {
    renderPage();
    await screen.findByText("No daily stats for this range.");

    fireEvent.change(dateInput("Start date"), {
      target: { value: "2026-02-01" },
    });
    fireEvent.change(dateInput("End date"), {
      target: { value: "2026-02-10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(() =>
      expect(
        dailyStatsRequests.map((url) => url.searchParams.get("endDate")),
      ).toContain("2026-02-10T00:00:00.000Z"),
    );
  });
});

describe("StatsPage invite funnel", () => {
  it("charts the funnel's stages", async () => {
    renderPage();

    await screen.findByText("Finished Onboarding");
    expect(screen.queryByText("Loading invite funnel...")).toBeNull();
  });

  it("says the load failed instead of charting nothing", async () => {
    inviteFunnelStatus = 500;

    renderPage();

    await screen.findByText("Unable to load the invite funnel.");
    expect(screen.queryByText("Loading invite funnel...")).toBeNull();
  });
});
