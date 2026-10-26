import type { MemberReliabilityWindowDto } from "@alliance/shared/client";
import { type Pending, pending } from "@alliance/shared/lib/testing/pending";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { renderHook, waitFor } from "@testing-library/react";
import { useMemberReliabilityWindowAdmin } from "./useMemberReliabilityWindowAdmin";

const reliability = (weeks: number): MemberReliabilityWindowDto => ({
  weeks,
  firstWeek: { assignedCount: 8, completedCount: 6, completionRate: 0.75 },
  fourthWeekOrLater: {
    assignedCount: 10,
    completedCount: 9,
    completionRate: 0.9,
  },
});

let requested: URL[];
let respond: (weeks: number) => Response | Promise<Response>;

serveApi(
  routes({
    "GET /analytics/member-reliability-window": ({ request }) => {
      const url = new URL(request.url);
      requested.push(url);
      return respond(Number(url.searchParams.get("weeks")));
    },
  }),
);

beforeEach(() => {
  requested = [];
  respond = (weeks) => Response.json(reliability(weeks));
});

describe("useMemberReliabilityWindowAdmin", () => {
  it("requests nothing until given a week count", async () => {
    const view = renderHook(
      () => useMemberReliabilityWindowAdmin(null),
      queryWrapper(),
    );

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(requested).toEqual([]);
    expect(view.result.current.isFetching).toBe(false);
  });

  it("reads the window for the week count", async () => {
    const view = renderHook(
      () => useMemberReliabilityWindowAdmin(5),
      queryWrapper(),
    );

    await waitFor(() =>
      expect(view.result.current.data).toEqual(reliability(5)),
    );
    expect(requested.map((url) => url.searchParams.get("weeks"))).toEqual([
      "5",
    ]);
  });

  it("keeps the previous window while the next one loads", async () => {
    const view = renderHook(
      (weeks: number) => useMemberReliabilityWindowAdmin(weeks),
      { ...queryWrapper(), initialProps: 5 },
    );
    await waitFor(() =>
      expect(view.result.current.data).toEqual(reliability(5)),
    );

    const next: Pending<Response>[] = [];
    respond = () => pending(next);
    view.rerender(8);
    await waitFor(() => expect(next).toHaveLength(1));

    expect(view.result.current.data).toEqual(reliability(5));
    next[0].resolve(Response.json(reliability(8)));
    await waitFor(() =>
      expect(view.result.current.data).toEqual(reliability(8)),
    );
  });

  it("shows nothing from a failed week count while the next one loads", async () => {
    const view = renderHook(
      (weeks: number) => useMemberReliabilityWindowAdmin(weeks),
      { ...queryWrapper(), initialProps: 5 },
    );
    await waitFor(() =>
      expect(view.result.current.data).toEqual(reliability(5)),
    );
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
      () => useMemberReliabilityWindowAdmin(5),
      queryWrapper(),
    );

    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(view.result.current.error).toMatchObject({ statusCode: 403 });
  });
});
