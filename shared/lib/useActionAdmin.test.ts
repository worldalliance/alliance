import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useActionAdmin } from "./useActionAdmin";

afterEach(cleanup);

let memberActionStart: string;
let fetches: number;

serveApi(
  routes({
    "GET /actions/adminslug/:id": () => {
      fetches += 1;
      return new Response(
        JSON.stringify({
          id: 1,
          events: [],
          cohortExpression: null,
          memberActionStart,
          memberActionDeadline: null,
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    },
  }),
);

beforeEach(() => {
  fetches = 0;
});

describe("useActionAdmin", () => {
  it("refetches after a child writes the action, so server-derived fields catch up", async () => {
    memberActionStart = "2026-01-01T00:00:00.000Z";
    const { result } = renderHook(() => useActionAdmin(1), queryWrapper());
    await waitFor(() => expect(result.current.action).toBeDefined());
    const action = result.current.action;
    if (!action) throw new Error("action not loaded");

    memberActionStart = "2026-02-01T00:00:00.000Z";
    act(() => result.current.setActionFromDto({ ...action, events: [] }));

    await waitFor(() =>
      expect(result.current.action?.memberActionStart).toBe(memberActionStart),
    );
    expect(fetches).toBe(2);
  });
});
