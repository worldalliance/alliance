import { type Pending, pending } from "@alliance/shared/lib/testing/pending";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import StatsPage from "./StatsPage";

let clickRatesStatus = 200;
let contractStatusHistoryStatus = 200;
let respondToContractStatusHistory: (() => Promise<Response>) | null = null;
let dailyStatsStatus = 200;
let dailyStatsRequests: URL[] = [];
let inviteFunnelStatus = 200;
let platformTenureCohortStatus = 200;
let platformTenureCohortMessage = "Internal server error";
let platformTenureCohortRequests: URL[] = [];
let respondToPlatformTenureCohort: (() => Promise<Response>) | null = null;

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
    "GET /analytics/contract-status-history": () => {
      if (respondToContractStatusHistory)
        return respondToContractStatusHistory();
      return contractStatusHistoryStatus === 200
        ? Response.json([])
        : Response.json({}, { status: contractStatusHistoryStatus });
    },
    "GET /analytics/aggregate-stats": () => Response.json(null),
    "GET /analytics/missed-actions": () =>
      Response.json({ missedLastAction: [], missedLastTwoActions: [] }),
    "GET /analytics/member-reliability-window": () =>
      Response.json({
        weeks: 5,
        firstWeek: { assignedCount: 0, completedCount: 0, completionRate: 0 },
        fourthWeekOrLater: {
          assignedCount: 0,
          completedCount: 0,
          completionRate: 0,
        },
      }),
    "GET /analytics/invite-funnel": () =>
      inviteFunnelStatus === 200
        ? Response.json({
            invitesCreated: 4,
            invitesUsed: 3,
            contractSigned: 2,
            onboardingCompleted: 1,
          })
        : Response.json({}, { status: inviteFunnelStatus }),
    "GET /analytics/platform-tenure-cohort": ({ request }) => {
      platformTenureCohortRequests.push(new URL(request.url));
      if (respondToPlatformTenureCohort) return respondToPlatformTenureCohort();
      return platformTenureCohortStatus === 200
        ? Response.json({
            weeksOnPlatform: 4,
            cohortSize: 37,
            activeCount: 30,
            churnedCount: 7,
            churnRate: 7 / 37,
            assignedCount: 50,
            completedCount: 20,
            completionRate: 0.4,
            actions: [],
          })
        : Response.json(
            { message: platformTenureCohortMessage },
            { status: platformTenureCohortStatus },
          );
    },
    "GET /analytics/reminder-group-click-rates": () =>
      clickRatesStatus === 200
        ? Response.json([])
        : Response.json({}, { status: clickRatesStatus }),
  }),
);

afterEach(() => {
  clickRatesStatus = 200;
  contractStatusHistoryStatus = 200;
  respondToContractStatusHistory = null;
  dailyStatsStatus = 200;
  dailyStatsRequests = [];
  inviteFunnelStatus = 200;
  platformTenureCohortStatus = 200;
  platformTenureCohortMessage = "Internal server error";
  platformTenureCohortRequests = [];
  respondToPlatformTenureCohort = null;
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

const dailyStats = () => screen.getByRole("region", { name: /^Daily stats/ });
const dateInput = (label: string) => within(dailyStats()).getByLabelText(label);

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

    fireEvent.change(dateInput("From"), {
      target: { value: "2026-02-10" },
    });
    fireEvent.change(dateInput("To"), {
      target: { value: "2026-02-01" },
    });
    fireEvent.click(
      within(dailyStats()).getByRole("button", { name: "Apply" }),
    );

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

    fireEvent.change(dateInput("From"), { target: { value: "" } });
    fireEvent.click(
      within(dailyStats()).getByRole("button", { name: "Apply" }),
    );
    await screen.findByText("Please provide valid start and end dates.");

    fireEvent.click(
      within(dailyStats()).getByRole("button", { name: "Last 30 days" }),
    );

    expect(
      screen.queryByText("Please provide valid start and end dates."),
    ).toBeNull();
  });

  it("requests a valid range once applied", async () => {
    renderPage();
    await screen.findByText("No daily stats for this range.");

    fireEvent.change(dateInput("From"), {
      target: { value: "2026-02-01" },
    });
    fireEvent.change(dateInput("To"), {
      target: { value: "2026-02-10" },
    });
    fireEvent.click(
      within(dailyStats()).getByRole("button", { name: "Apply" }),
    );

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
    expect(screen.queryByText("Loading invite funnel…")).toBeNull();
  });

  it("says the load failed instead of charting nothing", async () => {
    inviteFunnelStatus = 500;

    renderPage();

    await screen.findByText("Unable to load the invite funnel.");
    expect(screen.queryByText("Loading invite funnel…")).toBeNull();
  });
});

