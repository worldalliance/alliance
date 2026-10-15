import type { DailyStatsDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useDailyStatsAdmin } from "./useDailyStatsAdmin";

afterEach(cleanup);

const day = (id: number, date: string): DailyStatsDto => ({
  id,
  dayId: date.slice(0, 10),
  date,
  signedMembers: 0,
  suspendedMembers: 0,
  actionsCompleted: 0,
  anonFormSubmissions: 0,
  invitesCreated: 0,
  invitesAccepted: 0,
});

let requested: URL | null;
let respond: () => Response;

serveApi(
  routes({
    "GET /analytics/daily-stats": ({ request }) => {
      requested = new URL(request.url);
      return respond();
    },
  }),
);

beforeEach(() => {
  requested = null;
  respond = () =>
    Response.json([
      day(2, "2026-01-03T00:00:00.000Z"),
      day(1, "2026-01-02T00:00:00.000Z"),
    ]);
});

describe("useDailyStatsAdmin", () => {
  it("reads the range's days in date order", async () => {
    const view = renderHook(
      () => useDailyStatsAdmin({ start: "2026-01-02", end: "2026-01-03" }),
      queryWrapper(),
    );

    await waitFor(() =>
      expect(view.result.current.data?.map((d) => d.id)).toEqual([1, 2]),
    );
    expect(requested?.searchParams.get("date")).toBe(
      "2026-01-02T00:00:00.000Z",
    );
    expect(requested?.searchParams.get("endDate")).toBe(
      "2026-01-03T00:00:00.000Z",
    );
  });

  it("surfaces a refused load as an error carrying its status", async () => {
    respond = () => Response.json({ message: "Forbidden" }, { status: 403 });

    const view = renderHook(
      () => useDailyStatsAdmin({ start: "2026-01-02", end: "2026-01-03" }),
      queryWrapper(),
    );

    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(view.result.current.error).toMatchObject({ statusCode: 403 });
  });
});
