import { expect, test } from "bun:test";
import { R } from "../result";
import { type NamedExpression } from "./catalog";
import { catalog, condition, named } from "./check-test-support";
import {
  SaveProblemKind,
  checkNamedSave,
  type Dependent,
  type NamedSave,
} from "./named";
import { parseExpression } from "./parse";
import { ExprKind, type Expr } from "./tree";

const amount = named({ id: "a", name: "amount", text: "total" });
const doubled = named({
  id: "b",
  name: "doubled",
  text: "amount * 2",
  others: [amount],
});
const stored = [amount, doubled];

const parse = (text: string) =>
  R.unwrap(parseExpression(text, { catalog, named: stored }));

const dependent = (id: string, text: string): Dependent => ({
  id,
  stored: parse(text),
  rule: condition,
});

const save = (
  saves: NamedSave[],
  {
    deleted,
    dependents,
  }: { deleted?: string[]; dependents?: Dependent[] } = {},
) =>
  checkNamedSave({ catalog, named: stored, save: saves, deleted, dependents });

const problems = (...args: Parameters<typeof save>) => {
  const result = save(...args);
  if (result.ok) throw new Error("expected the save to be blocked");
  return result.error;
};

test("a save that breaks nothing returns the saved trees", () => {
  expect(
    R.unwrap(save([{ id: "c", name: "tripled", source: "amount * 3" }])),
  ).toEqual({
    named: [{ id: "c", name: "tripled", tree: parse("amount * 3") }],
    dependents: [],
  });
});

test("a saved expression's own problem is located in the admin's text", () => {
  expect(
    problems([{ id: "c", name: "tripled", source: 'double(  "x")' }]),
  ).toEqual([
    {
      kind: SaveProblemKind.Named,
      id: "c",
      text: 'double(  "x")',
      diagnostics: [expect.objectContaining({ start: 9, end: 12 })],
    },
  ]);
});

test.each([
  ["", "Enter a name."],
  ["my-name", "`my-name` can't be a name."],
  ["class", "`class` can't be a name."],
  ["eval", "`eval` can't be a name."],
  ["__mine", "A name can't start with `__`."],
  ["total", "`total` is already used by something formulas can read."],
  ["double", "`double` is already used by a function."],
  ["isMissing", "`isMissing` is already used by the language."],
  ["doubled", "`doubled` is already used by another formula."],
])("the name %p is refused", (name, message) => {
  expect(problems([{ id: "c", name, source: "1" }])).toEqual([
    {
      kind: SaveProblemKind.Name,
      id: "c",
      message: expect.stringContaining(message),
    },
  ]);
});

test("a saved tree's problem is located in its printed text", () => {
  expect(
    problems([
      { id: "c", name: "tree", source: { kind: ExprKind.Input, id: "gone" } },
    ]),
  ).toEqual([
    {
      kind: SaveProblemKind.Named,
      id: "c",
      text: "gone",
      diagnostics: [
        expect.objectContaining({
          message: "This uses something that no longer exists.",
          start: 0,
          end: 4,
        }),
      ],
    },
  ]);
});

test("a stored reader's problem is located in its text printed with the save's names", () => {
  const [problem] = problems([
    { id: "a", name: "amountTotalLonger", source: '"x"' },
  ]);
  if (!("text" in problem)) throw new Error("expected diagnostics");
  const [{ start, end }] = problem.diagnostics;
  expect(problem.text.slice(start, end)).toBe("amountTotalLonger");
});

test("two saves under one name are both refused", () => {
  expect(
    problems([
      { id: "c", name: "same", source: "1" },
      { id: "d", name: "same", source: "2" },
    ]).map((problem) => problem.id),
  ).toEqual(["c", "d"]);
});

test("saved text that doesn't parse is listed at the saved expression", () => {
  expect(
    problems([{ id: "c", name: "tripled", source: "amount *" }]).map(
      ({ kind, id }) => ({ kind, id }),
    ),
  ).toEqual([{ kind: SaveProblemKind.Named, id: "c" }]);
});

test("a rename keeps its readers, which read it by id", () => {
  expect(save([{ id: "a", name: "base", source: "total" }]).ok).toBe(true);
});

