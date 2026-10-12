import { act, renderHook, waitFor } from "@testing-library/react";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useForumPost } from "./useForumPost";

const post = { id: 7, title: "Hello", likedByMe: false, likeCount: 2 };
let requests: string[] = [];
let likeResponse: Promise<Response>;
let getResponse: () => Response | Promise<Response>;
let updateResponse: () => Response;

serveApi(
  routes({
    "GET /forum/posts/7": () => {
      requests.push("get");
      return getResponse();
    },
    "POST /forum/posts/7/like": () => {
      requests.push("like");
      return likeResponse;
    },
    "POST /forum/posts/7/unlike": () => {
      requests.push("unlike");
      return likeResponse;
    },
    "POST /forum/posts": () => {
      requests.push("create");
      return Response.json({ ...post, id: 8, title: "New" });
    },
    "PATCH /forum/posts/7": () => {
      requests.push("update");
      return updateResponse();
    },
  }),
);

beforeEach(() => {
  requests = [];
  likeResponse = Promise.resolve(Response.json({}));
  getResponse = () => Response.json(post);
  updateResponse = () => Response.json(renamed);
});

const renamed = { ...post, title: "Renamed" };
const body = { title: "Renamed" };

it("loads the post with the given id", async () => {
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useForumPost("7", { userId: 1 }), { wrapper });

  await waitFor(() => expect(hook.result.current.post).toEqual(post));
});

it("does not fetch without an id", async () => {
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useForumPost(undefined, { userId: 1 }), {
    wrapper,
  });

  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(hook.result.current.post).toBeNull();
  expect(requests).toEqual([]);
});

it("likes the post in the cache, then refetches it", async () => {
  const { wrapper, client } = queryWrapper();
  const hook = renderHook(() => useForumPost("7", { userId: 1 }), { wrapper });
  await waitFor(() => expect(hook.result.current.post).toEqual(post));
  const answer = Promise.withResolvers<Response>();
  likeResponse = answer.promise;

  let like: Promise<void> | undefined;
  act(() => {
    like = hook.result.current.handleLike();
  });

  await waitFor(() =>
    expect(hook.result.current.post).toMatchObject({
      likedByMe: true,
      likeCount: 3,
    }),
  );
  answer.resolve(Response.json({}));
  await act(() => like);
  await waitFor(() => expect(requests).toEqual(["get", "like", "get"]));
  expect(client.getQueryData(["forumFindOnePost", "7"])).toEqual(post);
});

it("unlikes a liked post without counting below zero", async () => {
  const liked = { ...post, likedByMe: true, likeCount: 0 };
  getResponse = () => Response.json(liked);
  const { wrapper, client } = queryWrapper();
  const hook = renderHook(() => useForumPost("7", { userId: 1 }), { wrapper });
  await waitFor(() => expect(hook.result.current.post).toEqual(liked));
  const answer = Promise.withResolvers<Response>();
  likeResponse = answer.promise;

  let unlike: Promise<void> | undefined;
  act(() => {
    unlike = hook.result.current.handleLike();
  });

  await waitFor(() => expect(requests).toEqual(["get", "unlike"]));
  expect(client.getQueryData(["forumFindOnePost", "7"])).toEqual({
    ...liked,
    likedByMe: false,
    likeCount: 0,
  });
  answer.resolve(Response.json({}));
  await act(() => unlike);
  await waitFor(() => expect(requests).toEqual(["get", "unlike", "get"]));
});

it("restores the post when the like never reaches the server", async () => {
  const { wrapper, client } = queryWrapper();
  const hook = renderHook(() => useForumPost("7", { userId: 1 }), { wrapper });
  await waitFor(() => expect(hook.result.current.post).toEqual(post));
  likeResponse = Promise.reject(new TypeError("offline"));
  getResponse = () => new Promise(() => {});

  await act(() => hook.result.current.handleLike().catch(() => {}));

  await waitFor(() => expect(requests).toEqual(["get", "like", "get"]));
  expect(client.getQueryData(["forumFindOnePost", "7"])).toEqual(post);
});

it("does nothing without a signed-in user", async () => {
  const { wrapper } = queryWrapper();
  const hook = renderHook(() => useForumPost("7"), { wrapper });
  await waitFor(() => expect(hook.result.current.post).toEqual(post));

  await act(() => hook.result.current.handleLike());

  expect(requests).toEqual(["get"]);
  expect(hook.result.current.post).toEqual(post);
});

it("creates a post without caching it", async () => {
  const { wrapper, client } = queryWrapper();
  const hook = renderHook(() => useForumPost(undefined), { wrapper });

  const created = hook.result.current.create({
    title: "New",
    editableContent: { body: "Hi", attachments: [] },
  });

  await waitFor(() => expect(requests).toEqual(["create"]));
  expect(await created).toMatchObject({ id: 8, title: "New" });
  expect(client.getQueryData(["forumFindOnePost", "8"])).toBeUndefined();
});

it("caches the post an update saved", async () => {
  const { wrapper } = queryWrapper();
  const hook = renderHook(() => useForumPost("7"), { wrapper });
  await waitFor(() => expect(hook.result.current.post).toEqual(post));

  void hook.result.current.update(body);

  await waitFor(() => expect(hook.result.current.post).toEqual(renamed));
  expect(requests).toEqual(["get", "update"]);
});

it("keeps an update over a reload that read the post before it", async () => {
  const { wrapper, client } = queryWrapper();
  const hook = renderHook(() => useForumPost("7"), { wrapper });
  await waitFor(() => expect(hook.result.current.post).toEqual(post));
  const reload = Promise.withResolvers<Response>();
  getResponse = () => reload.promise;
  void client.refetchQueries({ queryKey: ["forumFindOnePost", "7"] });
  await waitFor(() => expect(requests).toEqual(["get", "get"]));

  void hook.result.current.update(body);
  await waitFor(() => expect(hook.result.current.post).toEqual(renamed));
  reload.resolve(Response.json(post));

  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(hook.result.current.post).toEqual(renamed);
});

it("leaves the post alone when the update is refused", async () => {
  updateResponse = () => Response.json({}, { status: 403 });
  const { wrapper } = queryWrapper();
  const hook = renderHook(() => useForumPost("7"), { wrapper });
  await waitFor(() => expect(hook.result.current.post).toEqual(post));

  const refused = hook.result.current.update(body).catch((e: unknown) => e);

  await waitFor(() => expect(requests).toEqual(["get", "update"]));
  expect(await refused).toMatchObject({ statusCode: 403 });
  expect(hook.result.current.post).toEqual(post);
});

it("refuses to update without an id", async () => {
  const { wrapper } = queryWrapper();
  const hook = renderHook(() => useForumPost(undefined), { wrapper });

  const refused = hook.result.current.update(body).catch((e: unknown) => e);

  await waitFor(async () =>
    expect(await refused).toEqual(new Error("No post to update")),
  );
  expect(requests).toEqual([]);
});
