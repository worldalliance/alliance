import { act, renderHook, waitFor } from "@testing-library/react";
import { forumPostStore } from "./forumPostStore";
import { queryKeys } from "./queryKeys";
import { endSession } from "./sessionStores";
import { makeComment, makePost } from "./testFixtures";
import { pending, type Pending } from "./testing/pending";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useForumPost } from "./useForumPost";
import { useForumPosts, useUserForumPosts } from "./useForumPosts";
import { meCache } from "./useMe";

const AUTHOR = 1;
const lastComment = makeComment({ id: 90 });

let index: () => Promise<Response>;
let profile: () => Promise<Response>;
let details: Record<string, () => Promise<Response>>;
let likes: Pending<Response>[];
let requests: string[];
let save: () => Promise<Response>;

serveApi(
  routes({
    "GET /forum/posts": () => index(),
    "GET /forum/posts/user/:id": () => profile(),
    "GET /forum/posts/:id": ({ params }) => {
      requests.push(`get ${params.id}`);
      return details[params.id]();
    },
    "POST /forum/posts/:id/like": () => pending(likes),
    "POST /forum/posts/:id/unlike": () => pending(likes),
    "POST /forum/posts": () => {
      requests.push("create");
      return Response.json(makePost({ id: 9, title: "New" }));
    },
    "PATCH /forum/posts/:id": () => save(),
    "DELETE /forum/posts/:id": () => new Response(null),
  }),
);

beforeEach(() => {
  index = async () =>
    Response.json([makePost({ commentCount: 3, lastComment })]);
  profile = async () => Response.json([makePost()]);
  details = {
    "7": async () => Response.json(makePost()),
    "8": async () => Response.json(makePost({ id: 8, title: "Other" })),
  };
  likes = [];
  requests = [];
  save = async () => Response.json(makePost({ title: "Renamed" }));
});

const renderSurfaces = () => {
  const query = queryWrapper();
  const hook = renderHook(
    () => ({
      index: useForumPosts(),
      profile: useUserForumPosts(AUTHOR),
      detail: useForumPost("7", { userId: AUTHOR }),
    }),
    { wrapper: query.wrapper },
  );
  return { ...query, hook };
};

type Surfaces = ReturnType<typeof renderSurfaces>["hook"];

const loaded = (hook: Surfaces) =>
  waitFor(() => {
    expect(hook.result.current.index.posts).toHaveLength(1);
    expect(hook.result.current.profile.data).toHaveLength(1);
    expect(hook.result.current.detail.post).not.toBeNull();
  });

const shown = (hook: Surfaces) => {
  const { index, profile, detail } = hook.result.current;
  return [index.posts[0], profile.data?.[0], detail.post];
};

it("shows a like from the post page in the forum index and the profile list", async () => {
  const { hook } = renderSurfaces();
  await loaded(hook);

  act(() => {
    void hook.result.current.detail.handleLike();
  });

  await waitFor(() => expect(likes).toHaveLength(1));
  for (const post of shown(hook))
    expect(post).toMatchObject({ likedByMe: true, likeCount: 1 });
});

it("shows a saved edit in the forum index and the profile list", async () => {
  const { hook } = renderSurfaces();
  await loaded(hook);

  await act(() => hook.result.current.detail.update({ title: "Renamed" }));

  await waitFor(() => {
    for (const post of shown(hook)) expect(post?.title).toBe("Renamed");
  });
});

it("keeps the forum index's comment count when a saved edit or the profile list loads", async () => {
  const { hook } = renderSurfaces();
  await loaded(hook);

  await act(() => hook.result.current.detail.update({ title: "Renamed" }));
  profile = async () => Response.json([makePost({ title: "Renamed" })]);
  await act(() => hook.result.current.profile.refetch());

  expect(hook.result.current.index.posts[0]).toMatchObject({
    title: "Renamed",
    commentCount: 3,
    lastComment,
  });
});

it("drops a deleted post from the forum index and the profile list", async () => {
  const { hook } = renderSurfaces();
  await loaded(hook);

  await act(() => hook.result.current.detail.remove());

  await waitFor(() => {
    expect(hook.result.current.index.posts).toEqual([]);
    expect(hook.result.current.profile.data).toEqual([]);
    expect(hook.result.current.detail.post).toBeNull();
  });
});

it("does not show a deleted post when it is reopened after its detail is collected", async () => {
  const { client, wrapper, hook } = renderSurfaces();
  await loaded(hook);
  await act(() => hook.result.current.detail.remove());
  hook.unmount();
  client.removeQueries({ queryKey: queryKeys.forumPost("7") });
  details["7"] = () => new Promise(() => {});

  const reopened = renderHook(() => useForumPost("7"), { wrapper });

  expect(reopened.result.current.post).toBeNull();
});

