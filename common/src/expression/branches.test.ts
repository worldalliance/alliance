import { expect, test } from "bun:test";
import { R } from "../result";
import { branches } from "./branches";
import { catalog } from "./check-test-support";
import { evaluate } from "./evaluate";
import { parseExpression } from "./parse";
import { printExpression } from "./print";
import type { Expr } from "./tree";

const scope = {
  catalog: { ...catalog, lists: [{ id: "l", name: "L" }] },
  named: [],
};
const names = { refName: (id: string) => id, listName: () => "L" };

test("lists each branch of ?: and each ?? fallback", () => {
  const tree = R.unwrap(
    parseExpression('isOnList("L") ? (1 > 2 ? "a" : "b") : null ?? "c"', scope),
  );
  expect(branches(tree).map((each) => printExpression(each, names))).toEqual([
    '1 > 2 ? "a" : "b"',
    'null ?? "c"',
    '"a"',
    '"b"',
    '"c"',
  ]);
});

test("the evaluator reports the listed nodes of the branches it takes", () => {
  const tree = R.unwrap(
    parseExpression('isOnList("L") ? "on" : null ?? "off"', scope),
  );
  const listed = branches(tree);
  const taken: number[] = [];
  evaluate(tree, {
    ...scope,
    readInput: () => R.success(null),
    callFunction: () => R.success(null),
    isOnList: () => R.success(false),
    onBranch: (node) => taken.push(listed.indexOf(node)),
  });
  expect(taken).toEqual([1, 2]);
});

test("a branch taken inside a named expression is the node listed for its tree", () => {
  const inner = R.unwrap(parseExpression('isOnList("L") ? 1 : 2', scope));
  const named = { ...scope, named: [{ id: "f", name: "f", tree: inner }] };
  const tree = R.unwrap(parseExpression("f + 1", named));
  const taken: Expr[] = [];
  evaluate(tree, {
    ...named,
    readInput: () => R.success(null),
    callFunction: () => R.success(null),
    isOnList: () => R.success(true),
    onBranch: (node) => taken.push(node),
  });
  expect(branches(tree)).toEqual([]);
  expect(taken).toHaveLength(1);
  expect(taken[0]).toBe(branches(inner)[0]);
});
