import { act, renderHook, waitFor } from "@testing-library/react";
import { activity } from "./testing/activity";
import { pending, type Pending } from "./testing/pending";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import useActivities, {
  ActivityList,
  useActivity,
  useLikeActivity,
  useRefreshActivities,
} from "./useActivities";

let communityRequests = 0;
let detailRequests = 0;
let detailResponses: Pending<Response>[] | null = null;
let likeResponses: Pending<Response>[] = [];

serveApi(
  routes({
    "GET /actions/communityActivity": () => {
      communityRequests += 1;
      return Response.json([activity(communityRequests)]);
    },
    "GET /actions/activities/:id": ({ params }) => {
      detailRequests += 1;
      if (detailResponses) return pending(detailResponses);
      return Response.json(activity(Number(params.id)));
    },
    "POST /actions/likeActivity/:id": () => pending(likeResponses),
  }),
);

beforeEach(() => {
  communityRequests = 0;
  detailRequests = 0;
  detailResponses = null;
  likeResponses = [];
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

it("useRefreshActivities refetches the list its props name", async () => {
  const { wrapper } = queryWrapper();
  const props = { list: ActivityList.Community, objectId: 4 } as const;
  const hook = renderHook(
    () => ({
      list: useActivities(props),
      refreshActivities: useRefreshActivities(),
    }),
    { wrapper },
  );
  await waitFor(() =>
    expect(hook.result.current.list.activities.map((a) => a.id)).toEqual([1]),
  );

  await act(() => hook.result.current.refreshActivities(props));

  await waitFor(() =>
    expect(hook.result.current.list.activities.map((a) => a.id)).toEqual([2]),
  );
});

const renderLikeable = () => {
  const { wrapper } = queryWrapper();
  return renderHook(
    () => ({
      list: useActivities({ list: ActivityList.Community, objectId: 4 }),
      likeActivity: useLikeActivity(),
    }),
    { wrapper },
  );
};

const likeState = (hook: ReturnType<typeof renderLikeable>) => {
  const [liked] = hook.result.current.list.activities;
  return { likedByMe: liked.likedByMe, likesCount: liked.likesCount };
};

it("useLikeActivity marks the like in cached lists, then takes the server's", async () => {
  const hook = renderLikeable();
  await waitFor(() =>
    expect(hook.result.current.list.activities).toHaveLength(1),
  );

  let liked!: Promise<unknown>;
  act(() => {
    liked = hook.result.current.likeActivity.mutateAsync({
      activityId: 1,
      isLiked: false,
    });
  });

  await waitFor(() =>
    expect(likeState(hook)).toEqual({ likedByMe: true, likesCount: 1 }),
  );
  await waitFor(() => expect(likeResponses).toHaveLength(1));
  likeResponses[0].resolve(
    Response.json({ likes: [], likesCount: 5, likedByMe: true }),
  );
  await act(() => liked);

  await waitFor(() =>
    expect(likeState(hook)).toEqual({ likedByMe: true, likesCount: 5 }),
  );
});

it("useLikeActivity rolls cached lists back when the like fails", async () => {
  const hook = renderLikeable();
  await waitFor(() =>
    expect(hook.result.current.list.activities).toHaveLength(1),
  );

  let liked!: Promise<unknown>;
  act(() => {
    liked = hook.result.current.likeActivity.mutateAsync({
      activityId: 1,
      isLiked: false,
    });
  });
  await waitFor(() => expect(likeResponses).toHaveLength(1));
  expect(likeState(hook)).toEqual({ likedByMe: true, likesCount: 1 });

  likeResponses[0].resolve(new Response(null, { status: 500 }));
  await act(() => expect(liked).rejects.toThrow());

  await waitFor(() =>
    expect(likeState(hook)).toEqual({ likedByMe: false, likesCount: 0 }),
  );
});

const renderDetail = () => {
  const { wrapper } = queryWrapper();
  return renderHook(
    () => ({ detail: useActivity(9), likeActivity: useLikeActivity() }),
    { wrapper },
  );
};

const detailLikeState = (hook: ReturnType<typeof renderDetail>) => {
  const { likedByMe, likesCount } = hook.result.current.detail.data!;
  return { likedByMe, likesCount };
};

it("useLikeActivity marks the like on a useActivity entry, then takes the server's", async () => {
  const hook = renderDetail();
  await waitFor(() => expect(hook.result.current.detail.data?.id).toBe(9));

  let liked!: Promise<unknown>;
  act(() => {
    liked = hook.result.current.likeActivity.mutateAsync({
      activityId: 9,
      isLiked: false,
    });
  });

  await waitFor(() =>
    expect(detailLikeState(hook)).toEqual({ likedByMe: true, likesCount: 1 }),
  );
  await waitFor(() => expect(likeResponses).toHaveLength(1));
  likeResponses[0].resolve(
    Response.json({ likes: [], likesCount: 5, likedByMe: true }),
  );
  await act(() => liked);

  await waitFor(() =>
    expect(detailLikeState(hook)).toEqual({ likedByMe: true, likesCount: 5 }),
  );
});

it("useLikeActivity rolls a useActivity entry back when the like fails", async () => {
  const hook = renderDetail();
  await waitFor(() => expect(hook.result.current.detail.data?.id).toBe(9));

  let liked!: Promise<unknown>;
  act(() => {
    liked = hook.result.current.likeActivity.mutateAsync({
      activityId: 9,
      isLiked: false,
    });
  });
  await waitFor(() => expect(likeResponses).toHaveLength(1));
  expect(detailLikeState(hook)).toEqual({ likedByMe: true, likesCount: 1 });

  likeResponses[0].resolve(new Response(null, { status: 500 }));
  await act(() => expect(liked).rejects.toThrow());

  await waitFor(() =>
    expect(detailLikeState(hook)).toEqual({ likedByMe: false, likesCount: 0 }),
  );
});

it("useActivity requests nothing for an id that isn't one", async () => {
  const { wrapper } = queryWrapper();
  const hook = renderHook(() => useActivity(NaN), { wrapper });

  await new Promise((resolve) => setTimeout(resolve, 50));

  expect(hook.result.current.fetchStatus).toBe("idle");
  expect(hook.result.current.data).toBeUndefined();
  expect(detailRequests).toBe(0);
});

it("useLikeActivity refetches a useActivity entry whose load the like cancelled", async () => {
  detailResponses = [];
  const hook = renderDetail();
  await waitFor(() => expect(detailResponses).toHaveLength(1));

  let liked!: Promise<unknown>;
  act(() => {
    liked = hook.result.current.likeActivity.mutateAsync({
      activityId: 9,
      isLiked: false,
    });
  });
  await waitFor(() => expect(likeResponses).toHaveLength(1));
  likeResponses[0].resolve(
    Response.json({ likes: [], likesCount: 1, likedByMe: true }),
  );
  await act(() => liked);

  await waitFor(() => expect(detailResponses).toHaveLength(2));
  detailResponses[1].resolve(
    Response.json({ ...activity(9), likesCount: 1, likedByMe: true }),
  );
  await waitFor(() =>
    expect(detailLikeState(hook)).toEqual({ likedByMe: true, likesCount: 1 }),
  );
});
