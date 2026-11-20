import { expect, test } from "bun:test";
import { R } from "../result";
import { TypeKind, type Catalog } from "./catalog";
import { catalog, condition, named } from "./check-test-support";
import { SaveProblemKind, checkStored } from "./named";
import { parseExpression } from "./parse";

const amount = named({ id: "a", name: "amount", text: "total" });
const doubled = named({
  id: "b",
  name: "doubled",
  text: "amount * 2",
  others: [amount],
});
const stored = [amount, doubled];
const big = {
  id: "split-group",
  rule: condition,
  stored: R.unwrap(parseExpression("doubled > 10", { catalog, named: stored })),
};

const withTotal = (type: Catalog["inputs"][number]["type"] | undefined) => ({
  ...catalog,
  inputs: catalog.inputs.flatMap((input) =>
    input.id !== "total"
      ? [input]
      : type === undefined
        ? []
        : [{ ...input, type }],
  ),
});

test("stored expressions that still check pass", () => {
  expect(checkStored({ catalog, named: stored, dependents: [big] })).toEqual(
    R.success(undefined),
  );
});

test("a removed input is reported at the formula reading it, not its readers", () => {
  expect(
    checkStored({
      catalog: withTotal(undefined),
      named: stored,
      dependents: [big],
    }),
  ).toEqual(
    R.failure([
      {
        kind: SaveProblemKind.Named,
        id: "a",
        text: "total",
        diagnostics: [
          {
            message: "This uses something that no longer exists.",
            start: 0,
            end: 5,
          },
        ],
      },
    ]),
  );
});

test("a stored dependent broken by a retyped input is listed", () => {
  const result = checkStored({
    catalog: withTotal({ kind: TypeKind.String }),
    named: [],
    dependents: [
      {
        id: "visible-if",
        rule: condition,
        stored: R.unwrap(parseExpression("total > 1", { catalog, named: [] })),
      },
    ],
  });
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.map(({ kind, id }) => ({ kind, id }))).toEqual([
      { kind: SaveProblemKind.Dependent, id: "visible-if" },
    ]);
  }
});

test("a fallback a catalog change made needless doesn't fail a stored formula", () => {
  const fallback = named({ id: "c", name: "safeCount", text: "count ?? 0" });
  const known = {
    ...catalog,
    inputs: catalog.inputs.map((input) =>
      input.id === "count"
        ? { ...input, type: { kind: TypeKind.Number } as const }
        : input,
    ),
  };
  expect(checkStored({ catalog: known, named: [fallback] })).toEqual(
    R.success(undefined),
  );
});

test("a catalog entry taking a stored formula's name is reported at the formula", () => {
  expect(
    checkStored({
      catalog: {
        ...catalog,
        inputs: [
          ...catalog.inputs,
          { id: "amount", label: "Amount", type: { kind: TypeKind.Number } },
        ],
      },
      named: stored,
    }),
  ).toEqual(
    R.failure([
      {
        kind: SaveProblemKind.Name,
        id: "a",
        message:
          "`amount` is already used by something formulas can read. Pick another name.",
      },
    ]),
  );
});
