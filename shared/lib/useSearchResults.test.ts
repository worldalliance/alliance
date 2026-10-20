import { onlineManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { queryKeys } from "./queryKeys";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useSearchResults } from "./useSearchResults";

let searchFails = true;
let searched: string[] = [];
let holdingSearches: Promise<void> | null = null;
let extraResult: { id: string; name: string } | null = null;

serveApi(
  routes({
    "GET /search/all": async ({ request }) => {
      const query = new URL(request.url).searchParams.get("query") ?? "";
      searched.push(query);
      await holdingSearches;
      return searchFails
        ? Response.json({ message: "Internal server error" }, { status: 500 })
        : Response.json([
            {
              id: `user-${query}`,
              name: query,
              type: "user",
              webAppLocation: "/",
            },
            ...(extraResult
              ? [{ ...extraResult, type: "user", webAppLocation: "/" }]
              : []),
          ]);
    },
  }),
);

afterEach(() => {
  searchFails = true;
  searched = [];
  holdingSearches = null;
  extraResult = null;
  onlineManager.setOnline(true);
});

it("a failed search reports the error", async () => {
  const { wrapper } = queryWrapper();
  const hook = renderHook(() => useSearchResults("ada", { debounceMs: 0 }), {
    wrapper,
  });

  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.error).toEqual({
    message: "Internal server error",
    statusCode: 500,
  });
  expect(hook.result.current.items).toEqual([]);
});

it("a retried search clears the error and shows what it found", async () => {
  const { wrapper } = queryWrapper();
  const hook = renderHook(() => useSearchResults("ada", { debounceMs: 0 }), {
    wrapper,
  });
  await waitFor(() => expect(hook.result.current.error).not.toBeNull());

  searchFails = false;
  act(() => hook.result.current.retry());

  await waitFor(() => expect(hook.result.current.items).toHaveLength(1));
  expect(hook.result.current.error).toBeNull();
});

it("searches only the query typing settled on, and selects its first result", async () => {
  searchFails = false;
  const { wrapper } = queryWrapper();
  const hook = renderHook(
    ({ query }) => useSearchResults(query, { debounceMs: 20 }),
    { wrapper, initialProps: { query: "a" } },
  );
  hook.rerender({ query: "ad" });
  hook.rerender({ query: "ada" });

  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(searched).toEqual(["ada"]);
  expect(hook.result.current.selectedItem?.id).toBe("user-ada");
});

it("keeps the previous results while the next query loads, and clears them for an empty query", async () => {
  searchFails = false;
  const { wrapper } = queryWrapper();
  const hook = renderHook(
    ({ query }) => useSearchResults(query, { debounceMs: 0 }),
    { wrapper, initialProps: { query: "ada" } },
  );
  await waitFor(() => expect(hook.result.current.loading).toBe(false));

  hook.rerender({ query: "bob" });
  expect(hook.result.current.loading).toBe(true);
  expect(hook.result.current.items.map((item) => item.id)).toEqual([
    "user-ada",
  ]);
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.selectedItem?.id).toBe("user-bob");

  hook.rerender({ query: "" });
  expect(hook.result.current.items).toEqual([]);
  expect(hook.result.current.loading).toBe(false);
  await waitFor(() => expect(hook.result.current.selectedItem).toBeNull());
});

it("answers a repeated query from the cache and refetches it, whatever the app's staleTime", async () => {
  searchFails = false;
  const { wrapper } = queryWrapper({ staleTime: Infinity });
  const first = renderHook(() => useSearchResults("ada", { debounceMs: 0 }), {
    wrapper,
  });
  await waitFor(() => expect(first.result.current.items).toHaveLength(1));

  const held = Promise.withResolvers<void>();
  holdingSearches = held.promise;
  const second = renderHook(() => useSearchResults("ada", { debounceMs: 0 }), {
    wrapper,
  });
  await waitFor(() => expect(searched).toEqual(["ada", "ada"]));
  expect(second.result.current.items).toHaveLength(1);
  held.resolve();
});

it("shows nothing from before a cleared query while the next one loads", async () => {
  searchFails = false;
  const { wrapper } = queryWrapper();
  const hook = renderHook(
    ({ query }) => useSearchResults(query, { debounceMs: 0 }),
    { wrapper, initialProps: { query: "ada" } },
  );
  await waitFor(() => expect(hook.result.current.loading).toBe(false));

  hook.rerender({ query: "" });
  await waitFor(() => expect(hook.result.current.selectedItem).toBeNull());
  const held = Promise.withResolvers<void>();
  holdingSearches = held.promise;
  hook.rerender({ query: "bob" });
  await waitFor(() => expect(searched).toEqual(["ada", "bob"]));

  expect(hook.result.current.items).toEqual([]);
  expect(hook.result.current.selectedItem).toBeNull();
  expect(hook.result.current.loading).toBe(true);
  held.resolve();
  await waitFor(() =>
    expect(hook.result.current.selectedItem?.id).toBe("user-bob"),
  );
});

it("selects the first of each result set in the render that shows it", async () => {
  searchFails = false;
  const { wrapper } = queryWrapper();
  const rendered: Array<[string | undefined, string | undefined]> = [];
  const hook = renderHook(
    ({ query }) => {
      const result = useSearchResults(query, { debounceMs: 0 });
      rendered.push([result.items[0]?.id, result.selectedItem?.id]);
      return result;
    },
    { wrapper, initialProps: { query: "ada" } },
  );
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  hook.rerender({ query: "bob" });
  await waitFor(() =>
    expect(hook.result.current.selectedItem?.id).toBe("user-bob"),
  );

  expect(rendered.filter(([first, selected]) => first !== selected)).toEqual(
    [],
  );
});

