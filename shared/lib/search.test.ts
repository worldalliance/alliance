import { renderHook, waitFor } from "@testing-library/react";
import { useSearchResults } from "./search";
import { routes, serveApi } from "./testing/serveApi";

serveApi(
  routes({
    "GET /search/all": () =>
      Response.json({ message: "Internal server error" }, { status: 500 }),
  }),
);

it("a failed search reports the error", async () => {
  const hook = renderHook(() => useSearchResults("ada", { debounceMs: 0 }));

  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.error).toEqual({
    message: "Internal server error",
    statusCode: 500,
  });
  expect(hook.result.current.items).toEqual([]);
});
