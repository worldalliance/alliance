import { describe, expect, test } from "bun:test";
import { R } from "./result";
import { topologicalOrder } from "./topological-order";

const order = (
  graph: Record<string, string[]>,
  roots: string[] = Object.keys(graph),
) =>
  topologicalOrder({
    roots,
    itemOf: (id) => (id in graph ? id : undefined),
    dependenciesOf: (id) => graph[id] ?? [],
  });

describe("topologicalOrder", () => {
  test("puts each item after its dependencies, once", () => {
    expect(order({ a: ["c"], b: ["c"], c: [] })).toEqual(
      R.success(["c", "a", "b"]),
    );
  });

  test("skips ids it doesn't know", () => {
    expect(order({ a: ["missing"] }, ["a", "gone"])).toEqual(R.success(["a"]));
  });

  test("returns only the loop, ending where it started", () => {
    expect(order({ a: ["done", "b"], b: ["c"], c: ["b"], done: [] })).toEqual(
      R.failure(["b", "c", "b"]),
    );
    expect(order({ a: ["a"] })).toEqual(R.failure(["a", "a"]));
  });
});
