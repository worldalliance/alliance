import { act, renderHook, waitFor } from "@testing-library/react";
import type { HomeFeedItemDto } from "../client";
import { activityStore } from "./activityStore";
import { endSession } from "./sessionStores";
import {
  makeActivity,
  makeComment,
  makeFeedForumComment,
} from "./testFixtures";
import { held, pending, type Pending } from "./testing/pending";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import useActivities, { ActivityList, useActivity } from "./useActivities";
import { useLikeActivity } from "./useFeedLikes";
import useHomeFeed from "./useHomeFeed";
import { meCache } from "./useMe";
import useUserFeed from "./useUserFeed";

const makeFormResponseOutput = () => ({
  id: 60,
  formId: 1,
  answers: {},
  publicAnswers: {},
  deviceType: null,
  schemaSnapshot: {},
  visibilityValidatorResults: {},
});
const comment = makeComment({ id: 70, parentObjectType: "activity" });
const forumComment = makeFeedForumComment({
  comment: makeComment({ id: 80 }),
});
const activityItem = (
  overrides: Parameters<typeof makeActivity>[0] = {},
): HomeFeedItemDto => ({
  type: "activity",
  date: "2026-01-02T00:00:00.000Z",
  activity: makeActivity({ id: 1, ...overrides }),
});
const forumCommentItem: HomeFeedItemDto = {
  type: "forum_comment",
  date: "2026-01-01T00:00:00.000Z",
  forumComment,
};

let homeFeed: () => Promise<Response>;
let community: () => Promise<Response>;
let detail: () => Promise<Response>;
let likes: Pending<Response>[];
let commentLikes: Pending<Response>[];

serveApi(
  routes({
    "GET /actions/homeFeed": () => homeFeed(),
    "GET /actions/userFeed/:id": () =>
      Response.json([activityItem(), forumCommentItem]),
    "GET /actions/communityActivity": () => community(),
    "GET /actions/activities/:id": () => detail(),
    "POST /actions/likeActivity/:id": () => pending(likes),
    "POST /actions/unlikeActivity/:id": () => pending(likes),
    "POST /forum/comments/:id/like": () => pending(commentLikes),
    "POST /forum/comments/:id/unlike": () => pending(commentLikes),
  }),
);

beforeEach(() => {
  homeFeed = async () => Response.json([activityItem(), forumCommentItem]);
  community = async () => Response.json([makeActivity({ id: 1 })]);
  detail = async () => Response.json(makeActivity({ id: 1 }));
  likes = [];
  commentLikes = [];
});

const likeAnswer = (likesCount: number, likedByMe: boolean) =>
  Response.json(makeActivity({ id: 1, likesCount, likedByMe }));

const renderSurfaces = () => {
  const query = queryWrapper();
  const hook = renderHook(
    () => ({
      home: useHomeFeed({ comments: true }),
      list: useActivities({ list: ActivityList.Community, objectId: 4 }),
      detail: useActivity(1),
      like: useLikeActivity(),
    }),
    { wrapper: query.wrapper },
  );
  return { ...query, hook };
};

const loaded = async (hook: ReturnType<typeof renderSurfaces>["hook"]) =>
  waitFor(() => {
    expect(hook.result.current.home.items).toHaveLength(2);
    expect(hook.result.current.list.activities).toHaveLength(1);
    expect(hook.result.current.detail.data).toBeDefined();
  });

const likeStates = (hook: ReturnType<typeof renderSurfaces>["hook"]) => {
  const { home, list, detail } = hook.result.current;
  return [home.items[0].activity, list.activities[0], detail.data].map(
    (activity) => [activity?.likedByMe, activity?.likesCount],
  );
};

it("shows a like from a home feed card in an activity list and on the detail", async () => {
  const { hook } = renderSurfaces();
  await loaded(hook);

  let liked!: Promise<void>;
  act(() => {
    liked = hook.result.current.home.handleLikeActivity(1);
  });
  await waitFor(() => expect(likes).toHaveLength(1));
  expect(likeStates(hook)).toEqual([
    [true, 1],
    [true, 1],
    [true, 1],
  ]);

  likes[0].resolve(likeAnswer(5, true));
  await act(() => liked);
  expect(likeStates(hook)).toEqual([
    [true, 5],
    [true, 5],
    [true, 5],
  ]);
});

it("takes a refused like back everywhere", async () => {
  const { hook } = renderSurfaces();
  await loaded(hook);

  let liked!: Promise<void>;
  act(() => {
    liked = hook.result.current.list.handleLikeActivity(1);
  });
  await waitFor(() => expect(likes).toHaveLength(1));
  likes[0].resolve(new Response(null, { status: 500 }));
  await act(() => expect(liked).rejects.toThrow());

  expect(likeStates(hook)).toEqual([
    [false, 0],
    [false, 0],
    [false, 0],
  ]);
});

