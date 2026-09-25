import type { WelcomeQueueDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import * as config from "@alliance/sharedweb/lib/config";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { sessionExpiredMessage } from "../lib/sessionExpired";
import WelcomeQueuePage from "./WelcomeQueuePage";

afterEach(cleanup);

const renderPage = (query = queryWrapper()) =>
  render(
    <MemoryRouter>
      <WelcomeQueuePage />
    </MemoryRouter>,
    query,
  );

beforeEach(() => {
  jest.spyOn(config, "getBaseUrl").mockReturnValue("http://localhost:5573");
});

const queue: WelcomeQueueDto = {
  requiredActionCount: 2,
  members: [
    {
      user: {
        id: 2,
        displayName: "Second member",
        admin: false,
        staff: false,
        ambassador: false,
        profilePicture: null,
        profileDescription: null,
        anonymous: false,
        hasActiveContract: false,
        isCommunityLeader: false,
      },
      actionId: 42,
      activityId: 102,
      completedAt: "2026-01-01T00:00:00.000Z",
      staffLikeCount: 1,
    },
    {
      user: {
        id: 1,
        displayName: "First member",
        admin: false,
        staff: false,
        ambassador: false,
        profilePicture: null,
        profileDescription: null,
        anonymous: false,
        hasActiveContract: false,
        isCommunityLeader: false,
      },
      actionId: 43,
      activityId: 101,
      completedAt: "2026-01-02T00:00:00.000Z",
      staffLikeCount: 0,
    },
  ],
};

describe("onboarding welcome queue", () => {
  serveApi(
    routes({
      "GET /actions/welcome-queue": () => Response.json(queue),
    }),
  );

  it("links each member's completion and preserves the server's order", async () => {
    renderPage();

    const links = await screen.findAllByRole("link", {
      name: "Leave welcome comment",
    });
    expect(
      links.map((link) => new URL(link.getAttribute("href")!).pathname),
    ).toEqual(["/actions/42/activity/102", "/actions/43/activity/101"]);

    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(
      rows.map(
        (row) => within(row).getByRole("link", { name: /member/ }).textContent,
      ),
    ).toEqual(["Second member", "First member"]);
  });
});

describe("empty welcome queue", () => {
  serveApi(
    routes({
      "GET /actions/welcome-queue": () =>
        Response.json({ requiredActionCount: 2, members: [] }),
    }),
  );

  it("shows an empty queue", async () => {
    renderPage();
    expect(await screen.findByText("0 members need a welcome")).toBeTruthy();
    expect(screen.getByText("No completions match this filter.")).toBeTruthy();
  });
});

describe("unconfigured welcome queue", () => {
  serveApi(
    routes({
      "GET /actions/welcome-queue": () =>
        Response.json({ requiredActionCount: 0, members: [] }),
    }),
  );

  it("explains missing onboarding tasks without claiming nobody needs a welcome", async () => {
    renderPage();
    expect(
      await screen.findByText(
        "No active required onboarding tasks are configured.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("0 members need a welcome")).toBeNull();
    expect(screen.queryByText("No completions match this filter.")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

for (const status of [401, 500, 503]) {
  describe(`welcome queue HTTP ${status}`, () => {
    serveApi(
      routes({
        "GET /actions/welcome-queue": () =>
          Response.json(
            {
              statusCode: status,
              message:
                status === 401 ? "Unauthorized" : "Internal server error",
            },
            { status },
          ),
      }),
    );

    it("shows a useful error without rendering the queue", async () => {
      renderPage();
      expect(
        await screen.findByText(
          status === 401
            ? sessionExpiredMessage
            : "Unable to load members who need welcomes.",
        ),
      ).toBeTruthy();
      expect(screen.queryByRole("table")).toBeNull();
    });
  });
}

describe("welcome queue unreachable", () => {
  serveApi(
    routes({
      "GET /actions/welcome-queue": () => {
        throw new TypeError("Failed to fetch");
      },
    }),
  );

  it("shows the fallback without rendering the queue", async () => {
    renderPage();
    expect(
      await screen.findByText("Unable to load members who need welcomes."),
    ).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("welcome queue refetch failure", () => {
  let status = 200;
  serveApi(
    routes({
      "GET /actions/welcome-queue": () =>
        status === 200
          ? Response.json(queue)
          : Response.json({ statusCode: status }, { status }),
    }),
  );

  it("keeps the loaded queue beside the error", async () => {
    const query = queryWrapper();
    renderPage(query);
    await screen.findByRole("link", { name: "Second member" });

    status = 500;
    await act(() => query.client.refetchQueries());

    expect(
      await screen.findByText("Unable to load members who need welcomes."),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Second member" })).toBeTruthy();
  });
});
