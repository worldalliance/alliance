import { renderHook, waitFor } from "@testing-library/react";
import { makeAction } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useAction } from "./useAction";

let requested: string[] = [];
let respond: (id: string) => Response;

serveApi(
  routes({
    "GET /actions/slug/:id": ({ params }) => {
      requested.push(params.id);
      return respond(params.id);
    },
  }),
);

beforeEach(() => {
  requested = [];
  respond = (id) =>
    Response.json(makeAction({ id: Number(id), name: `Action ${id}` }));
});

it("loads the action", async () => {
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useAction(3).query, { wrapper });

  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(hook.result.current.data?.name).toBe("Action 3");
  expect(requested).toEqual(["3"]);
});

it("requests nothing without an action id", async () => {
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useAction(null).query, { wrapper });

  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(hook.result.current.fetchStatus).toBe("idle");
  expect(requested).toEqual([]);
});

it("waits until enabled, then fetches", async () => {
  const { wrapper } = queryWrapper();

  const hook = renderHook(({ enabled }) => useAction(3, { enabled }).query, {
    wrapper,
    initialProps: { enabled: false },
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(requested).toEqual([]);

  hook.rerender({ enabled: true });

  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(requested).toEqual(["3"]);
});

it("reuses a fresh load instead of refetching when re-enabled", async () => {
  const { wrapper } = queryWrapper();
  const hook = renderHook(({ enabled }) => useAction(3, { enabled }).query, {
    wrapper,
    initialProps: { enabled: true },
  });
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));

  hook.rerender({ enabled: false });
  hook.rerender({ enabled: true });

  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(requested).toEqual(["3"]);
});

it("surfaces a refused load as an error carrying its status", async () => {
  respond = () => Response.json({ message: "Not Found" }, { status: 404 });
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useAction(3).query, { wrapper });

  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(hook.result.current.error).toMatchObject({ statusCode: 404 });
  expect(hook.result.current.data).toBeUndefined();
});
