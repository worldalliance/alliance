import type { ContractStatusPointDto } from "@alliance/shared/client";
import { type Pending, pending } from "@alliance/shared/lib/testing/pending";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useContractStatusHistoryAdmin } from "./useContractStatusHistoryAdmin";

afterEach(cleanup);

const history = (activeCount: number): ContractStatusPointDto[] => [
  { date: "2026-01-01", activeCount, churnedCount: 0, totalEverSigned: 0 },
];

const january = { start: "2026-01-01", end: "2026-01-15" };
const february = { start: "2026-02-01", end: "2026-02-15" };

let requested: URL | null;
let respond: () => Response | Promise<Response>;

serveApi(
  routes({
    "GET /analytics/contract-status-history": ({ request }) => {
      requested = new URL(request.url);
      return respond();
    },
  }),
);

beforeEach(() => {
  requested = null;
  respond = () => Response.json(history(1));
});

describe("useContractStatusHistoryAdmin", () => {
  it("reads the history for the range", async () => {
    const view = renderHook(
      () => useContractStatusHistoryAdmin(january),
      queryWrapper(),
    );

    await waitFor(() => expect(view.result.current.data).toEqual(history(1)));
    expect(requested?.searchParams.get("startDate")).toBe("2026-01-01");
    expect(requested?.searchParams.get("endDate")).toBe("2026-01-15");
  });

  it("keeps the previous range's history while the next one loads", async () => {
    const view = renderHook(
      (range: { start: string; end: string }) =>
        useContractStatusHistoryAdmin(range),
      { ...queryWrapper(), initialProps: january },
    );
    await waitFor(() => expect(view.result.current.data).toEqual(history(1)));

    const next: Pending<Response>[] = [];
    respond = () => pending(next);
    view.rerender(february);
    await waitFor(() => expect(next).toHaveLength(1));

    expect(view.result.current.data).toEqual(history(1));
    next[0].resolve(Response.json(history(2)));
    await waitFor(() => expect(view.result.current.data).toEqual(history(2)));
  });

  it("surfaces a refused load as an error carrying its status", async () => {
    respond = () => Response.json({ message: "Forbidden" }, { status: 403 });

    const view = renderHook(
      () => useContractStatusHistoryAdmin(january),
      queryWrapper(),
    );

    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(view.result.current.error).toMatchObject({ statusCode: 403 });
  });
});
