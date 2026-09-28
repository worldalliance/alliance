import type { CohortDecisionDto } from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useCohortDecisionsAdmin } from "./useCohortDecisionsAdmin";

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

serveApi(
  routes({
    "GET /cohort-decisions/action/7": () => Response.json([decision(true)]),
  }),
);

describe("useCohortDecisionsAdmin", () => {
  it("loads the action's cohort decisions", async () => {
    const view = renderHook(() => useCohortDecisionsAdmin(7), queryWrapper());

    await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
    expect(view.result.current.data).toEqual([decision(true)]);
  });
});