test("a change that breaks a named reader lists the reader and its reason", () => {
  expect(problems([{ id: "a", name: "amount", source: '"x"' }])).toEqual([
    {
      kind: SaveProblemKind.Named,
      id: "b",
      text: "amount * 2",
      diagnostics: [
        expect.objectContaining({
          message: "The left of this operator has to be a number.",
        }),
      ],
    },
  ]);
});

test("the reader fixed in the same save passes", () => {
  expect(
    save([
      { id: "a", name: "amount", source: '"x"' },
      { id: "b", name: "doubled", source: 'amount + "y"' },
    ]).ok,
  ).toBe(true);
});

test.each([
  ["by the name it had", [], "amount * 2"],
  [
    "by its id once the save gives its name to another",
    [{ id: "c", name: "amount", source: "1" }],
    "a * 2",
  ],
])("a deleted named expression's readers are listed %s", (_, saves, text) => {
  expect(problems(saves, { deleted: ["a"] })).toEqual([
    {
      kind: SaveProblemKind.Named,
      id: "b",
      text,
      diagnostics: [
        {
          message: "This uses a formula that no longer exists.",
          start: 0,
          end: text.length,
        },
      ],
    },
  ]);
});

test("a dependent left undecided without a fallback is listed", () => {
  const group = dependent("group", "amount === 10");
  expect(
    problems([{ id: "a", name: "amount", source: "count" }], {
      dependents: [group],
    }),
  ).toContainEqual({
    kind: SaveProblemKind.Dependent,
    id: "group",
    text: "amount === 10",
    diagnostics: [
      expect.objectContaining({
        message:
          "This is undecided when `amount` has no value. Add `?? false` or `?? true` to decide it then.",
      }),
    ],
  });
});

test("a dependent fixed as text reads names the save introduces", () => {
  const rename = { id: "a", name: "base", source: "total" };
  const fixed = (text: string): Dependent => ({
    id: "group",
    fixed: text,
    rule: condition,
  });
  expect(
    R.unwrap(save([rename], { dependents: [fixed("base === 10")] })).dependents,
  ).toEqual([
    {
      id: "group",
      tree: R.unwrap(
        parseExpression("base === 10", {
          catalog,
          named: [{ ...amount, name: "base" }, doubled],
        }),
      ),
      mayBeUnknown: false,
    },
  ]);
  expect(
    problems([rename], { dependents: [fixed('double(  "x") > base')] }),
  ).toEqual([
    {
      kind: SaveProblemKind.Dependent,
      id: "group",
      text: 'double(  "x") > base',
      diagnostics: [expect.objectContaining({ start: 9, end: 12 })],
    },
  ]);
});

test("a dependent fixed as text that doesn't parse is listed", () => {
  const listed = problems([{ id: "a", name: "base", source: "total" }], {
    dependents: [{ id: "group", fixed: "amount ===", rule: condition }],
  });
  expect(listed.map(({ kind, id }) => ({ kind, id }))).toEqual([
    { kind: SaveProblemKind.Dependent, id: "group" },
  ]);
});

test("a dependent fixed as text is checked though it reads nothing changed", () => {
  expect(
    problems([{ id: "a", name: "base", source: "total" }], {
      dependents: [{ id: "group", fixed: "count === 1", rule: condition }],
    }).map(({ kind, id }) => ({ kind, id })),
  ).toEqual([{ kind: SaveProblemKind.Dependent, id: "group" }]);
});

test("a dependent fixed as a tree is checked and returned", () => {
  const rename = { id: "a", name: "base", source: "total" };
  const fixed = (tree: Expr): Dependent => ({
    id: "group",
    fixed: tree,
    rule: condition,
  });
  const gone: Expr = { kind: ExprKind.Input, id: "gone" };
  expect(
    problems([rename], { dependents: [fixed(gone)] }).map(({ kind, id }) => ({
      kind,
      id,
    })),
  ).toEqual([{ kind: SaveProblemKind.Dependent, id: "group" }]);
  const tree = parse("(count ?? 0) === 1");
  expect(
    R.unwrap(save([rename], { dependents: [fixed(tree)] })).dependents,
  ).toEqual([{ id: "group", tree, mayBeUnknown: false }]);
});

