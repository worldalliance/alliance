import { expect, test } from "bun:test";
import { R } from "../result";
import { type Catalog } from "./catalog";
import { checkExpression, printNames } from "./check";
import {
  NEEDLESS,
  catalog as baseCatalog,
  condition,
  variable,
} from "./check-test-support";
import { reads } from "./dependencies";
import { evaluate } from "./evaluate";
import { SaveProblemKind, checkNamedSave, checkStored } from "./named";
import { parseExpression } from "./parse";
import { printExpression } from "./print";
import { ExprKind, REMOVED_LIST, type Expr } from "./tree";

const california = { id: "list-ca", name: "California targets" };
const volunteers = { id: "list-vol", name: "Volunteers" };
const catalog: Catalog = { ...baseCatalog, lists: [california, volunteers] };
const scope = { catalog, named: [] };

const parse = (text: string) => parseExpression(text, scope);
const messages = (text: string) => {
  const parsed = parse(text);
  if (parsed.ok) throw new Error(`expected ${text} to fail`);
  return parsed.error.map(({ message, start, end }) => ({
    message,
    at: text.slice(start, end),
  }));
};
const check = (text: string, rule = condition) =>
  checkExpression({ source: text, scope, rule });

test("a list read stores the list's id and prints its current name", () => {
  const tree = R.unwrap(parse('isOnList("California targets")'));
  expect(tree).toEqual({ kind: ExprKind.OnList, listId: "list-ca" });
  const renamed = printExpression(
    tree,
    printNames({
      scope: {
        catalog: { ...catalog, lists: [{ ...california, name: 'CA "core"' }] },
        named: [],
      },
    }),
  );
  expect(renamed).toBe('isOnList("CA \\"core\\"")');
});

test("naming a list that doesn't exist lists the ones that do", () => {
  expect(messages('isOnList("Californa targets")')).toEqual([
    {
      message:
        'There\'s no list called "Californa targets". Lists: "California targets", "Volunteers".',
      at: '"Californa targets"',
    },
  ]);
  expect(
    parseExpression('isOnList("Volunteers")', {
      catalog: baseCatalog,
      named: [],
    }),
  ).toEqual(
    R.failure([
      { message: "There are no member lists yet.", start: 9, end: 21 },
    ]),
  );
});

test.each([
  "isOnList(state)",
  'isOnList("Volunteers", "California targets")',
  "isOnList()",
  "isOnList(`Volunteers ${state}`)",
])("%s needs one quoted list name", (text) => {
  expect(messages(text)).toEqual([
    {
      message: 'Name one list in quotes, like `isOnList("List name")`.',
      at: text,
    },
  ]);
});

test("isOnList read without a call says to call it", () => {
  expect(messages("isOnList")).toEqual([
    {
      message: "`isOnList` is a function; call it with (…).",
      at: "isOnList",
    },
  ]);
});

test("a list read is a yes/no value that is never undecided", () => {
  expect(
    check('isOnList("Volunteers") && !isOnList("California targets")'),
  ).toMatchObject({ ok: true });
  expect(check('isOnList("Volunteers") ? total : 0', variable)).toMatchObject({
    ok: true,
  });
  expect(check('isOnList("Volunteers") ?? false')).toEqual(
    R.failure([{ message: NEEDLESS, start: 26, end: 31 }]),
  );
  expect(check('isOnList("Volunteers") + 1', variable)).toEqual(
    R.failure([
      {
        message:
          "Operator '+' cannot be applied to types 'boolean' and 'number'.",
        start: 0,
        end: 26,
      },
    ]),
  );
});

test("a tree reading a removed list fails as a whole", () => {
  const tree: Expr = { kind: ExprKind.OnList, listId: "list-gone" };
  const checked = checkExpression({
    source: tree,
    scope,
    rule: condition,
    deletedLists: new Map([["list-gone", "Old list"]]),
  });
  expect(checked).toEqual(
    R.failure([
      { message: REMOVED_LIST, start: 0, end: 'isOnList("Old list")'.length },
    ]),
  );
});

test("a removed list whose name a current list took prints as its id", () => {
  const checked = checkExpression({
    source: { kind: ExprKind.OnList, listId: "list-gone" },
    scope,
    rule: condition,
    deletedLists: new Map([["list-gone", "Volunteers"]]),
  });
  expect(checked).toEqual(
    R.failure([
      { message: REMOVED_LIST, start: 0, end: 'isOnList("list-gone")'.length },
    ]),
  );
});

test("a stored list read a parameter called isOnList hides fails", () => {
  const tree: Expr = {
    kind: ExprKind.Method,
    target: { kind: ExprKind.Input, id: "items" },
    method: "some",
    optional: false,
    args: [
      {
        kind: ExprKind.Lambda,
        params: ["isOnList"],
        body: { kind: ExprKind.OnList, listId: "list-vol" },
      },
    ],
  };
  expect(checkExpression({ source: tree, scope, rule: condition })).toEqual(
    R.failure([
      expect.objectContaining({
        message:
          "A function parameter here is also called `isOnList`, so the text reads the parameter instead. Rename the parameter.",
        start: 0,
      }),
    ]),
  );
});

