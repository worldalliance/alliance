import type {
  CreateAwayRangeDto,
  UpdateAwayRangeDto,
  UserAwayRangeDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { renderHook, waitFor } from "@testing-library/react";
import { useUserAwayRangesAdmin } from "./useUserAwayRangesAdmin";

const userId = 7;

const range = (
  id: number,
  startDate: string,
  endDate: string,
): UserAwayRangeDto => ({
  id,
  startDate,
  endDate,
  createdAt: "2026-01-01T00:00:00.000Z",
  reason: "vacation",
  note: null,
});

const later = range(2, "2026-03-01T00:00:00.000Z", "2026-03-05T00:00:00.000Z");
const earlier = range(
  1,
  "2026-02-01T00:00:00.000Z",
  "2026-02-05T00:00:00.000Z",
);

let stored: UserAwayRangeDto[];
let loadStatus: number;
let requestedUserIds: string[];

serveApi(
  routes({
    "GET /user/awayranges/:id": ({ params }) => {
      requestedUserIds.push(params.id);
      return loadStatus === 200
        ? Response.json(stored)
        : Response.json({ message: "Forbidden" }, { status: loadStatus });
    },
    "POST /user/admin/:userId/awayranges": async ({ request }) => {
      const body: CreateAwayRangeDto = await request.json();
      const created = range(3, body.startDay, body.endDay);
      stored = [...stored, created];
      return Response.json(created);
    },
    "PATCH /user/admin/:userId/awayranges/:id": async ({ request, params }) => {
      const body: UpdateAwayRangeDto = await request.json();
      const id = Number(params.id);
      stored = stored.map((r) =>
        r.id === id
          ? { ...r, reason: body.reason, note: body.note ?? null }
          : r,
      );
      return Response.json(stored.find((r) => r.id === id));
    },
    "DELETE /user/admin/:userId/awayranges/:id": ({ params }) => {
      const id = Number(params.id);
      if (!stored.some((r) => r.id === id)) {
        return Response.json(
          { message: "Away range not found." },
          { status: 404 },
        );
      }
      stored = stored.filter((r) => r.id !== id);
      return new Response(null, { status: 200 });
    },
  }),
);

beforeEach(() => {
  stored = [later, earlier];
  loadStatus = 200;
  requestedUserIds = [];
});

const renderLoaded = async () => {
  const query = queryWrapper();
  const view = renderHook(() => useUserAwayRangesAdmin(userId), query);
  await waitFor(() => expect(view.result.current.query.isSuccess).toBe(true));
  const cached = () =>
    query.client.getQueryData(queryKeys.userAwayRangesAdmin(userId));
  return { view, cached };
};

describe("useUserAwayRangesAdmin", () => {
  it("reads the user's away ranges in start order", async () => {
    const { view } = await renderLoaded();

    expect(requestedUserIds).toEqual([String(userId)]);
    expect(view.result.current.sortedAwayRanges).toEqual([earlier, later]);
  });

  it("surfaces a refused load as an error carrying its status", async () => {
    loadStatus = 403;

    const view = renderHook(
      () => useUserAwayRangesAdmin(userId),
      queryWrapper(),
    );

    await waitFor(() => expect(view.result.current.query.isError).toBe(true));
    expect(view.result.current.query.error).toMatchObject({ statusCode: 403 });
  });

  it("lists a created range once the create resolves", async () => {
    const { view, cached } = await renderLoaded();

    await view.result.current.createAwayRange.mutateAsync({
      startDay: "2026-04-01",
      endDay: "2026-04-03",
      reason: "vacation",
    });

    expect(cached()).toEqual([
      later,
      earlier,
      range(3, "2026-04-01", "2026-04-03"),
    ]);
  });

  it("lists an edited range once the update resolves", async () => {
    const { view, cached } = await renderLoaded();

    await view.result.current.updateAwayRange.mutateAsync({
      id: 1,
      body: { reason: "other", note: "Family" },
    });

    expect(cached()).toEqual([
      later,
      { ...earlier, reason: "other", note: "Family" },
    ]);
  });

  it("drops a deleted range once the delete resolves", async () => {
    const { view, cached } = await renderLoaded();

    await view.result.current.deleteAwayRange.mutateAsync(2);

    expect(cached()).toEqual([earlier]);
  });

  it("treats a range already deleted elsewhere as deleted", async () => {
    const { view, cached } = await renderLoaded();
    stored = [earlier];

    await view.result.current.deleteAwayRange.mutateAsync(2);

    expect(cached()).toEqual([earlier]);
  });
});
