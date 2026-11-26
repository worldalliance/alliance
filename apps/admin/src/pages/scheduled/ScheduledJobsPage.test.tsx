import type { ScheduledPlansOverviewDto } from "@alliance/shared/client";
import { makeProfile } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  setSystemTime,
} from "bun:test";
import { MemoryRouter } from "react-router";
import { sessionExpiredMessage } from "../../lib/sessionExpired";
import { LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import { ToastProvider } from "../../ui/ToastProvider";
import ScheduledJobsPage from "./ScheduledJobsPage";

beforeEach(() => setSystemTime(new Date(2026, 5, 1)));
afterEach(() => setSystemTime());

const renderPage = (query = queryWrapper()) =>
  render(
    <MemoryRouter initialEntries={["/activity/scheduled"]}>
      <ToastProvider>
        <ScheduledJobsPage />
      </ToastProvider>
    </MemoryRouter>,
    query,
  );

const plans: ScheduledPlansOverviewDto = {
  suspensionPlans: [],
  forumAutocompletePlans: [
    {
      date: "2026-01-02T00:00:00.000Z",
      action: { id: 7, name: "Forum action" },
      users: [],
    },
  ],
};

const sam = { ...makeProfile(3), displayName: "Sam Lee" };

describe("scheduled plans", () => {
  serveApi(
    routes({
      "GET /actions/scheduledPlans": () => Response.json(plans),
    }),
  );

  it("lists the loaded plans", async () => {
    renderPage();
    expect(
      (await screen.findByRole("link", { name: "Forum action" })).getAttribute(
        "href",
      ),
    ).toBe("/tasks/7");
  });

  it("shows when a forum auto-complete runs in Pacific time, with UTC as its tooltip", async () => {
    renderPage();
    const when = await screen.findByText(/^Thu, Jan 1, 4:00 PM PT$/);
    expect(when.title).toMatch(/^Fri, Jan 2, 12:00 AM UTC\./);
  });

  it("counts the jobs in the description", async () => {
    renderPage();
    expect(await screen.findByText(/soonest first\. 1 job\.$/)).toBeTruthy();
  });
});

describe("scheduled jobs with members", () => {
  serveApi(
    routes({
      "GET /actions/scheduledPlans": () =>
        Response.json({
          suspensionPlans: [{ date: "2026-01-02T08:00:00.000Z", users: [sam] }],
          forumAutocompletePlans: [],
        } satisfies ScheduledPlansOverviewDto),
    }),
  );

  it("shows the day a suspension is due by, with the sampled time in Pacific time and UTC as its tooltip", async () => {
    renderPage();
    const when = await screen.findByText(/^By Fri, Jan 2$/);
    expect(when.title).toMatch(/Fri, Jan 2, 12:00 AM PT/);
    expect(when.title).toMatch(/Fri, Jan 2, 8:00 AM UTC/);
  });

  it("expands a job to its exact time and its members, each linked to their record", async () => {
    renderPage();
    const toggle = await screen.findByRole("button", { name: /^1 member: / });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("link", { name: "Sam Lee" })).toBeNull();

    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(
      screen.getByText(/Fri, Jan 2, 8:00 AM UTC.*up to 6 hours sooner/),
    ).toBeDefined();
    expect(
      screen.getByRole("link", { name: "Sam Lee" }).getAttribute("href"),
    ).toBe("/members/3");

    fireEvent.click(toggle);

    expect(screen.queryByRole("link", { name: "Sam Lee" })).toBeNull();
  });
});

describe("scheduled jobs with none due", () => {
  serveApi(
    routes({
      "GET /actions/scheduledPlans": () =>
        Response.json({
          suspensionPlans: [],
          forumAutocompletePlans: [],
        } satisfies ScheduledPlansOverviewDto),
    }),
  );

  it("says nothing is scheduled", async () => {
    renderPage();
    expect(await screen.findByText("No scheduled jobs")).toBeTruthy();
  });
});

for (const status of [401, 500]) {
  describe(`scheduled plans HTTP ${status}`, () => {
    serveApi(
      routes({
        "GET /actions/scheduledPlans": () =>
          Response.json({ statusCode: status }, { status }),
      }),
    );

    it("says the load failed instead of claiming no plans", async () => {
      renderPage();
      expect(
        await screen.findByText("Couldn't load scheduled jobs"),
      ).toBeTruthy();
      expect(
        screen.getByText(
          status === 401 ? sessionExpiredMessage : LOAD_FAILED_FALLBACK,
        ),
      ).toBeTruthy();
      expect(screen.queryByText("No scheduled jobs")).toBeNull();
    });
  });
}

describe("scheduled plans refetch failure", () => {
  let status = 200;
  serveApi(
    routes({
      "GET /actions/scheduledPlans": () =>
        status === 200
          ? Response.json(plans)
          : Response.json({ statusCode: status }, { status }),
    }),
  );

  it("keeps the loaded jobs beside the error", async () => {
    const query = queryWrapper();
    renderPage(query);
    await screen.findByRole("link", { name: "Forum action" });

    status = 500;
    await act(() => query.client.refetchQueries());

    expect(
      await screen.findByText(
        `Couldn't refresh scheduled jobs. ${LOAD_FAILED_FALLBACK} Showing what loaded before.`,
      ),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Forum action" })).toBeTruthy();
  });
});
