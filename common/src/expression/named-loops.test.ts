import { expect, test } from "bun:test";
import { type NamedExpression } from "./catalog";
import { catalog, condition, named } from "./check-test-support";
import { SaveProblemKind, checkNamedSave, type NamedSave } from "./named";
import { BinaryOp, ExprKind } from "./tree";

const amount = named({ id: "a", name: "amount", text: "total" });
const doubled = named({
  id: "b",
  name: "doubled",
  text: "amount * 2",
  others: [amount],
});

const problems = (save: NamedSave[], named = [amount, doubled]) => {
  const result = checkNamedSave({ catalog, named, save });
  if (result.ok) throw new Error("expected the save to be blocked");
  return result.error;
};

test("a save that closes a loop is refused at the saved expression", () => {
  expect(
    problems([{ id: "a", name: "amount", source: "doubled + 1" }]),
  ).toEqual([
    {
      kind: SaveProblemKind.Named,
      id: "a",
      text: "doubled + 1",
      diagnostics: [
        expect.objectContaining({
          message:
            "These formulas refer to each other in a loop: doubled → amount → doubled.",
        }),
      ],
    },
  ]);
});

test("a loop is listed at the saved expressions on it, not at their readers", () => {
  expect(
    problems([
      { id: "x", name: "first", source: "second + 1" },
      { id: "y", name: "second", source: "first + 1" },
      { id: "z", name: "reader", source: "first" },
    ]).map(({ kind, id }) => ({ kind, id })),
  ).toEqual([
    { kind: SaveProblemKind.Named, id: "x" },
    { kind: SaveProblemKind.Named, id: "y" },
  ]);
});

test("a saved expression reaching a loop a save closes leaves it to the saved one on it", () => {
  expect(
    problems([
      { id: "a", name: "amount", source: "doubled + 1" },
      { id: "c", name: "reader", source: "doubled" },
    ]).map(({ id }) => id),
  ).toEqual(["a"]);
});

test("two loops in one save are both listed", () => {
  expect(
    problems([
      { id: "p", name: "p1", source: "p2 + 1" },
      { id: "q", name: "p2", source: "p1 + 1" },
      { id: "r", name: "r1", source: "r2 + 1" },
      { id: "s", name: "r2", source: "r1 + 1" },
    ]).map(({ id }) => id),
  ).toEqual(["p", "q", "r", "s"]);
});

const storedLoop: NamedExpression[] = [
  {
    id: "l1",
    name: "l1",
    tree: {
      kind: ExprKind.Binary,
      op: BinaryOp.Add,
      left: { kind: ExprKind.Ref, id: "l2" },
      right: { kind: ExprKind.Ref, id: "a" },
    },
  },
  { id: "l2", name: "l2", tree: { kind: ExprKind.Ref, id: "l1" } },
];

test("a stored loop is listed at the expressions on it, not a saved expression reaching it", () => {
  const result = checkNamedSave({
    catalog,
    named: [amount, ...storedLoop],
    save: [
      { id: "c", name: "c", source: "l1" },
      { id: "p", name: "p1", source: "p2 + 1" },
      { id: "q", name: "p2", source: "p1 + 1" },
      { id: "z", name: "z", source: "p1" },
    ],
  });
  if (result.ok) throw new Error("expected the save to be blocked");
  expect(result.error.map(({ id }) => id)).toEqual(["l1", "l2", "p", "q"]);
});

test("a stored loop is listed at the expressions on it, not a stored dependent reaching it", () => {
  const result = checkNamedSave({
    catalog,
    named: [amount, ...storedLoop],
    dependents: [
      {
        id: "group",
        rule: condition,
        stored: { kind: ExprKind.Ref, id: "l1" },
      },
    ],
    save: [{ id: "a", name: "amount", source: "total + 1" }],
  });
  if (result.ok) throw new Error("expected the save to be blocked");
  expect(result.error.map(({ kind, id }) => ({ kind, id }))).toEqual([
    { kind: SaveProblemKind.Named, id: "l1" },
    { kind: SaveProblemKind.Named, id: "l2" },
  ]);
});

test("a saved loop doesn't hide another saved expression's problem", () => {
  expect(
    problems([
      { id: "p", name: "p1", source: "p2 + 1" },
      { id: "q", name: "p2", source: "p1 + 1" },
      { id: "c", name: "broken", source: 'double("x")' },
    ]).map(({ id }) => id),
  ).toEqual(["p", "q", "c"]);
});

test("a saved expression on a loop that also reaches a stored loop is told its own", () => {
  const stored: NamedExpression[] = [
    amount,
    doubled,
    { id: "l1", name: "l1", tree: { kind: ExprKind.Ref, id: "l2" } },
    { id: "l2", name: "l2", tree: { kind: ExprKind.Ref, id: "l1" } },
  ];
  expect(
    problems([{ id: "a", name: "amount", source: "l1 + doubled" }], stored).map(
      ({ id, ...problem }) => ({
        id,
        messages:
          "diagnostics" in problem
            ? problem.diagnostics.map(({ message }) => message)
            : [],
      }),
    ),
  ).toEqual([
    {
      id: "a",
      messages: [
        "These formulas refer to each other in a loop: doubled → amount → doubled.",
      ],
    },
    {
      id: "l1",
      messages: ["These formulas refer to each other in a loop: l2 → l1 → l2."],
    },
    {
      id: "l2",
      messages: ["These formulas refer to each other in a loop: l1 → l2 → l1."],
    },
  ]);
});
