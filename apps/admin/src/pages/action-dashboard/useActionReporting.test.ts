import type { ActionStatus } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  makeEvent,
  makeFormResponse,
  makeProfile,
} from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useActionReporting } from "./useActionReporting";

afterEach(cleanup);

const stats = (actionId: number) => ({ actionId, usersWithdrawn: actionId });

let loads: string[];
let statsServed: string[];
let statsGates: Map<string, Promise<void>>;

const api = serveApi(
  routes({
    "GET /analytics/action-stats/:actionId": async ({ params, request }) => {
      loads.push(new URL(request.url).pathname);
      await statsGates.get(params.actionId);
      statsServed.push(params.actionId);
      return Response.json(stats(Number(params.actionId)));
    },
    "GET /actions/shareUrlStats/:actionId": ({ request }) => {
      loads.push(new URL(request.url).pathname);
      return Response.json([
        { user: makeProfile(4), inviteCount: 2, sid: "s", yesCount: 1 },
      ]);
    },
    "GET /actions/:id/incomplete-users": ({ request }) => {
      loads.push(new URL(request.url).pathname);
      return Response.json([makeProfile(5)]);
    },
    "GET /tasks/slug/:id": ({ params }) =>
      Response.json({ id: Number(params.id), title: "Form", schema: {} }),
    "GET /tasks/responses/:id": () => Response.json([makeFormResponse()]),
  }),
);

beforeEach(() => {
  loads = [];
  statsServed = [];
  statsGates = new Map();
});

const started: NonNullable<Parameters<typeof useActionReporting>[0]> = {
  publicOnly: false,
  optional: false,
  status: "member_action",
  events: [makeEvent()],
};