it("keeps the results on screen when refetching them fails", async () => {
  searchFails = false;
  const { client, wrapper } = queryWrapper();
  const hook = renderHook(() => useSearchResults("ada", { debounceMs: 0 }), {
    wrapper,
  });
  await waitFor(() => expect(hook.result.current.items).toHaveLength(1));

  searchFails = true;
  await act(() => client.refetchQueries());
  await waitFor(() =>
    expect(client.getQueryState(queryKeys.search("ada"))?.status).toBe("error"),
  );

  expect(hook.result.current.items).toHaveLength(1);
  expect(hook.result.current.error).toBeNull();
});

it("loads while a retry of a failed search is in flight", async () => {
  const { wrapper } = queryWrapper();
  const hook = renderHook(() => useSearchResults("ada", { debounceMs: 0 }), {
    wrapper,
  });
  await waitFor(() => expect(hook.result.current.error).not.toBeNull());

  const held = Promise.withResolvers<void>();
  holdingSearches = held.promise;
  act(() => hook.result.current.retry());

  await waitFor(() => expect(hook.result.current.loading).toBe(true));
  held.resolve();
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.error).not.toBeNull();
});

it("keeps the results on screen while going back to a query that failed", async () => {
  const { wrapper } = queryWrapper();
  const hook = renderHook(
    ({ query }) => useSearchResults(query, { debounceMs: 0 }),
    { wrapper, initialProps: { query: "ada" } },
  );
  await waitFor(() => expect(hook.result.current.error).not.toBeNull());

  searchFails = false;
  hook.rerender({ query: "adab" });
  await waitFor(() => expect(hook.result.current.items).toHaveLength(1));

  const held = Promise.withResolvers<void>();
  holdingSearches = held.promise;
  hook.rerender({ query: "ada" });
  await waitFor(() => expect(searched).toEqual(["ada", "adab", "ada"]));

  expect(hook.result.current.items.map((item) => item.id)).toEqual([
    "user-adab",
  ]);
  held.resolve();
  await waitFor(() =>
    expect(hook.result.current.selectedItem?.id).toBe("user-ada"),
  );
});

it("doesn't load while refetching results that already answer the query", async () => {
  searchFails = false;
  const { client, wrapper } = queryWrapper();
  const hook = renderHook(() => useSearchResults("ada", { debounceMs: 0 }), {
    wrapper,
  });
  await waitFor(() => expect(hook.result.current.items).toHaveLength(1));

  const held = Promise.withResolvers<void>();
  holdingSearches = held.promise;
  act(() => void client.refetchQueries());
  await waitFor(() => expect(searched).toEqual(["ada", "ada"]));

  expect(hook.result.current.loading).toBe(false);
  held.resolve();
});

it("reports a failed search without retrying it, whatever the app's retry policy", async () => {
  const { wrapper } = queryWrapper({ retry: 3, retryDelay: 0 });
  const hook = renderHook(() => useSearchResults("ada", { debounceMs: 0 }), {
    wrapper,
  });

  await waitFor(() => expect(hook.result.current.error).not.toBeNull());
  expect(searched).toEqual(["ada"]);
});

it("keeps the chosen result selected when a refetch changes the results", async () => {
  searchFails = false;
  extraResult = { id: "user-bea", name: "Bea" };
  const { client, wrapper } = queryWrapper();
  const hook = renderHook(
    ({ query }) => useSearchResults(query, { debounceMs: 0 }),
    { wrapper, initialProps: { query: "ada" } },
  );
  await waitFor(() => expect(hook.result.current.items).toHaveLength(2));
  act(() => hook.result.current.setSelectedItem(hook.result.current.items[1]));

  extraResult = { id: "user-bea", name: "Beatrice" };
  await act(() => client.refetchQueries());
  await waitFor(() =>
    expect(hook.result.current.items[1]?.name).toBe("Beatrice"),
  );

  expect(hook.result.current.selectedItem?.name).toBe("Beatrice");

  hook.rerender({ query: "" });
  hook.rerender({ query: "ada" });
  await waitFor(() => expect(hook.result.current.items).toHaveLength(2));
  expect(hook.result.current.selectedItem?.id).toBe("user-ada");
});

it("selects the first result again on going back to an earlier query", async () => {
  searchFails = false;
  extraResult = { id: "user-bea", name: "Bea" };
  const { wrapper } = queryWrapper();
  const hook = renderHook(
    ({ query }) => useSearchResults(query, { debounceMs: 0 }),
    { wrapper, initialProps: { query: "ada" } },
  );
  await waitFor(() => expect(hook.result.current.items).toHaveLength(2));
  act(() => hook.result.current.setSelectedItem(hook.result.current.items[1]));

  hook.rerender({ query: "adab" });
  await waitFor(() =>
    expect(hook.result.current.selectedItem?.id).toBe("user-adab"),
  );
  hook.rerender({ query: "ada" });
  await waitFor(() =>
    expect(hook.result.current.items[0]?.id).toBe("user-ada"),
  );

  expect(hook.result.current.selectedItem?.id).toBe("user-ada");
});

it("searches even while the browser reports itself offline", async () => {
  onlineManager.setOnline(false);
  const { wrapper } = queryWrapper();
  const hook = renderHook(() => useSearchResults("ada", { debounceMs: 0 }), {
    wrapper,
  });

  await waitFor(() => expect(hook.result.current.error).not.toBeNull());
  expect(searched).toEqual(["ada"]);
});
