import { QueryClient } from "@tanstack/react-query";
import { expect, it } from "bun:test";
import { writesDuringLoads } from "./writesDuringLoads";

const append = (word: string) => (prev: string[]) => [...prev, word];

it("replays a write over the load of its own query, not another's", async () => {
  const queryClient = new QueryClient();
  const loads = writesDuringLoads<string[]>();
  const a = Promise.withResolvers<string[]>();
  const b = Promise.withResolvers<string[]>();
  const loadingA = loads.load({
    queryClient,
    queryKey: ["a"],
    fetch: () => a.promise,
  });
  const loadingB = loads.load({
    queryClient,
    queryKey: ["b"],
    fetch: () => b.promise,
  });

  loads.record({ queryClient, queryKey: ["a"], update: append("written") });
  a.resolve(["loaded"]);
  b.resolve(["loaded"]);

  expect(await loadingA).toEqual(["loaded", "written"]);
  expect(await loadingB).toEqual(["loaded"]);
});

it("doesn't replay a write recorded before the load began", async () => {
  const queryClient = new QueryClient();
  const loads = writesDuringLoads<string[]>();

  loads.record({ queryClient, queryKey: ["a"], update: append("written") });

  expect(
    await loads.load({
      queryClient,
      queryKey: ["a"],
      fetch: async () => ["loaded"],
    }),
  ).toEqual(["loaded"]);
});
