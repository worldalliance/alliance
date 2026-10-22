import type { PlatformTenureCohortStatsDto } from "@alliance/shared/client";
import { type Pending, pending } from "@alliance/shared/lib/testing/pending";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { renderHook, waitFor } from "@testing-library/react";
import { usePlatformTenureCohortAdmin } from "./usePlatformTenureCohortAdmin";

const cohort = (weeksOnPlatform: number): PlatformTenureCohortStatsDto => ({
  weeksOnPlatform,
  cohortSize: 3,
  activeCount: 2,
  churnedCount: 1,
  churnRate: 1 / 3,
  assignedCount: 4,
  completedCount: 2,
  completionRate: 0.5,
  actions: [],
});

let requested: URL[];
let respond: (weeks: number) => Response | Promise<Response>;

serveApi(
  routes({
    "GET /analytics/platform-tenure-cohort": ({ request }) => {
      const url = new URL(request.url);
      requested.push(url);
      return respond(Number(url.searchParams.get("weeksOnPlatform")));
    },
  }),
);

beforeEach(() => {
  requested = [];
  respond = (weeks) => Response.json(cohort(weeks));
});

describe("usePlatformTenureCohortAdmin", () => {
  it("requests nothing until given a week count", async () => {
    const view = renderHook(
      () => usePlatformTenureCohortAdmin(null),
      queryWrapper(),
    );

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(requested).toEqual([]);
    expect(view.result.current.isFetching).toBe(false);
  });

  it("reads the cohort for the week count", async () => {
    const view = renderHook(
      () => usePlatformTenureCohortAdmin(4),
      queryWrapper(),
    );

    await waitFor(() => expect(view.result.current.data).toEqual(cohort(4)));
    expect(
      requested.map((url) => url.searchParams.get("weeksOnPlatform")),
    ).toEqual(["4"]);
  });

  it("keeps the previous cohort while the next one loads", async () => {
    const view = renderHook(
      (weeks: number) => usePlatformTenureCohortAdmin(weeks),
      { ...queryWrapper(), initialProps: 4 },
    );
    await waitFor(() => expect(view.result.current.data).toEqual(cohort(4)));

    const next: Pending<Response>[] = [];
    respond = () => pending(next);
    view.rerender(8);
    await waitFor(() => expect(next).toHaveLength(1));

    expect(view.result.current.data).toEqual(cohort(4));
    next[0].resolve(Response.json(cohort(8)));
    await waitFor(() => expect(view.result.current.data).toEqual(cohort(8)));
  });

  it("shows nothing from a failed week count while the next one loads", async () => {
    const view = renderHook(
      (weeks: number) => usePlatformTenureCohortAdmin(weeks),
      { ...queryWrapper(), initialProps: 4 },
    );
    await waitFor(() => expect(view.result.current.data).toEqual(cohort(4)));
    respond = () => Response.json({}, { status: 500 });
    void view.result.current.refetch();
    await waitFor(() => expect(view.result.current.isError).toBe(true));

    const next: Pending<Response>[] = [];
    respond = () => pending(next);
    view.rerender(8);
    await waitFor(() => expect(next).toHaveLength(1));

    expect(view.result.current.data).toBeUndefined();
  });

  it("surfaces a refused load as an error carrying its status", async () => {
    respond = () => Response.json({ message: "Forbidden" }, { status: 403 });

    const view = renderHook(
      () => usePlatformTenureCohortAdmin(4),
      queryWrapper(),
    );

    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(view.result.current.error).toMatchObject({ statusCode: 403 });
  });
});