describe("useActionReporting", () => {
  it("keeps the current action's stats when an earlier action's arrive late", async () => {
    let release = () => {};
    statsGates.set("1", new Promise<void>((resolve) => (release = resolve)));
    const view = renderHook(
      ({ actionId }) => useActionReporting(started, actionId),
      { ...queryWrapper(), initialProps: { actionId: 1 } },
    );
    await waitFor(() => expect(loads).toContain("/analytics/action-stats/1"));

    view.rerender({ actionId: 2 });
    await waitFor(() =>
      expect(view.result.current.actionStats).toMatchObject({ actionId: 2 }),
    );
    release();
    await waitFor(() => expect(statsServed).toContain("1"));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(view.result.current.actionStats).toMatchObject({ actionId: 2 });
  });

  it("loads invite stats only for a public-only action", async () => {
    const view = renderHook(
      ({ publicOnly }) => useActionReporting({ ...started, publicOnly }, 3),
      { ...queryWrapper(), initialProps: { publicOnly: false } },
    );
    await waitFor(() => expect(view.result.current.actionStats).not.toBeNull());
    expect(view.result.current.shareUrlStats).toEqual([]);
    expect(loads).not.toContain("/actions/shareUrlStats/3");

    view.rerender({ publicOnly: true });

    await waitFor(() =>
      expect(view.result.current.shareUrlStats).toHaveLength(1),
    );

    view.rerender({ publicOnly: false });

    expect(view.result.current.shareUrlStats).toEqual([]);
  });

  it("lists users who failed to complete only once the action is done", async () => {
    const initialProps: { status: ActionStatus } = {
      status: "member_action",
    };
    const view = renderHook(
      ({ status }) => useActionReporting({ ...started, status }, 3),
      {
        ...queryWrapper(),
        initialProps,
      },
    );
    await waitFor(() => expect(view.result.current.actionStats).not.toBeNull());
    expect(loads).not.toContain("/actions/3/incomplete-users");

    view.rerender({ status: "completed" });

    await waitFor(() =>
      expect(view.result.current.incompleteUsers).toEqual([makeProfile(5)]),
    );

    view.rerender({ status: "member_action" });

    expect(view.result.current.incompleteUsers).toEqual([]);
  });

  it("lists no users who failed to complete an optional action", async () => {
    const view = renderHook(
      () =>
        useActionReporting(
          { ...started, status: "completed", optional: true },
          3,
        ),
      queryWrapper(),
    );

    await waitFor(() => expect(view.result.current.actionStats).not.toBeNull());
    expect(loads).not.toContain("/actions/3/incomplete-users");
    expect(view.result.current.incompleteUsers).toEqual([]);
  });

  it("loads the task form and its responses", async () => {
    const view = renderHook(
      () => useActionReporting({ ...started, taskFormId: 7 }, 3),
      queryWrapper(),
    );

    await waitFor(() => {
      expect(view.result.current.taskForm).toMatchObject({ id: 7 });
      expect(view.result.current.formResponses).toEqual([makeFormResponse()]);
    });
  });

  it("keeps a failed refetch out of the banner while the stats stay on screen", async () => {
    const query = queryWrapper();
    const view = renderHook(() => useActionReporting(started, 3), query);
    await waitFor(() => expect(view.result.current.actionStats).not.toBeNull());
    api.alsoServing({
      "GET /analytics/action-stats/:actionId": () =>
        Response.json({}, { status: 500 }),
    });

    await query.client.refetchQueries();
    await waitFor(() =>
      expect(
        query.client.getQueryState(queryKeys.actionStatsByIdAdmin(3))?.status,
      ).toBe("error"),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(view.result.current.actionStats).toMatchObject({ actionId: 3 });
    expect(view.result.current.failedLoads).toEqual([]);
  });

  it("drops a failed load from the banner once its section no longer shows", async () => {
    api.alsoServing({
      "GET /actions/shareUrlStats/:actionId": () =>
        Response.json({}, { status: 500 }),
    });
    const view = renderHook(
      ({ publicOnly }) => useActionReporting({ ...started, publicOnly }, 3),
      { ...queryWrapper(), initialProps: { publicOnly: true } },
    );
    await waitFor(() =>
      expect(view.result.current.failedLoads).toEqual(["invite stats"]),
    );

    view.rerender({ publicOnly: false });

    expect(view.result.current.failedLoads).toEqual([]);
  });

  it("names every load that failed", async () => {
    api.alsoServing({
      "GET /analytics/action-stats/:actionId": () =>
        Response.json({}, { status: 500 }),
      "GET /tasks/responses/:id": () => Response.json({}, { status: 403 }),
    });

    const view = renderHook(
      () => useActionReporting({ ...started, taskFormId: 7 }, 3),
      queryWrapper(),
    );

    await waitFor(() =>
      expect(view.result.current.failedLoads).toEqual([
        "withdrawn count",
        "form responses",
      ]),
    );
  });

  it.each([
    {
      route: "GET /analytics/action-stats/:actionId",
      action: { ...started, optional: true },
      named: "withdrawn and dismissed counts",
    },
    {
      route: "GET /tasks/slug/:id",
      action: { ...started, taskFormId: 7 },
      named: "form responses",
    },
    {
      route: "GET /actions/:id/incomplete-users",
      action: { ...started, status: "completed" as const },
      named: "users who failed to complete",
    },
  ])("names $named when $route fails", async ({ route, action, named }) => {
    api.alsoServing({ [route]: () => Response.json({}, { status: 500 }) });

    const view = renderHook(
      () => useActionReporting(action, 3),
      queryWrapper(),
    );

    await waitFor(() =>
      expect(view.result.current.failedLoads).toEqual([named]),
    );
  });

  it("loads neither stats nor responses before the member action starts", async () => {
    const view = renderHook(
      () =>
        useActionReporting(
          { ...started, status: "planned", events: [], taskFormId: 7 },
          3,
        ),
      queryWrapper(),
    );

    await waitFor(() =>
      expect(view.result.current.taskForm).toMatchObject({ id: 7 }),
    );
    expect(view.result.current.actionStats).toBeNull();
    expect(view.result.current.formResponses).toEqual([]);
    expect(loads).not.toContain("/analytics/action-stats/3");
  });
});