it("keeps the comments a feed loaded when a list without comments loads later", async () => {
  homeFeed = async () =>
    Response.json([activityItem({ comments: [comment] }), forumCommentItem]);
  community = async () =>
    Response.json([makeActivity({ id: 1, likesCount: 3 })]);
  const { hook } = renderSurfaces();
  await loaded(hook);

  await act(() => hook.result.current.list.refresh());

  const [activity] = hook.result.current.list.activities;
  expect(activity.likesCount).toBe(3);
  expect(activity.comments.map(({ id }) => id)).toEqual([70]);
  expect(hook.result.current.home.items[0].activity?.comments).toHaveLength(1);
});

it("keeps a feed's form output when a list without it loads later", async () => {
  homeFeed = async () =>
    Response.json([
      activityItem({ formResponseOutput: makeFormResponseOutput() }),
    ]);
  const { wrapper } = queryWrapper();
  const home = renderHook(() => useHomeFeed(), { wrapper });
  await waitFor(() => expect(home.result.current.items).toHaveLength(1));
  const list = renderHook(
    () => useActivities({ list: ActivityList.Community, objectId: 4 }),
    { wrapper },
  );
  await waitFor(() => expect(list.result.current.activities).toHaveLength(1));

  expect(list.result.current.activities[0].formResponseOutput?.id).toBe(60);
  expect(home.result.current.items[0].activity?.formResponseOutput?.id).toBe(
    60,
  );
});

it("shows a record a list loaded while the detail's own request is out", async () => {
  const { wrapper } = queryWrapper();
  community = async () =>
    Response.json([makeActivity({ id: 1, likesCount: 7 })]);
  const list = renderHook(
    () => useActivities({ list: ActivityList.Community, objectId: 4 }),
    { wrapper },
  );
  await waitFor(() => expect(list.result.current.activities).toHaveLength(1));
  const response = held();
  detail = () => response.until(Response.json(makeActivity({ id: 1 })));

  const shown = renderHook(() => useActivity(1), { wrapper });

  expect(shown.result.current.isPlaceholderData).toBe(true);
  expect(shown.result.current.data?.likesCount).toBe(7);
  response.release();
  await waitFor(() =>
    expect(shown.result.current.isPlaceholderData).toBe(false),
  );
});

it("keeps a newer response over an older one that lands later", async () => {
  const { client, wrapper } = queryWrapper();
  const older = held();
  homeFeed = () =>
    older.until(Response.json([activityItem({ likesCount: 1 })]));
  const home = renderHook(() => useHomeFeed(), { wrapper });
  await waitFor(() => expect(home.result.current.loading).toBe(true));

  community = async () =>
    Response.json([makeActivity({ id: 1, likesCount: 2 })]);
  const list = renderHook(
    () => useActivities({ list: ActivityList.Community, objectId: 4 }),
    { wrapper },
  );
  await waitFor(() => expect(list.result.current.activities).toHaveLength(1));
  older.release();
  await waitFor(() => expect(home.result.current.items).toHaveLength(1));

  expect(activityStore(client).getActivity(1)?.likesCount).toBe(2);
  expect(home.result.current.items[0].activity?.likesCount).toBe(2);
});

it("keeps a like made while a feed loads in the page it loads", async () => {
  const { client, hook } = renderSurfaces();
  await loaded(hook);
  const stale = held();
  homeFeed = () =>
    stale.until(Response.json([activityItem(), forumCommentItem]));
  const reloading = client.refetchQueries({ queryKey: ["useHomeFeed"] });

  let liked!: Promise<void>;
  act(() => {
    liked = hook.result.current.like(1);
  });
  await waitFor(() => expect(likes).toHaveLength(1));
  stale.release();
  await act(() => reloading);

  expect(likeStates(hook)).toEqual([
    [true, 1],
    [true, 1],
    [true, 1],
  ]);
  likes[0].resolve(likeAnswer(1, true));
  await act(() => liked);
});

it("keeps an unanswered like in a feed load that starts after it", async () => {
  const { client, hook } = renderSurfaces();
  await loaded(hook);

  let liked!: Promise<void>;
  act(() => {
    liked = hook.result.current.like(1);
  });
  await waitFor(() => expect(likes).toHaveLength(1));
  await act(() => client.refetchQueries({ queryKey: ["useHomeFeed"] }));

  expect(likeStates(hook)[0]).toEqual([true, 1]);
  likes[0].resolve(likeAnswer(1, true));
  await act(() => liked);
});

