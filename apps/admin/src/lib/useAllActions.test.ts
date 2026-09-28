import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useAllActions } from "./useAllActions";

afterEach(cleanup);

const api = serveApi(
  routes({
    "GET /actions/all": () =>
      Response.json([
        {
          id: 1,
          name: "Call your rep",
          usersCompleted: 3,
          taskFormId: 10,
          variantFormIds: [11],
          onboarding: false,
          memberActionDeadline: null,
        },
      ]),
  }),
);

describe("useAllActions", () => {
  it("loads every action as a referenced action", async () => {
    const view = renderHook(() => useAllActions());

    await waitFor(() =>
      expect(view.result.current.allActionsLoading).toBe(false),
    );
    expect(view.result.current).toEqual({
      allActions: [
        {
          id: 1,
          name: "Call your rep",
          usersCompleted: 3,
          formIds: [10, 11],
          onboarding: false,
          deadline: null,
        },
      ],
      allActionsLoading: false,
      allActionsLoadFailed: false,
    });
  });

  it("reports a failed load", async () => {
    api.alsoServing({
      "GET /actions/all": () =>
        Response.json({ message: "boom" }, { status: 500 }),
    });
    const view = renderHook(() => useAllActions());

    await waitFor(() =>
      expect(view.result.current.allActionsLoading).toBe(false),
    );
    expect(view.result.current.allActionsLoadFailed).toBe(true);
  });
});
