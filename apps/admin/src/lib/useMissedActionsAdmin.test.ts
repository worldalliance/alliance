import { retryUnlessRefused } from "@alliance/shared/lib/retryQuery";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useMissedActionsAdmin } from "./useMissedActionsAdmin";

const missedActions = {
  missedLastAction: [
    { userId: 7, name: "Ada Member", lastActionName: "Call a rep" },
  ],
  missedLastTwoActions: [],
};

let status: number;
let requests: number;

serveApi(
  routes({
    "GET /analytics/missed-actions": () => {
      requests += 1;
      return status === 200
        ? Response.json(missedActions)
        : Response.json({ message: "Forbidden" }, { status });
    },
  }),
);

beforeEach(() => {
  status = 200;
  requests = 0;
});

describe("useMissedActionsAdmin", () => {
  it("loads nothing until enabled, then reads the missed actions", async () => {
    const view = renderHook(
      ({ enabled }) => useMissedActionsAdmin({ enabled }),
      { ...queryWrapper(), initialProps: { enabled: false } },
    );
    expect(view.result.current.fetchStatus).toBe("idle");

    view.rerender({ enabled: true });

    await waitFor(() =>
      expect(view.result.current.data).toEqual(missedActions),
    );
    expect(requests).toBe(1);
  });

  it("reloads only when asked, not on refocus or reconnect", async () => {
    const view = renderHook(
      () => useMissedActionsAdmin({ enabled: true }),
      queryWrapper(),
    );
    await waitFor(() => expect(view.result.current.isSuccess).toBe(true));

    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(requests).toBe(1);

    await act(() => view.result.current.refetch());
    expect(requests).toBe(2);
  });

  it("sends one request when a load fails, despite the admin retry default", async () => {
    status = 500;

    const view = renderHook(
      () => useMissedActionsAdmin({ enabled: true }),
      queryWrapper({ retry: retryUnlessRefused(3), retryDelay: 0 }),
    );

    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(requests).toBe(1);
  });

  it("surfaces a refused load as an error carrying its status", async () => {
    status = 403;

    const view = renderHook(
      () => useMissedActionsAdmin({ enabled: true }),
      queryWrapper(),
    );

    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(view.result.current.error).toMatchObject({ statusCode: 403 });
  });
});