it("drops a post its detail answers 404 for from the lists and later opens", async () => {
  const { client, wrapper, hook } = renderSurfaces();
  await loaded(hook);
  details["7"] = async () => Response.json({}, { status: 404 });

  await act(() =>
    client.refetchQueries({ queryKey: queryKeys.forumPost("7") }),
  );

  expect(hook.result.current.index.posts).toEqual([]);
  expect(hook.result.current.profile.data).toEqual([]);
  expect(hook.result.current.detail.post).toBeNull();
  hook.unmount();
  client.removeQueries({ queryKey: queryKeys.forumPost("7") });
  details["7"] = () => new Promise(() => {});
  const reopened = renderHook(() => useForumPost("7"), { wrapper });
  expect(reopened.result.current.post).toBeNull();
});

it("reloads the profile list after a new post", async () => {
  const query = queryWrapper();
  const hook = renderHook(
    () => ({
      profile: useUserForumPosts(AUTHOR),
      form: useForumPost(undefined),
    }),
    { wrapper: query.wrapper },
  );
  await waitFor(() => expect(hook.result.current.profile.data).toHaveLength(1));
  profile = async () =>
    Response.json([makePost({ id: 9, title: "New" }), makePost()]);

  await act(() =>
    hook.result.current.form.create({
      title: "New",
      editableContent: { body: "Hi", attachments: [] },
    }),
  );

  await waitFor(() =>
    expect(hook.result.current.profile.data?.map(({ id }) => id)).toEqual([
      9, 7,
    ]),
  );
});

it("keeps a like over a post load that read the post before it", async () => {
  const { client, hook } = renderSurfaces();
  await loaded(hook);
  const stale = Promise.withResolvers<Response>();
  details["7"] = () => stale.promise;
  void client.refetchQueries({ queryKey: queryKeys.forumPost("7") });
  await waitFor(() => expect(requests).toEqual(["get 7", "get 7"]));

  act(() => {
    void hook.result.current.detail.handleLike();
  });
  await waitFor(() => expect(likes).toHaveLength(1));
  stale.resolve(Response.json(makePost()));

  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(hook.result.current.detail.post).toMatchObject({
    likedByMe: true,
    likeCount: 1,
  });
});

it("takes back a refused like on the post it was made on after moving to another post", async () => {
  const { wrapper } = queryWrapper();
  const hook = renderHook(
    ({ postId }) => useForumPost(postId, { userId: AUTHOR }),
    { wrapper, initialProps: { postId: "7" } },
  );
  await waitFor(() => expect(hook.result.current.post?.id).toBe(7));

  let liked!: Promise<void>;
  act(() => {
    liked = hook.result.current.handleLike();
  });
  await waitFor(() => expect(likes).toHaveLength(1));
  hook.rerender({ postId: "8" });
  await waitFor(() => expect(hook.result.current.post?.id).toBe(8));
  details["7"] = () => new Promise(() => {});
  details["8"] = () => new Promise(() => {});
  requests = [];
  likes[0].resolve(Response.json({}, { status: 500 }));
  await act(() => liked.catch(() => {}));

  expect(hook.result.current.post).toMatchObject({ id: 8, title: "Other" });
  expect(requests).not.toContain("get 8");
  hook.rerender({ postId: "7" });
  expect(hook.result.current.post).toMatchObject({
    id: 7,
    likedByMe: false,
    likeCount: 0,
  });
});

it("shows a post the forum index loaded while the post's own request is out", async () => {
  const { wrapper } = queryWrapper();
  details["7"] = () => new Promise(() => {});
  const hook = renderHook(
    () => ({ index: useForumPosts(), detail: useForumPost("7") }),
    { wrapper },
  );

  await waitFor(() =>
    expect(hook.result.current.detail.post).toMatchObject({ id: 7 }),
  );
});

it("keeps mounted lists and the post rendering when the session ends", async () => {
  const { client, hook } = renderSurfaces();
  await loaded(hook);

  act(() => meCache(client).clear());
  hook.rerender();

  expect(hook.result.current.index.posts).toEqual([]);
  expect(hook.result.current.profile.data).toBeUndefined();
  expect(hook.result.current.detail.post).toBeNull();
});

it("does not patch the next session with an edit answered after a sign-in change", async () => {
  const { client, hook } = renderSurfaces();
  await loaded(hook);
  const answer = Promise.withResolvers<Response>();
  save = () => answer.promise;

  const saved = hook.result.current.detail.update({ title: "Renamed" });
  await waitFor(() => expect(client.isMutating()).toBe(1));
  act(() => endSession(client));
  await act(() =>
    forumPostStore(client).load({
      carries: [],
      signal: new AbortController().signal,
      fetch: async () => [makePost({ title: "Next viewer's copy" })],
    }),
  );
  answer.resolve(Response.json(makePost({ title: "Renamed" })));
  await act(() => saved);

  expect(forumPostStore(client).getPost(7)?.title).toBe("Next viewer's copy");
});
