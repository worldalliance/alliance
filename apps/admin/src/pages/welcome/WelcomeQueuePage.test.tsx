import type { WelcomeQueueDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import * as config from "@alliance/sharedweb/lib/config";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { sessionExpiredMessage } from "../../lib/sessionExpired";
import { LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import { ToastProvider } from "../../ui/ToastProvider";
import WelcomeQueuePage from "./WelcomeQueuePage";

afterEach(cleanup);

const renderPage = (query = queryWrapper(), url = "/members/welcome") => {
  const router = createMemoryRouter(
    [{ path: "/members/welcome", element: <WelcomeQueuePage /> }],
    { initialEntries: [url] },
  );
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
    query,
  );
  return router;
};

const MEMBER_NAME = /^(First|Second) member$/;

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
      name: /^Leave welcome comment/,
    });
    expect(
      links.map((link) => new URL(link.getAttribute("href")!).pathname),
    ).toEqual(["/actions/42/activity/102", "/actions/43/activity/101"]);

    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(
      rows.map(
        (row) =>
          within(row).getByRole("link", { name: MEMBER_NAME }).textContent,
      ),
    ).toEqual(["Second member", "First member"]);
  });
});

describe("staff liked filter", () => {
  serveApi(
    routes({
      "GET /actions/welcome-queue": () => Response.json(queue),
    }),
  );

  it("shows only completions a staff member liked, kept in the URL", async () => {
    const router = renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: "Staff liked (1)" }),
    );

    expect(router.state.location.search).toBe("?show=staff-liked");
    expect(
      screen
        .getAllByRole("link", { name: MEMBER_NAME })
        .map((l) => l.textContent),
    ).toEqual(["Second member"]);
  });
});

describe("staff liked filter with no match", () => {
  serveApi(
    routes({
      "GET /actions/welcome-queue": () =>
        Response.json({
          ...queue,
          members: queue.members.map((m) => ({ ...m, staffLikeCount: 0 })),
        }),
    }),
  );

  it("says nothing matches and clears the filter", async () => {
    const router = renderPage(
      queryWrapper(),
      "/members/welcome?show=staff-liked",
    );

    expect(await screen.findByText("No results")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(router.state.location.search).toBe("");
    expect(
      await screen.findByRole("link", { name: "First member" }),
    ).toBeTruthy();
  });
});

describe("empty welcome queue", () => {
  serveApi(
    routes({
      "GET /actions/welcome-queue": () =>
        Response.json({ requiredActionCount: 2, members: [] }),
    }),
  );

  it("says an empty queue is good news", async () => {
    renderPage();
    expect(
      await screen.findByText("No one is waiting for a welcome"),
    ).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("says so under the staff-liked filter too", async () => {
    renderPage(queryWrapper(), "/members/welcome?show=staff-liked");
    expect(
      await screen.findByText("No one is waiting for a welcome"),
    ).toBeTruthy();
    expect(screen.queryByText("No results")).toBeNull();
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
      await screen.findByText("No required onboarding tasks are open"),
    ).toBeTruthy();
    expect(screen.queryByText("No one is waiting for a welcome")).toBeNull();
    expect(screen.queryByText("No results")).toBeNull();
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
        await screen.findByText("Couldn't load the welcome queue"),
      ).toBeTruthy();
      expect(
        screen.getByText(
          status === 401 ? sessionExpiredMessage : LOAD_FAILED_FALLBACK,
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
      await screen.findByText("Couldn't load the welcome queue"),
    ).toBeTruthy();
    expect(screen.getByText(LOAD_FAILED_FALLBACK)).toBeTruthy();
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
      await screen.findByText(/Couldn't refresh the welcome queue\./),
    ).toBeTruthy();
    expect(screen.queryByText("Couldn't load the welcome queue")).toBeNull();
    expect(screen.getByRole("link", { name: "Second member" })).toBeTruthy();
  });
});
