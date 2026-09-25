import type { ScheduledPlansOverviewDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { sessionExpiredMessage } from "../lib/sessionExpired";
import ScheduledPlansPage from "./ScheduledPlansPage";

afterEach(cleanup);

const renderPage = (query = queryWrapper()) =>
  render(
    <MemoryRouter>
      <ScheduledPlansPage />
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
    ).toBe("/actions/7");
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
            : "Unable to load scheduled plans.",
        ),
      ).toBeTruthy();
      expect(
        screen.queryByText("No planned automated actions in this window."),
      ).toBeNull();
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

  it("keeps the loaded timeline beside the error", async () => {
    const query = queryWrapper();
    renderPage(query);
    await screen.findByRole("link", { name: "Forum action" });

    status = 500;
    await act(() => query.client.refetchQueries());

    expect(
      await screen.findByText("Unable to load scheduled plans."),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Forum action" })).toBeTruthy();
  });
});
