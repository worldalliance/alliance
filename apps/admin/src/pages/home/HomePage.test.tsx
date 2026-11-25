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
import { MemoryRouter } from "react-router";
import { ToastProvider } from "../../ui/ToastProvider";
import HomePage from "./HomePage";

let needsReplyThreads: unknown[] = [];
let awaitingGroup: unknown[] = [];
let welcomeQueueStatus = 200;
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
    "GET /mms-threads/needs-reply-threads": () =>
      Response.json(needsReplyThreads),
    "GET /actions/welcome-queue": () =>
      welcomeQueueStatus === 200
        ? Response.json({ requiredActionCount: 1, members: [] })
        : Response.json({}, { status: welcomeQueueStatus }),
    "POST /user/groupAssignment/members": () => Response.json(awaitingGroup),
    "GET /action-partnerships/responses": () => Response.json([]),
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
  needsReplyThreads = [];
  awaitingGroup = [];
  welcomeQueueStatus = 200;
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

/** A delayed skeleton holds its space hidden at first; this is whether the reader sees it yet. */
const shown = (status: HTMLElement) => !status.classList.contains("invisible");

const renderPage = () => {
  render(
    <MemoryRouter>
      <ToastProvider>
        <HomePage />
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );
};

describe("HomePage queues", () => {
  it("says nothing needs you when every queue is empty", async () => {
    renderPage();

    await screen.findByText("Nothing needs you right now");
    expect(screen.queryByRole("heading", { name: "Needs you" })).toBeNull();
  });

  it("lists only the queues with someone waiting, each with its count and the way to it", async () => {
    needsReplyThreads = [{}, {}];
    awaitingGroup = [{}, {}, {}];
    renderPage();

    const texts = (await screen.findByText("Texts need a reply")).closest("li");
    const awaiting = screen.getByText("Members awaiting a group").closest("li");
    if (!texts || !awaiting) throw new Error("no queue rows");
    expect(texts.textContent).toContain("2");
    expect(
      within(texts)
        .getByRole("link", { name: "Open inbox" })
        .getAttribute("href"),
    ).toBe("/inbox");
    expect(awaiting.textContent).toContain("3");
    expect(
      within(awaiting)
        .getByRole("link", { name: "Open group assignment" })
        .getAttribute("href"),
    ).toBe("/members/groups?tab=awaiting");
    expect(screen.queryByText("New members to welcome")).toBeNull();
    expect(screen.queryByText("Partnership responses to review")).toBeNull();
    expect(screen.queryByText("Nothing needs you right now")).toBeNull();
  });

  it("keeps a queue whose count couldn't load, instead of calling it empty", async () => {
    welcomeQueueStatus = 500;
    renderPage();

    const row = (await screen.findByText(/This count couldn't load/)).closest(
      "li",
    );
    if (!row) throw new Error("no queue row");
    expect(row.textContent).toContain("New members to welcome");
    expect(
      within(row).getByRole("link", { name: "Open welcome queue" }),
    ).toBeTruthy();
    expect(screen.queryByText("Nothing needs you right now")).toBeNull();
  });
});

describe("HomePage reminder click rates", () => {
  it("says so when there are none in range", async () => {
    renderPage();

    await screen.findByText(/No sent reminder groups with email or text link/);
  });

  it("says the load failed instead of reporting none", async () => {
    clickRatesStatus = 500;

    renderPage();

    await screen.findByText("Couldn't load reminder click rates");
    expect(
      screen.queryByText(/No sent reminder groups with email or text link/),
    ).toBeNull();
  });
});

const dateInput = (label: string) => screen.getByLabelText(label);

describe("HomePage daily stats", () => {
  it("says the load failed instead of reporting none", async () => {
    dailyStatsStatus = 500;

    renderPage();

    await screen.findByText("Couldn't load daily stats");
    expect(screen.queryByText("No daily stats for this range")).toBeNull();
  });

  it("refuses a range that ends before it starts without requesting it", async () => {
    renderPage();
    await screen.findByText("No daily stats for this range");

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
    await screen.findByText("No daily stats for this range");

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
    await screen.findByText("No daily stats for this range");

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

const funnelPanel = () =>
  screen.getByRole("region", { name: "Invite conversion funnel" });

describe("HomePage invite funnel", () => {
  it("charts the funnel's stages", async () => {
    renderPage();

    await screen.findByText("Finished onboarding");
    expect(within(funnelPanel()).queryByRole("status")).toBeNull();
  });

  it("says the load failed instead of charting nothing", async () => {
    inviteFunnelStatus = 500;

    renderPage();

    await screen.findByText("Couldn't load the invite funnel");
    expect(within(funnelPanel()).queryByRole("status")).toBeNull();
  });
});

describe("HomePage members over time", () => {
  it("says so when there is no history in range", async () => {
    renderPage();

    await screen.findByText("No contract status data in this date range");
  });

  it("says the load failed instead of reporting none", async () => {
    contractStatusHistoryStatus = 500;

    renderPage();

    await screen.findByText("Couldn't load members over time");
    expect(
      screen.queryByText("No contract status data in this date range"),
    ).toBeNull();
  });

  it("says it is loading, not that there is none, while a range change loads", async () => {
    renderPage();
    await screen.findByText("No contract status data in this date range");
    const next: Pending<Response>[] = [];
    respondToContractStatusHistory = () => pending(next);

    const section = screen.getByRole("region", { name: "Members over time" });
    fireEvent.change(within(section).getByLabelText("From"), {
      target: { value: "2025-01-01" },
    });
    await waitFor(() => expect(next).toHaveLength(1));

    await waitFor(() =>
      expect(shown(within(section).getByRole("status"))).toBe(true),
    );
    expect(
      screen.queryByText("No contract status data in this date range"),
    ).toBeNull();
  });

  it("keeps the chart, marked as updating, while a range change loads", async () => {
    respondToContractStatusHistory = async () =>
      Response.json([
        {
          date: "2026-01-01",
          activeCount: 10,
          churnedCount: 1,
          totalEverSigned: 11,
        },
        {
          date: "2026-02-01",
          activeCount: 12,
          churnedCount: 2,
          totalEverSigned: 14,
        },
      ]);
    renderPage();
    const section = await screen.findByRole("region", {
      name: "Members over time",
    });
    await within(section).findByRole("img");
    const next: Pending<Response>[] = [];
    respondToContractStatusHistory = () => pending(next);

    fireEvent.change(within(section).getByLabelText("From"), {
      target: { value: "2025-01-01" },
    });
    await waitFor(() => expect(next).toHaveLength(1));

    expect(within(section).getByText("Updating…")).toBeTruthy();
    expect(within(section).getByRole("img")).toBeTruthy();
  });
});

describe("HomePage platform tenure cohort", () => {
  const cohortPanel = () =>
    screen.getByRole("region", {
      name: "Task completion and churn after joining",
    });
  const viewCohort = (weeks: string) => {
    const input = screen.getByLabelText("Weeks after joining");
    fireEvent.change(input, { target: { value: weeks } });
    const form = input.closest("form");
    if (!form) throw new Error("no weeks after joining form");
    fireEvent.submit(form);
  };

  it("shows the cohort for the requested weeks", async () => {
    renderPage();

    viewCohort("4");

    await screen.findByText("37");
    expect(
      platformTenureCohortRequests.map((url) =>
        url.searchParams.get("weeksOnPlatform"),
      ),
    ).toEqual(["4"]);
  });

  it("refuses a week count that isn't a whole number without requesting it", async () => {
    renderPage();

    viewCohort("-1");

    await screen.findByText("Weeks on platform must be a whole number.");
    expect(platformTenureCohortRequests).toEqual([]);
  });

  it("retries the same weeks after a failed load", async () => {
    platformTenureCohortStatus = 500;
    renderPage();
    viewCohort("4");
    await screen.findByText("Couldn't load this cohort");

    platformTenureCohortStatus = 200;
    viewCohort("4");

    await screen.findByText("37");
    expect(platformTenureCohortRequests).toHaveLength(2);
  });

  it("drops the shown cohort when reloading it fails", async () => {
    renderPage();
    viewCohort("4");
    await screen.findByText("37");

    platformTenureCohortStatus = 500;
    viewCohort("4");

    await screen.findByText("Couldn't load this cohort");
    expect(screen.queryByText("37")).toBeNull();
  });

  it("says it is loading, not that it failed, while retrying a failed reload", async () => {
    renderPage();
    viewCohort("4");
    await screen.findByText("37");
    platformTenureCohortStatus = 500;
    viewCohort("4");
    await screen.findByText("Couldn't load this cohort");

    const next: Pending<Response>[] = [];
    respondToPlatformTenureCohort = () => pending(next);
    viewCohort("4");
    await waitFor(() => expect(next).toHaveLength(1));

    const status = await within(cohortPanel()).findByRole("status");
    await waitFor(() => expect(shown(status)).toBe(true));
    expect(screen.queryByText("Couldn't load this cohort")).toBeNull();
  });

  it("says why the server refused the cohort", async () => {
    platformTenureCohortStatus = 403;
    platformTenureCohortMessage = "Admins only";
    renderPage();

    viewCohort("4");

    await screen.findByText("Admins only");
  });
});