it("leaves a later unlike when an earlier like answers after it", async () => {
  const { hook } = renderSurfaces();
  await loaded(hook);

  let first!: Promise<void>;
  let second!: Promise<void>;
  act(() => {
    first = hook.result.current.like(1);
  });
  act(() => {
    second = hook.result.current.like(1);
  });
  await waitFor(() => expect(likes).toHaveLength(2));
  likes[1].resolve(likeAnswer(0, false));
  await act(() => second);
  likes[0].resolve(likeAnswer(1, true));
  await act(() => first);

  expect(likeStates(hook)[0]).toEqual([false, 0]);
});

it("rejects a refused like that a later unlike superseded", async () => {
  const { hook } = renderSurfaces();
  await loaded(hook);

  let first!: Promise<void>;
  let second!: Promise<void>;
  act(() => {
    first = hook.result.current.like(1);
  });
  act(() => {
    second = hook.result.current.like(1);
  });
  await waitFor(() => expect(likes).toHaveLength(2));
  likes[1].resolve(likeAnswer(0, false));
  await act(() => second);
  likes[0].resolve(new Response(null, { status: 500 }));

  await act(() => expect(first).rejects.toThrow());
  expect(likeStates(hook)[0]).toEqual([false, 0]);
});

it.each([
  ["the unlike's refusal lands first", [1, 0]],
  ["the like's refusal lands first", [0, 1]],
])(
  "returns to the confirmed state when a like and an unlike are both refused and %s",
  async (_order, refusals) => {
    const { hook } = renderSurfaces();
    await loaded(hook);

    const sent: Promise<void>[] = [];
    act(() => void sent.push(hook.result.current.like(1)));
    act(() => void sent.push(hook.result.current.like(1)));
    await waitFor(() => expect(likes).toHaveLength(2));
    for (const index of refusals) {
      likes[index].resolve(new Response(null, { status: 500 }));
      await act(() => expect(sent[index]).rejects.toThrow());
    }

    expect(likeStates(hook)).toEqual([
      [false, 0],
      [false, 0],
      [false, 0],
    ]);
  },
);

it("takes an earlier like's success when a later unlike is refused before it answers", async () => {
  const { hook } = renderSurfaces();
  await loaded(hook);

  const sent: Promise<void>[] = [];
  act(() => void sent.push(hook.result.current.like(1)));
  act(() => void sent.push(hook.result.current.like(1)));
  await waitFor(() => expect(likes).toHaveLength(2));
  likes[1].resolve(new Response(null, { status: 500 }));
  await act(() => expect(sent[1]).rejects.toThrow());
  likes[0].resolve(likeAnswer(1, true));
  await act(() => sent[0]);

  expect(likeStates(hook)).toEqual([
    [true, 1],
    [true, 1],
    [true, 1],
  ]);
});

it("keeps mounted lists, feeds, and the detail rendering when the session ends", async () => {
  const { client, hook } = renderSurfaces();
  await loaded(hook);

  act(() => meCache(client).clear());
  hook.rerender();

  expect(hook.result.current.detail.error).toBeNull();
  expect(hook.result.current.list.activities).toEqual([]);
  expect(hook.result.current.home.items).toEqual([]);
});

it("does not patch the next session with a like answered after a sign-in change", async () => {
  const { client, hook } = renderSurfaces();
  await loaded(hook);

  let liked!: Promise<void>;
  act(() => {
    liked = hook.result.current.like(1);
  });
  await waitFor(() => expect(likes).toHaveLength(1));
  act(() => endSession(client));
  await act(() =>
    activityStore(client).load({
      carries: [],
      signal: new AbortController().signal,
      fetch: async () => ({
        activities: [makeActivity({ id: 1 })],
        forumComments: [],
      }),
    }),
  );
  likes[0].resolve(likeAnswer(5, true));
  await act(() => liked);

  expect(activityStore(client).getActivity(1)).toMatchObject({
    likedByMe: false,
    likesCount: 0,
  });
});

it("shows a forum comment like from the home feed in the profile feed", async () => {
  const { wrapper } = queryWrapper();
  const hook = renderHook(
    () => ({
      home: useHomeFeed(),
      profile: useUserFeed({ userId: 3 }),
    }),
    { wrapper },
  );
  await waitFor(() => {
    expect(hook.result.current.home.items).toHaveLength(2);
    expect(hook.result.current.profile.items).toHaveLength(2);
  });

  let liked!: Promise<void>;
  act(() => {
    liked = hook.result.current.home.handleLikeForumComment(80);
  });
  await waitFor(() => expect(commentLikes).toHaveLength(1));

  const states = () =>
    [hook.result.current.home, hook.result.current.profile].map(({ items }) => [
      items[1].forumComment?.likedByMe,
      items[1].forumComment?.likesCount,
    ]);
  expect(states()).toEqual([
    [true, 1],
    [true, 1],
  ]);
  commentLikes[0].resolve(new Response(null, { status: 500 }));
  await act(() => expect(liked).rejects.toThrow());
  expect(states()).toEqual([
    [false, 0],
    [false, 0],
  ]);
});
