import { renderHook, waitFor } from "@testing-library/react";
import { activity } from "./testing/activity";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import useActivityFeeds, { FeedMode } from "./useActivityFeeds";

const queries = new Map<FeedMode, URLSearchParams>();

serveApi(
  routes({
    "GET /actions/friendActivity": ({ request }) => {
      queries.set(FeedMode.Friends, new URL(request.url).searchParams);
      return Response.json([activity(1)]);
    },
    "GET /actions/activities/feed": ({ request }) => {
      queries.set(FeedMode.Everyone, new URL(request.url).searchParams);
      return Response.json([activity(2)]);
    },
  }),
);

beforeEach(() => queries.clear());

it("reads each mode from its own list", async () => {
  const { wrapper } = queryWrapper();
  const hook = renderHook(() => useActivityFeeds(), { wrapper });

  const ids = (mode: FeedMode) =>
    hook.result.current[mode].activities.map((a) => a.id);

  await waitFor(() => {
    expect(ids(FeedMode.Friends)).toEqual([1]);
    expect(ids(FeedMode.Everyone)).toEqual([2]);
  });
});

it("loads both feeds with comments, 30 per page", async () => {
  const { wrapper } = queryWrapper();
  renderHook(() => useActivityFeeds(), { wrapper });

  await waitFor(() => expect(queries.size).toBe(2));
  for (const query of queries.values()) {
    expect(query.get("comments")).toBe("true");
    expect(query.get("limit")).toBe("30");
  }
});
