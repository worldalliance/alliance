import type { ScheduledPlansOverviewDto } from "@alliance/shared/client";
import { makeProfile } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { sessionExpiredMessage } from "../../lib/sessionExpired";
import { ToastProvider } from "../../ui/ToastProvider";
import ScheduledJobsPage from "./ScheduledJobsPage";

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

  it("shows when a job runs in Pacific time and in UTC", async () => {
    renderPage();
    expect(await screen.findByText("Fri, Jan 2, 12:00 AM PT")).toBeTruthy();
    expect(screen.getByText("2026-01-02T08:00:00.000Z")).toBeTruthy();
  });

  it("expands a job to its members, each linked to their record", async () => {
    renderPage();
    const toggle = await screen.findByRole("button", { name: /^1 member: / });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("link", { name: "Sam Lee" })).toBeNull();

    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
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
        await screen.findByText(
          status === 401
            ? sessionExpiredMessage
            : "Couldn't load scheduled jobs",
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
      await screen.findByText(/Couldn't refresh scheduled jobs\./),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Forum action" })).toBeTruthy();
  });
});
