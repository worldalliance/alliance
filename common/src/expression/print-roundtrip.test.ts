import { R } from "../result";
import { TypeKind, type Scope } from "./catalog";
import { TYPE_ARGUMENTS } from "./convert";
import { parseExpression } from "./parse";
import { printExpression } from "./print";
import { BinaryOp, ExprKind, UnaryOp, type Expr } from "./tree";

const scope: Scope = {
  catalog: {
    inputs: [
      { id: "count", label: "Count", type: { kind: TypeKind.Number } },
      {
        id: "items",
        label: "Items",
        type: { kind: TypeKind.List, item: { kind: TypeKind.Number } },
      },
    ],
    functions: [
      {
        name: "lookup",
        params: [{ name: "value", type: { kind: TypeKind.Number } }],
        returns: { kind: TypeKind.Number },
      },
    ],
    lists: [
      { id: "l1", name: "Volunteers" },
      { id: "l2", name: 'a "quoted" \\ café' },
    ],
  },
  named: [
    { id: "r1", name: "sum", tree: { kind: ExprKind.Literal, value: 1 } },
  ],
};
const names = {
  refName: (id: string) => scope.named.find((named) => named.id === id)?.name,
  listName: (id: string) =>
    scope.catalog.lists.find((list) => list.id === id)?.name,
};

function randomTrees({ misread }: { misread: boolean }) {
  let seed = 7;
  const pick = (choices: number) => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return (seed >>> 16) % choices;
  };
  const ops = Object.values(BinaryOp);
  const ORDERING = [
    BinaryOp.LessThan,
    BinaryOp.GreaterThan,
    BinaryOp.LessOrEqual,
    BinaryOp.GreaterOrEqual,
  ];
  const texts = ["", "x", "`", "${", "\\", "\n", "\r", "\u2028", "café"];
  const text = () => texts[pick(texts.length)];
  const leaves: Expr[] = [
    { kind: ExprKind.Input, id: "count" },
    { kind: ExprKind.Ref, id: "r1" },
    { kind: ExprKind.Literal, value: 1 },
    { kind: ExprKind.Literal, value: 0.5 },
    { kind: ExprKind.Literal, value: true },
    { kind: ExprKind.Literal, value: false },
    { kind: ExprKind.Literal, value: null },
    { kind: ExprKind.OnList, listId: "l1" },
    { kind: ExprKind.OnList, listId: "l2" },
  ];
  const properties = ["name", "type", "class", "of", "new", "café"];
  const keys = ["a", "b c", "class", "1", "", "café", "😀"];
  const generate = (depth: number, params: readonly string[]): Expr => {
    const next = () => generate(depth - 1, params);
    const several = () => Array.from({ length: pick(4) }, next);
    switch (depth <= 0 ? pick(3) : pick(16)) {
      case 0:
        return leaves[pick(leaves.length)];
      case 1:
        return params.length > 0
          ? { kind: ExprKind.Param, name: params[pick(params.length)] }
          : leaves[0];
      case 2:
        return { kind: ExprKind.Literal, value: text() };
      case 3:
      case 4: {
        const left = next();
        const right = next();
        // The parser rejects a comparison inside `<`, `>`, `<=` or `>=`.
        const nested = [left, right].some(
          (side) => side.kind === ExprKind.Binary && ORDERING.includes(side.op),
        );
        // The parser rejects text TypeScript misreads as type arguments,
        // which a `>` anywhere right of a `<` can be.
        const typeArguments =
          !misread &&
          JSON.stringify(right).includes(`"op":"${BinaryOp.GreaterThan}"`);
        const allowed = ops.filter(
          (op) =>
            !(nested && ORDERING.includes(op)) &&
            !(typeArguments && op === BinaryOp.LessThan),
        );
        // Biased so over a tenth of the trees print a `>` right of a `<`.
        const angles = allowed.filter(
          (op) => op === BinaryOp.LessThan || op === BinaryOp.GreaterThan,
        );
        const choices =
          misread && angles.length > 0 && pick(2) === 0 ? angles : allowed;
        return {
          kind: ExprKind.Binary,
          op: choices[pick(choices.length)],
          left,
          right,
        };
      }
      case 5:
        return {
          kind: ExprKind.Conditional,
          test: next(),
          consequent: next(),
          alternate: next(),
        };
      case 6:
        return { kind: ExprKind.List, items: several() };
      case 7:
        return {
          kind: ExprKind.Unary,
          op: pick(2) === 0 ? UnaryOp.Not : UnaryOp.Negate,
          operand: next(),
        };
      case 8: {
        const parts = Array.from({ length: pick(3) }, next);
        return {
          kind: ExprKind.Template,
          quasis: [text(), ...parts.map(text)],
          parts,
        };
      }
      case 9:
        return {
          kind: ExprKind.Member,
          target: next(),
          property: properties[pick(properties.length)],
          optional: pick(2) === 0,
        };
      case 10:
        return {
          kind: ExprKind.Index,
          target: next(),
          index: next(),
          optional: pick(2) === 0,
        };
      case 11:
        return {
          kind: ExprKind.Record,
          entries: [
            ...new Set(
              Array.from({ length: pick(3) }, () => keys[pick(keys.length)]),
            ),
          ].map((key) => ({ key, value: next() })),
        };
      case 12:
        return {
          kind: ExprKind.Call,
          fn: ["lookup", "isMissing", "Math.abs"][pick(3)],
          args: [next()],
        };
      case 13:
        return {
          kind: ExprKind.Method,
          target: next(),
          method: "map",
          optional: pick(2) === 0,
          args: [{ kind: ExprKind.Lambda, params: [], body: next() }],
        };
      default:
        return {
          kind: ExprKind.Method,
          target: { kind: ExprKind.Input, id: "items" },
          method: "reduce",
          optional: false,
          args: [
            {
              kind: ExprKind.Lambda,
              params: ["total", "item"],
              body: generate(depth - 1, ["total", "item"]),
            },
            next(),
          ],
        };
    }
  };
  return () => generate(4, []);
}

