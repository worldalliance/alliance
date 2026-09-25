import type { ActionStatsWithOnboardingDto } from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { pending, type Pending } from "@alliance/shared/lib/testing/pending";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useActionStats } from "./useActionStats";

afterEach(cleanup);

const stat = (usersCompleted: number) =>
  ({
    id: 1,
    actionId: 7,
    actionName: "Call your rep",
    usersCompleted,
    usersJoined: 10,
    usersWithdrawn: 0,
    usersDismissed: 0,
    completionRate: usersCompleted / 10,
    lastCalculatedAt: "2026-01-01T00:00:00.000Z",
    actionCompletedAt: null,
    showInChart: true,
    memberActionStartDate: null,
    memberActionEndDate: null,
    onboarding: false,
    optional: false,
  }) satisfies ActionStatsWithOnboardingDto;

let gets: Pending<Response>[] = [];

const api = serveApi(
  routes({
    "GET /analytics/action-stats": () => pending(gets),
    "POST /analytics/action-stats/recalculate": () => Response.json([stat(9)]),
  }),
);

afterEach(() => {
  gets = [];
});

const mount = () => {
  const { client, wrapper } = queryWrapper();
  const view = renderHook(() => useActionStats(), { wrapper });
  return { client, hook: () => view.result.current };
};

const answerGet = async (body: ActionStatsWithOnboardingDto[]) => {
  await waitFor(() => expect(gets).toHaveLength(1));
  const [next] = gets.splice(0, 1);
  if (!next) throw new Error("no action stats GET in flight");
  await act(async () => next.resolve(Response.json(body)));
};

describe("useActionStats", () => {
  it("keeps recalculated stats over a refetch that was already in flight", async () => {
    const { client, hook } = mount();
    await answerGet([stat(1)]);

    act(() => void hook().stats.refetch());
    await waitFor(() => expect(gets).toHaveLength(1));
    await act(() => hook().recalculate.mutateAsync());
    await answerGet([stat(1)]);

    expect(client.getQueryData(queryKeys.actionStatsAdmin())).toEqual([
      stat(9),
    ]);
  });

  it("invalidates the completion curves after a recalculation", async () => {
    const { client, hook } = mount();
    client.setQueryData(queryKeys.actionCompletionCurvesAdmin("hourly"), []);
    await answerGet([stat(1)]);

    await act(() => hook().recalculate.mutateAsync());

    expect(
      client.getQueryState(queryKeys.actionCompletionCurvesAdmin("hourly"))
        ?.isInvalidated,
    ).toBe(true);
  });

  it("reports a failed load", async () => {
    api.alsoServing({
      "GET /analytics/action-stats": () =>
        Response.json({ message: "boom" }, { status: 500 }),
    });
    const { hook } = mount();

    await waitFor(() => expect(hook().stats.isError).toBe(true));
  });

  it("reports a failed recalculation", async () => {
    api.alsoServing({
      "POST /analytics/action-stats/recalculate": () =>
        Response.json({ message: "boom" }, { status: 500 }),
    });
    const { hook } = mount();
    await answerGet([stat(1)]);

    await act(() =>
      hook()
        .recalculate.mutateAsync()
        .catch(() => {}),
    );

    await waitFor(() => expect(hook().recalculate.isError).toBe(true));
    expect(hook().stats.data).toEqual([stat(1)]);
  });
});
