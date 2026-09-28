import { act, renderHook, waitFor } from "@testing-library/react";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import useActivities, { ActivityList } from "./useActivities";

let communityRequests = 0;

const activity = (id: number) => ({
  id,
  type: "user_completed",
  createdAt: "2026-01-01T00:00:00.000Z",
  likedByMe: false,
  likesCount: 0,
  likes: [],
});

serveApi(
  routes({
    "GET /actions/communityActivity": () => {
      communityRequests += 1;
      return Response.json([activity(communityRequests)]);
    },
  }),
);

beforeEach(() => {
  communityRequests = 0;
});

it("refresh refetches the list", async () => {
  const { wrapper } = queryWrapper();
  const hook = renderHook(
    () => useActivities({ list: ActivityList.Community, objectId: 4 }),
    { wrapper },
  );
  await waitFor(() =>
    expect(hook.result.current.activities.map((a) => a.id)).toEqual([1]),
  );

  await act(() => hook.result.current.refresh());

  await waitFor(() =>
    expect(hook.result.current.activities.map((a) => a.id)).toEqual([2]),
  );
});