test("parsing printed random trees gives the same trees back", () => {
  const next = randomTrees({ misread: false });
  for (let run = 0; run < 10000; run += 1) {
    const tree = next();
    const printed = printExpression(tree, names);
    expect({ printed, parsed: parseExpression(printed, scope) }).toEqual({
      printed,
      parsed: R.success(tree),
    });
  }
}, 20_000);

test("printed random trees with `>` right of `<` parse back unless TypeScript misreads a `<`", () => {
  const next = randomTrees({ misread: true });
  let shaped = 0;
  for (let run = 0; run < 10000; run += 1) {
    const tree = next();
    const printed = printExpression(tree, names);
    const parsed = parseExpression(printed, scope);
    if (/<.*>/s.test(printed)) shaped += 1;
    if (parsed.ok) {
      expect({ printed, parsed: parsed.value }).toEqual({
        printed,
        parsed: tree,
      });
    } else {
      expect({
        printed,
        error: parsed.error.map(({ message }) => message),
      }).toEqual({ printed, error: [TYPE_ARGUMENTS] });
    }
  }
  expect(shaped).toBeGreaterThan(1000);
}, 20_000);

test("the name lookup gets the parameters of every function around a reference", () => {
  const ref = (id: string): Expr => ({ kind: ExprKind.Ref, id });
  const call = (args: Expr[]): Expr => ({
    kind: ExprKind.Call,
    fn: "lookup",
    args,
  });
  const tree = call([
    ref("outside"),
    {
      kind: ExprKind.Lambda,
      params: ["a"],
      body: call([
        ref("outer"),
        {
          kind: ExprKind.Lambda,
          params: ["b", "c"],
          body: call([
            ref("inner"),
            { kind: ExprKind.Template, quasis: ["", ""], parts: [ref("part")] },
            {
              kind: ExprKind.Index,
              target: ref("target"),
              index: ref("index"),
              optional: false,
            },
            {
              kind: ExprKind.Binary,
              op: BinaryOp.LessThan,
              left: ref("closed"),
              right: ref("compared"),
            },
            ref("last"),
          ]),
        },
      ]),
    },
    ref("sibling"),
  ]);
  const seen = new Map<string, string[]>();
  printExpression(tree, {
    refName: (id, params) => {
      seen.set(id, [...params]);
      return id;
    },
    listName: () => undefined,
  });
  expect(Object.fromEntries(seen)).toEqual({
    outside: [],
    outer: ["a"],
    ...Object.fromEntries(
      ["inner", "part", "target", "index", "closed", "compared", "last"].map(
        (id) => [id, ["a", "b", "c"]],
      ),
    ),
    sibling: [],
  });
});
