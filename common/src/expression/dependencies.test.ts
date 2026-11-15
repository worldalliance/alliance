import { R } from "../result";
import { TypeKind, type Catalog, type NamedExpression } from "./catalog";
import { reads } from "./dependencies";
import { parseExpression } from "./parse";
import { ExprKind } from "./tree";

const catalog: Catalog = {
  inputs: [
    { id: "state", label: "State", type: { kind: TypeKind.String } },
    { id: "count", label: "Count", type: { kind: TypeKind.Number } },
  ],
  functions: [
    {
      name: "lookup",
      params: [{ name: "key", type: { kind: TypeKind.String } }],
      returns: { kind: TypeKind.Number },
    },
  ],
};

const define = ({
  id,
  name = id,
  text,
  named = [],
}: {
  id: string;
  name?: string;
  text: string;
  named?: NamedExpression[];
}) => ({
  id,
  name,
  tree: R.unwrap(parseExpression(text, { catalog, named })),
});

const base = define({ id: "1", name: "base", text: "lookup(state)" });
const middle = define({
  id: "2",
  name: "middle",
  text: "base + count",
  named: [base],
});
const tree = (text: string) =>
  R.unwrap(parseExpression(text, { catalog, named: [base, middle] }));

test("reads follow named expressions to inputs and functions", () => {
  expect(
    reads(tree("middle > Math.abs(1) && !isUnknown(count)"), [base, middle]),
  ).toEqual({
    inputs: new Set(["state", "count"]),
    functions: new Set(["lookup"]),
    named: new Set(["2", "1"]),
  });
});

const refTo = (id: string, to: string): NamedExpression => ({
  id,
  name: `n${id}`,
  tree: { kind: ExprKind.Ref, id: to },
});

test("reads stop at a cycle", () => {
  const a = refTo("a", "b");
  const b = refTo("b", "a");
  expect(reads(a.tree, [a, b]).named).toEqual(new Set(["b", "a"]));
});

test("reads list a reference missing from the named expressions", () => {
  expect(reads(refTo("a", "gone").tree, []).named).toEqual(new Set(["gone"]));
});
