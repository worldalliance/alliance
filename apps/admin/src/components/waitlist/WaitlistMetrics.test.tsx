import type { WaitlistMetricsDto } from "@alliance/shared/client/types.gen";
import { formatMediumDateEnUS } from "@alliance/shared/lib/dateFormatters";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, render, screen, within } from "@testing-library/react";
import WaitlistMetrics, { formatElapsed } from "./WaitlistMetrics";

const organization = { id: 7, name: "Acme" };

const served: WaitlistMetricsDto = {
  status: {
    entries: 4,
    waiting: 2,
    mobilized: 2,
    inviteClaimed: 1,
    inviteClaims: 2,
  },
  inviteEmails: {
    emailed: 2,
    claimed: 1,
    timedClaims: 1,
    medianSecondsToClaim: 4 * 60 * 60,
  },
  weeks: [{ weekStart: "2026-03-02", entries: 4, claims: 2 }],
  sources: [
    {
      organization,
      link: {
        id: 9,
        channel: "Newsletter",
        publishedAt: "2026-02-20T12:00:00.000Z",
      },
      entries: 4,
      claims: 2,
    },
  ],
  conversions: [
    {
      organization,
      group: null,
      claims: 2,
      contractSigned: 1,
      firstAction: 0,
    },
  ],
};

let requests: unknown[];
let response: Response | null;

serveApi(
  routes({
    "POST /waitlist/admin/entries/metrics": async ({ request }) => {
      requests.push(await request.json());
      return response ?? Response.json(served);
    },
  }),
);

beforeEach(() => {
  requests = [];
  response = null;
});

afterEach(cleanup);

const renderMetrics = () =>
  render(<WaitlistMetrics filter={{ organizationIds: [7] }} />, queryWrapper());

describe("WaitlistMetrics", () => {
  it("shows the filtered entries' counts and rates", async () => {
    renderMetrics();

    const metrics = await screen.findByRole("region", { name: "Metrics" });
    expect(requests).toEqual([{ filter: { organizationIds: [7] } }]);
    expect(
      within(metrics).getByText("For the 4 entries", { exact: false }),
    ).toBeTruthy();
    const stat = (label: string) =>
      within(metrics).getByText(label).nextElementSibling?.textContent;
    expect(stat("Invite claimed")).toBe("1 of 4 (25%)");
    expect(stat("Invite claims")).toBe("2");
    expect(stat("Emailed, then claimed")).toBe("1 of 2 (50%)");
    expect(stat("Median email to claim")).toBe("4 h (of 1 entry)");
  });

  it("lists sources, weeks, and conversions by destination group", async () => {
    renderMetrics();

    const rowText = (caption: string) =>
      within(screen.getByRole("table", { name: caption }))
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.textContent);
    await screen.findByRole("region", { name: "Metrics" });
    expect(rowText("By source")).toEqual([
      `AcmeNewsletter${formatMediumDateEnUS(new Date("2026-02-20T12:00:00.000Z"))}42`,
    ]);
    expect(rowText("By week (UTC, from Monday)")).toEqual(["2026-03-0242"]);
    expect(rowText("Claimed invites, by destination group")).toEqual([
      "AcmeUnassigned21 of 2 (50%)0 of 2 (0%)",
    ]);
  });

  it("says when nothing was claimed after an email or a table is empty", async () => {
    response = Response.json({
      ...served,
      inviteEmails: {
        ...served.inviteEmails,
        timedClaims: 0,
        medianSecondsToClaim: null,
      },
      conversions: [],
    } satisfies WaitlistMetricsDto);
    renderMetrics();

    const metrics = await screen.findByRole("region", { name: "Metrics" });
    expect(
      within(metrics).getByText("Median email to claim").nextElementSibling
        ?.textContent,
    ).toBe("—");
    expect(metrics.textContent).toContain(
      "Claimed invites, by destination group: none",
    );
  });

  it("says when the metrics fail to load", async () => {
    response = Response.json({}, { status: 500 });
    renderMetrics();

    expect(await screen.findByText("Unable to load the metrics.")).toBeTruthy();
  });
});

describe("formatElapsed", () => {
  it.each([
    [20, "< 1 min"],
    [30 * 60, "30 min"],
    [3599, "1 h"],
    [47.99 * 60 * 60, "2 days"],
    [90 * 60, "1.5 h"],
    [3 * 24 * 60 * 60, "3 days"],
  ])("formats %i seconds as %s", (seconds, text) => {
    expect(formatElapsed(seconds)).toBe(text);
  });
});
