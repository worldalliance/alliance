import type { ActionCompletionCurveDto } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { renderHook, waitFor } from "@testing-library/react";
import {
  invalidateActionCompletionCurvesAdmin,
  useActionCompletionCurvesAdmin,
} from "./useActionCompletionCurvesAdmin";

const curves: ActionCompletionCurveDto[] = [
  {
    actionId: 1,
    actionName: "Alpha",
    usersJoined: 10,
    memberActionStartDate: "2026-01-01T00:00:00.000Z",
    memberActionEndDate: "2026-01-08T00:00:00.000Z",
    bucketDays: 1,
    dayOffsets: [0, 1],
    completedCounts: [1, 2],
    completionFractions: [0.1, 0.2],
  },
];

let requested: URL | null;
let respond: () => Response;

serveApi(
  routes({
    "GET /analytics/action-completion-curves": ({ request }) => {
      requested = new URL(request.url);
      return respond();
    },
  }),
);

beforeEach(() => {
  requested = null;
  respond = () => Response.json(curves);
});

describe("useActionCompletionCurvesAdmin", () => {
  it("reads every action's curves at the requested granularity", async () => {
    const view = renderHook(
      () => useActionCompletionCurvesAdmin("daily"),
      queryWrapper(),
    );

    await waitFor(() => expect(view.result.current.data).toEqual(curves));
    expect(requested?.searchParams.get("granularity")).toBe("daily");
    expect(requested?.searchParams.has("actionId")).toBe(false);
  });

  it("surfaces a refused load as an error carrying its status", async () => {
    respond = () => Response.json({ message: "Forbidden" }, { status: 403 });

    const view = renderHook(
      () => useActionCompletionCurvesAdmin("hourly"),
      queryWrapper(),
    );

    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(view.result.current.error).toMatchObject({ statusCode: 403 });
  });
});

describe("invalidateActionCompletionCurvesAdmin", () => {
  it("invalidates the curves at every granularity", () => {
    const { client } = queryWrapper();
    client.setQueryData(queryKeys.actionCompletionCurvesAdmin("daily"), []);
    client.setQueryData(queryKeys.actionCompletionCurvesAdmin("hourly"), []);

    invalidateActionCompletionCurvesAdmin(client);

    for (const granularity of ["daily", "hourly"] as const) {
      expect(
        client.getQueryState(queryKeys.actionCompletionCurvesAdmin(granularity))
          ?.isInvalidated,
      ).toBe(true);
    }
  });
});