test("reads lists the lists an expression reads through formulas", () => {
  const onCa = {
    id: "f1",
    name: "onCa",
    tree: R.unwrap(parse('isOnList("California targets")')),
  };
  const tree = R.unwrap(
    parseExpression('onCa || isOnList("Volunteers")', {
      catalog,
      named: [onCa],
    }),
  );
  expect([...reads(tree, [onCa]).lists].sort()).toEqual([
    "list-ca",
    "list-vol",
  ]);
});

test("evaluating a list read asks the host, and a removed list is an error", () => {
  const bindings = {
    catalog,
    named: [],
    readInput: () => R.success(null),
    callFunction: () => R.success(null),
    isOnList: (listId: string) => R.success(listId === "list-vol"),
  };
  const run = (text: string) => evaluate(R.unwrap(parse(text)), bindings);
  expect(run('isOnList("Volunteers")')).toEqual(R.success(true));
  expect(run('!isOnList("California targets")')).toEqual(R.success(true));
  expect(
    evaluate({ kind: ExprKind.OnList, listId: "list-gone" }, bindings),
  ).toMatchObject({ ok: false, error: { message: REMOVED_LIST } });
});

test("a formula can't be called isOnList", () => {
  const result = checkNamedSave({
    catalog,
    named: [],
    save: [{ id: "f1", name: "isOnList", source: "true" }],
  });
  expect(result).toEqual(
    R.failure([
      {
        kind: SaveProblemKind.Name,
        id: "f1",
        message:
          "`isOnList` is already used by the language. Pick another name.",
      },
    ]),
  );
});

const onCa = {
  id: "f1",
  name: "onCa",
  tree: R.unwrap(parse('isOnList("California targets")')),
};
const other = { id: "f2", name: "big", tree: R.unwrap(parse("total > 5")) };

test("deleting a list blocks on each formula that reads it, printed with its old name", () => {
  expect(
    checkNamedSave({
      catalog: { ...catalog, lists: [volunteers] },
      named: [onCa, other],
      save: [],
      deletedLists: [california],
    }),
  ).toEqual(
    R.failure([
      {
        kind: SaveProblemKind.Named,
        id: "f1",
        text: 'isOnList("California targets")',
        diagnostics: [
          {
            message: REMOVED_LIST,
            start: 0,
            end: 'isOnList("California targets")'.length,
          },
        ],
      },
    ]),
  );
});

test("deleting a list blocks on a form rule or split reading it, directly or through a formula", () => {
  const rule = (id: string, text: string) => ({
    id,
    stored: R.unwrap(parseExpression(text, { catalog, named: [onCa] })),
    rule: condition,
  });
  const result = checkNamedSave({
    catalog: { ...catalog, lists: [volunteers] },
    named: [onCa],
    dependents: [
      rule("direct", 'isOnList("California targets")'),
      rule("through", "onCa"),
    ],
    save: [],
    deletedLists: [california],
  });
  expect(result).toMatchObject({
    ok: false,
    error: [
      { kind: SaveProblemKind.Named, id: "f1" },
      {
        kind: SaveProblemKind.Dependent,
        id: "direct",
        text: 'isOnList("California targets")',
        diagnostics: [{ message: REMOVED_LIST }],
      },
    ],
  });
  expect(result.ok ? [] : result.error).toHaveLength(2);
});

test("a list in deletedLists must be gone from the catalog", () => {
  expect(() =>
    checkNamedSave({
      catalog,
      named: [],
      save: [],
      deletedLists: [california],
    }),
  ).toThrow("A list in `deletedLists` is still in `catalog.lists`.");
});

test("two lists sharing a name are refused", () => {
  const twice = {
    catalog: {
      ...catalog,
      lists: [california, { ...california, id: "list-ca2" }],
    },
    named: [],
  };
  expect(() =>
    parseExpression('isOnList("California targets")', twice),
  ).toThrow("Two lists in `catalog.lists` share a name.");
});

test("a list can be deleted together with a fix to the formula reading it", () => {
  expect(
    checkNamedSave({
      catalog: { ...catalog, lists: [volunteers] },
      named: [onCa, other],
      save: [{ id: "f1", name: "onCa", source: 'isOnList("Volunteers")' }],
      deletedLists: [california],
    }),
  ).toMatchObject({ ok: true });
});

test("re-checking a stored formula that reads a list gone without a trace reports it", () => {
  expect(
    checkStored({
      catalog,
      named: [
        {
          id: "f1",
          name: "gone",
          tree: { kind: ExprKind.OnList, listId: "list-gone" },
        },
      ],
    }),
  ).toEqual(
    R.failure([
      {
        kind: SaveProblemKind.Named,
        id: "f1",
        text: 'isOnList("list-gone")',
        diagnostics: [
          {
            message: REMOVED_LIST,
            start: 0,
            end: 'isOnList("list-gone")'.length,
          },
        ],
      },
    ]),
  );
});
