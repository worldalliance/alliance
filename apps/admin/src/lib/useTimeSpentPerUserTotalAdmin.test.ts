import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { renderHook, waitFor } from "@testing-library/react";
import { useTimeSpentPerUserTotalAdmin } from "./useTimeSpentPerUserTotalAdmin";

let status: number;

serveApi(
  routes({
    "GET /analytics/time-spent-per-user-total": () =>
      status === 200
        ? Response.json([
            { userId: 1, timeSpent: 90 },
            { userId: 2, timeSpent: 0 },
          ])
        : Response.json({ message: "Forbidden" }, { status }),
  }),
);

beforeEach(() => {
  status = 200;
});

describe("useTimeSpentPerUserTotalAdmin", () => {
  it("reads each member's all-time time spent by user id", async () => {
    const view = renderHook(
      () => useTimeSpentPerUserTotalAdmin(),
      queryWrapper(),
    );

    await waitFor(() =>
      expect(view.result.current.data).toEqual({ 1: 90, 2: 0 }),
    );
  });

  it("surfaces a refused load as an error carrying its status", async () => {
    status = 403;

    const view = renderHook(
      () => useTimeSpentPerUserTotalAdmin(),
      queryWrapper(),
    );

    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(view.result.current.error).toMatchObject({ statusCode: 403 });
  });
});
