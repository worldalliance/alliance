import { R } from "../result";
import { TypeKind, type Catalog, type NamedExpression } from "./catalog";
import { dependencyOrder, reads } from "./dependencies";
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
  lists: [],
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
    reads(tree("middle > Math.abs(1) && !isMissing(count)"), [base, middle]),
  ).toEqual({
    inputs: new Set(["state", "count"]),
    functions: new Set(["lookup"]),
    named: new Set(["2", "1"]),
    lists: new Set(),
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

describe("dependencyOrder", () => {
  test("named expressions are ordered after what they reference", () => {
    expect(
      R.map(dependencyOrder([tree("middle")], [middle, base]), (order) =>
        order.map((each) => each.name),
      ),
    ).toEqual(R.success(["base", "middle"]));
  });

  test("several roots are ordered together, sharing a definition once", () => {
    expect(
      R.map(
        dependencyOrder([tree("base"), tree("middle")], [middle, base]),
        (order) => order.map((each) => each.name),
      ),
    ).toEqual(R.success(["base", "middle"]));
  });

  test("a cycle is reported by name", () => {
    const a = refTo("a", "b");
    const b = refTo("b", "a");
    expect(dependencyOrder([a.tree], [a, b])).toEqual(
      R.failure(["nb", "na", "nb"]),
    );
  });

  test("a self-reference is a cycle", () => {
    const a = refTo("a", "a");
    expect(dependencyOrder([a.tree], [a])).toEqual(R.failure(["na", "na"]));
  });

  test("a named expression reached twice is ordered once", () => {
    const d = define({ id: "d", text: "count" });
    const b = define({ id: "b", text: "d", named: [d] });
    const c = define({ id: "c", text: "d * 2", named: [d] });
    const a = define({ id: "a", text: "b + c", named: [b, c] });
    expect(
      R.map(dependencyOrder([a.tree], [a, b, c, d]), (order) =>
        order.map((each) => each.name),
      ),
    ).toEqual(R.success(["d", "b", "c"]));
  });

  test("ordering skips a reference missing from the named expressions", () => {
    expect(dependencyOrder([refTo("a", "gone").tree], [])).toEqual(
      R.success([]),
    );
  });
});
