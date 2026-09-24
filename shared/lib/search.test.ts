import { act, renderHook, waitFor } from "@testing-library/react";
import { useSearchResults } from "./search";
import { routes, serveApi } from "./testing/serveApi";

let searchFails = true;

serveApi(
  routes({
    "GET /search/all": () =>
      searchFails
        ? Response.json({ message: "Internal server error" }, { status: 500 })
        : Response.json([
            { id: "user-1", name: "Ada", type: "user", webAppLocation: "/" },
          ]),
  }),
);

afterEach(() => {
  searchFails = true;
});

it("a failed search reports the error", async () => {
  const hook = renderHook(() => useSearchResults("ada", { debounceMs: 0 }));

  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.error).toEqual({
    message: "Internal server error",
    statusCode: 500,
  });
  expect(hook.result.current.items).toEqual([]);
});

it("a retried search clears the error and shows what it found", async () => {
  const hook = renderHook(() => useSearchResults("ada", { debounceMs: 0 }));
  await waitFor(() => expect(hook.result.current.error).not.toBeNull());

  searchFails = false;
  act(() => hook.result.current.retry());

  await waitFor(() => expect(hook.result.current.items).toHaveLength(1));
  expect(hook.result.current.error).toBeNull();
});