describe("StatsPage members over time", () => {
  it("says so when there is no history in range", async () => {
    renderPage();

    await screen.findByText("No contract status data in this date range.");
  });

  it("says the load failed instead of reporting none", async () => {
    contractStatusHistoryStatus = 500;

    renderPage();

    await screen.findByText("Unable to load members over time.");
    expect(
      screen.queryByText("No contract status data in this date range."),
    ).toBeNull();
  });

  it("says it is loading, not that there is none, while a range change loads", async () => {
    renderPage();
    await screen.findByText("No contract status data in this date range.");
    const next: Pending<Response>[] = [];
    respondToContractStatusHistory = () => pending(next);

    const section = screen.getByRole("region", { name: "Members over time" });
    fireEvent.change(within(section).getByLabelText("From"), {
      target: { value: "2025-01-01" },
    });
    await waitFor(() => expect(next).toHaveLength(1));

    expect(within(section).getByText("Loading…")).toBeTruthy();
    expect(
      screen.queryByText("No contract status data in this date range."),
    ).toBeNull();
  });
});

describe("StatsPage platform tenure cohort", () => {
  const viewCohort = (weeks: string) => {
    const input = screen
      .getByText("Weeks after joining")
      .closest("label")
      ?.querySelector("input");
    if (!input) throw new Error("no weeks after joining input");
    fireEvent.change(input, { target: { value: weeks } });
    const form = input.closest("form");
    if (!form) throw new Error("no weeks after joining form");
    fireEvent.submit(form);
  };

  it("shows the cohort for the default weeks on load, then for the requested ones", async () => {
    renderPage();

    await screen.findByText("37");
    viewCohort("6");

    await waitFor(() =>
      expect(
        platformTenureCohortRequests.map((url) =>
          url.searchParams.get("weeksOnPlatform"),
        ),
      ).toEqual(["4", "6"]),
    );
  });

  it("refuses a week count that isn't a whole number without requesting it", async () => {
    renderPage();
    await screen.findByText("37");

    viewCohort("-1");

    await screen.findByText("Weeks on platform must be a whole number.");
    expect(platformTenureCohortRequests).toHaveLength(1);
  });

  it("retries the same weeks after a failed load", async () => {
    platformTenureCohortStatus = 500;
    renderPage();
    await screen.findByText(
      "Unable to load this cohort right now. Please try again soon.",
    );

    platformTenureCohortStatus = 200;
    viewCohort("4");

    await screen.findByText("37");
    expect(platformTenureCohortRequests).toHaveLength(2);
  });

  it("drops the shown cohort when reloading it fails", async () => {
    renderPage();
    await screen.findByText("37");

    platformTenureCohortStatus = 500;
    viewCohort("4");

    await screen.findByText(
      "Unable to load this cohort right now. Please try again soon.",
    );
    expect(screen.queryByText("37")).toBeNull();
  });

  it("says it is loading, not that it failed, while retrying a failed reload", async () => {
    renderPage();
    await screen.findByText("37");
    platformTenureCohortStatus = 500;
    viewCohort("4");
    await screen.findByText(
      "Unable to load this cohort right now. Please try again soon.",
    );

    const next: Pending<Response>[] = [];
    respondToPlatformTenureCohort = () => pending(next);
    viewCohort("4");
    await waitFor(() => expect(next).toHaveLength(1));

    await screen.findByText("Loading cohort…");
    expect(
      screen.queryByText(
        "Unable to load this cohort right now. Please try again soon.",
      ),
    ).toBeNull();
  });

  it("says why the server refused the cohort", async () => {
    platformTenureCohortStatus = 403;
    platformTenureCohortMessage = "Admins only";
    renderPage();

    await screen.findByText("Admins only");
  });
});
