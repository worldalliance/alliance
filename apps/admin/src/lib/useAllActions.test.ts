import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
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
    const view = renderHook(() => useAllActions(), queryWrapper());

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
    const view = renderHook(() => useAllActions(), queryWrapper());

    await waitFor(() =>
      expect(view.result.current.allActionsLoading).toBe(false),
    );
    expect(view.result.current.allActionsLoadFailed).toBe(true);
  });

  it("keeps the loaded actions when a refetch fails", async () => {
    const query = queryWrapper();
    const view = renderHook(() => useAllActions(), query);
    await waitFor(() =>
      expect(view.result.current.allActionsLoading).toBe(false),
    );

    api.alsoServing({
      "GET /actions/all": () =>
        Response.json({ message: "boom" }, { status: 500 }),
    });
    await act(() => query.client.refetchQueries());
    await waitFor(() =>
      expect(
        query.client.getQueryState(queryKeys.actionsAllAdmin())?.status,
      ).toBe("error"),
    );

    expect(view.result.current.allActionsLoadFailed).toBe(false);
    expect(view.result.current.allActions).toHaveLength(1);
  });
});