test("a stored dependent that reads nothing changed isn't checked", () => {
  const broken: Dependent = {
    id: "form",
    stored: { kind: ExprKind.Input, id: "gone" },
    rule: condition,
  };
  expect(
    save([{ id: "a", name: "amount", source: "total + 1" }], {
      dependents: [broken],
    }).ok,
  ).toBe(true);
});

test("an already broken stored named expression blocks only through a checked reader", () => {
  const broken: NamedExpression = {
    id: "z",
    name: "broken",
    tree: { kind: ExprKind.Input, id: "gone" },
  };
  const both = named({
    id: "y",
    name: "both",
    text: "amount + broken",
    others: [amount, broken],
  });
  const result = (others: NamedExpression[]) =>
    checkNamedSave({
      catalog,
      named: [...stored, broken, ...others],
      save: [{ id: "a", name: "amount", source: "total + 1" }],
    });
  expect(result([]).ok).toBe(true);
  expect(result([both])).toEqual(
    R.failure([
      expect.objectContaining({ kind: SaveProblemKind.Named, id: "z" }),
    ]),
  );
});

test("a problem is listed once, at the named expression it's in", () => {
  const group = dependent("group", "doubled > 10");
  const listed = problems([{ id: "a", name: "amount", source: '"x"' }], {
    dependents: [group],
  });
  expect(listed).toEqual([
    {
      kind: SaveProblemKind.Named,
      id: "b",
      text: "amount * 2",
      diagnostics: [
        expect.objectContaining({
          message: "The left of this operator has to be a number.",
        }),
      ],
    },
  ]);
});

test("a stored dependent reading a change through another named expression is checked", () => {
  const alias = named({
    id: "c",
    name: "alias",
    text: "amount",
    others: [amount],
  });
  const withAlias = [...stored, alias];
  const group: Dependent = {
    id: "group",
    stored: R.unwrap(
      parseExpression("alias > 10", { catalog, named: withAlias }),
    ),
    rule: condition,
  };
  const result = checkNamedSave({
    catalog,
    named: withAlias,
    save: [{ id: "a", name: "amount", source: '"x"' }],
    dependents: [group],
  });
  if (result.ok) throw new Error("expected the save to be blocked");
  expect(result.error.map(({ kind, id }) => ({ kind, id }))).toContainEqual({
    kind: SaveProblemKind.Dependent,
    id: "group",
  });
});

test("two named expressions can trade names in one save", () => {
  const result = save([
    { id: "a", name: "doubled", source: "total" },
    { id: "b", name: "amount", source: "doubled * 2" },
  ]);
  if (!result.ok) throw new Error("expected the save to pass");
  expect(result.value.named[1].tree).toEqual(
    expect.objectContaining({ left: { kind: ExprKind.Ref, id: "a" } }),
  );
});

test("a saved expression's problem is listed once, in the admin's text", () => {
  expect(
    problems([
      { id: "c", name: "broken", source: 'double(  "x")' },
      { id: "d", name: "reader", source: "broken" },
    ]),
  ).toEqual([
    {
      kind: SaveProblemKind.Named,
      id: "c",
      text: 'double(  "x")',
      diagnostics: [expect.objectContaining({ start: 9, end: 12 })],
    },
  ]);
});

test("saving and deleting one id throws", () => {
  expect(() =>
    save([{ id: "a", name: "amount", source: "1" }], { deleted: ["a"] }),
  ).toThrow("appears more than once across `save` and `deleted`");
});

test("a dependent id given twice throws", () => {
  expect(() =>
    save([{ id: "a", name: "amount", source: "1" }], {
      dependents: [dependent("g", "amount > 1"), dependent("g", "amount > 2")],
    }),
  ).toThrow("A dependent appears more than once in `dependents`.");
});

test("deleting an id no stored named expression has throws", () => {
  expect(() => save([], { deleted: ["nope"] })).toThrow(
    "A deleted id names no stored named expression.",
  );
});
