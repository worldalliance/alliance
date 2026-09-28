import type {
  CohortDecisionDto,
  CorrectCohortDecisionDto,
} from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  useCohortDecisionsAdmin,
  useCorrectCohortDecisionAdmin,
} from "./useCohortDecisionsAdmin";

afterEach(cleanup);

const decision = (included: boolean) =>
  ({
    userId: 5,
    included,
    reason: "launch",
    resolvedAt: "2026-01-01T00:00:00.000Z",
    userName: "Test Member",
    corrections: [],
  }) satisfies CohortDecisionDto;

let stored: CohortDecisionDto = decision(true);
let corrections: CorrectCohortDecisionDto[] = [];

const api = serveApi(
  routes({
    "GET /cohort-decisions/action/7": () => Response.json([stored]),
    "POST /cohort-decisions/action/7/user/5/correction": async ({
      request,
    }) => {
      const body: CorrectCohortDecisionDto = await request.json();
      corrections.push(body);
      stored = decision(body.included);
      return Response.json(stored);
    },
  }),
);

afterEach(() => {
  stored = decision(true);
  corrections = [];
});

describe("useCohortDecisionsAdmin", () => {
  it("loads the action's cohort decisions", async () => {
    const view = renderHook(() => useCohortDecisionsAdmin(7), queryWrapper());

    await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
    expect(view.result.current.data).toEqual([decision(true)]);
  });
});

describe("useCorrectCohortDecisionAdmin", () => {
  it("refetches the decisions before reporting success", async () => {
    const { client, wrapper } = queryWrapper();
    const seenOnSuccess: unknown[] = [];
    const view = renderHook(
      () => {
        const list = useCohortDecisionsAdmin(7);
        const correct = useCorrectCohortDecisionAdmin({
          actionId: 7,
          onSuccess: () =>
            seenOnSuccess.push(
              client.getQueryData(queryKeys.actionCohortDecisionsAdmin(7)),
            ),
        });
        return { list, correct };
      },
      { wrapper },
    );
    await waitFor(() => expect(view.result.current.list.isSuccess).toBe(true));

    await act(() =>
      view.result.current.correct.mutateAsync({
        userId: 5,
        included: false,
        note: "Signed up late",
      }),
    );

    expect(corrections).toEqual([{ included: false, note: "Signed up late" }]);
    expect(seenOnSuccess).toEqual([[decision(false)]]);
    await waitFor(() =>
      expect(view.result.current.list.data).toEqual([decision(false)]),
    );
  });

  it("reports a rejected correction without calling onSuccess", async () => {
    api.alsoServing({
      "POST /cohort-decisions/action/7/user/5/correction": () =>
        Response.json({ message: "nope" }, { status: 400 }),
    });
    let succeeded = false;
    const view = renderHook(
      () =>
        useCorrectCohortDecisionAdmin({
          actionId: 7,
          onSuccess: () => {
            succeeded = true;
          },
        }),
      queryWrapper(),
    );

    await act(() =>
      view.result.current
        .mutateAsync({ userId: 5, included: false, note: "Signed up late" })
        .catch(() => {}),
    );

    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(succeeded).toBe(false);
  });
});
