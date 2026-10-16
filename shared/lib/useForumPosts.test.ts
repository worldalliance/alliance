import { renderHook, waitFor } from "@testing-library/react";
import { milliseconds } from "date-fns";
import { queryKeys } from "./queryKeys";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useForumPosts } from "./useForumPosts";

const posts = [{ id: 7, title: "Hello" }];
let requests = 0;
let getResponse: () => Response;

serveApi(
  routes({
    "GET /forum/posts": () => {
      requests += 1;
      return getResponse();
    },
  }),
);

beforeEach(() => {
  requests = 0;
  getResponse = () => Response.json(posts);
});

it("loads the forum posts", async () => {
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useForumPosts(), { wrapper });

  await waitFor(() => expect(hook.result.current.posts).toEqual(posts));
  expect(hook.result.current.didFail).toBe(false);
});

it("a failed fetch with nothing cached reports a failure", async () => {
  getResponse = () =>
    Response.json({ message: "Internal server error" }, { status: 500 });
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useForumPosts(), { wrapper });

  await waitFor(() => expect(hook.result.current.didFail).toBe(true));
  expect(hook.result.current.posts).toEqual([]);
});

it("reloads a cached list on mount whatever the client's staleTime", async () => {
  const { client, wrapper } = queryWrapper({
    staleTime: milliseconds({ minutes: 5 }),
  });
  client.setQueryData(queryKeys.forumPosts(), []);

  const hook = renderHook(() => useForumPosts(), { wrapper });

  await waitFor(() => expect(hook.result.current.posts).toEqual(posts));
  expect(requests).toBe(1);
});

it("a failed reload keeps the cached list and reports an error", async () => {
  getResponse = () =>
    Response.json({ message: "Internal server error" }, { status: 500 });
  const { client, wrapper } = queryWrapper();
  client.setQueryData(queryKeys.forumPosts(), posts);

  const hook = renderHook(() => useForumPosts(), { wrapper });

  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(hook.result.current.posts).toBe(posts);
  expect(hook.result.current.didFail).toBe(false);
});
