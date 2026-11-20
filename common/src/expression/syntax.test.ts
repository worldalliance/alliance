import ts from "typescript";
import { R } from "../result";
import { TYPE_ARGUMENTS, convertExpression } from "./convert";
import { parseExpression } from "./parse";
import { printExpression } from "./print";
import { scope } from "./syntax-test-support";
import { ExprKind, LAMBDA_ONLY_AS_ARGUMENT, children, type Expr } from "./tree";

const NESTED_ORDERING =
  "`<`, `>`, `<=` and `>=` can't compare the yes/no result of another comparison.";

const names = {
  refName: (id: string) => scope.named.find((named) => named.id === id)?.name,
};

const roundTrip = (text: string) =>
  printExpression(R.unwrap(parseExpression(text, scope)), names);

const errorsOf = (text: string) => {
  const parsed = parseExpression(text, scope);
  if (parsed.ok) throw new Error(`expected ${text} to fail`);
  return parsed.error.map(({ message, start, end }) => ({
    message,
    text: text.slice(start, end),
  }));
};

describe("printing parsed text", () => {
  test.each([
    'state === "CA"',
    'state !== "CA" && count > 5 || isCalifornia',
    "count ?? 1",
    "count ?? (isCalifornia ? 1 : 2)",
    '(state === "CA" || isCalifornia) && count > 1',
    "isMissing(count) ? null : count > 5",
    "(-2) ** 2",
    "-(-count)",
    "count - (1 - 2)",
    "count / 2 * 3 % 4",
    'items.some(item => item.name === "x")',
    "items.map((item, index) => ({ name: item.name, index }))",
    "items[0]?.name",
    "items?.[count]",
    'items.at(-1)?.name ?? "none"',
    '`Hi ${state ?? "there"}, \\` \\${x} done`',
    "`plain`",
    "Math.round(count * 100) / 100",
    "(1).toFixed(2)",
    "lookup()",
    '["CA", "NY"].includes(state)',
    '({ a: 1, "b c": [] }).a',
    "items.map(x => ({ a: x }).a)",
    'items.map(x => ({ a: x }).a === "q")',
    'items.map(x => ({ a: x })["a"])',
    "items.map(x => ({ a: x }).a ? 1 : 2)",
    '({ "\u{1E5D0}": 1, café: 2 }).café',
    '"\\uD83D\\uDE00"',
    "[(count < 1), count > (count ?? 0)]",
    "lookup((count < 1), count > `x`)",
    "(count < 1) === (count >= 1)",
    "items.reduce((total, x) => (total < count), count > (count ?? 0))",
  ])("%s", (text) => {
    const printed = roundTrip(text);
    expect(R.unwrap(parseExpression(printed, scope))).toEqual(
      R.unwrap(parseExpression(text, scope)),
    );
    expect(roundTrip(printed)).toBe(printed);
  });

  test("keeps canonical text unchanged", () => {
    for (const text of [
      'state === "CA"',
      '(state !== "CA" && count > 5) || isCalifornia',
      "isMissing(count) ? null : count > 5",
      "(-count) ** 2",
      'items.some(item => item.name === "x")',
      "items.map((item, index) => ({ name: item.name, index: index }))",
      "items[0].café",
      "items[0]?.café",
      "[(count < 1), count > (count ?? 0)]",
      "items.some(x => x.name < state)",
    ]) {
      expect(roundTrip(text)).toBe(text);
    }
  });

  test("refuses to print a field that isn't an identifier", () => {
    expect(() =>
      printExpression(
        {
          kind: ExprKind.Member,
          target: { kind: ExprKind.Input, id: "items" },
          property: "a b",
          optional: false,
        },
        names,
      ),
    ).toThrow("member property isn't an identifier: a b");
  });

  test("refuses to print a reference to a missing named expression", () => {
    expect(() =>
      printExpression({ kind: ExprKind.Ref, id: "count" }, names),
    ).toThrow("no name for named expression count");
  });

  test.each(["0.50", "5e-1", "1_000.25", "0x1F", "1.5e-7", "0.0"])(
    "keeps the number %s, which a double holds exactly",
    (text) => {
      expect(R.unwrap(parseExpression(text, scope))).toEqual({
        kind: ExprKind.Literal,
        value: Number(text.replaceAll("_", "")),
      });
    },
  );

  test.each([-1, -0, Infinity, NaN])(
    "refuses to print the number %p, which text can't write",
    (value) => {
      expect(() =>
        printExpression({ kind: ExprKind.Literal, value }, names),
      ).toThrow("number literal text can't write");
    },
  );

  test("breaks long chains one operand per line", () => {
    const text = Array.from({ length: 6 }, (_, i) => `state === "S${i}"`).join(
      " || ",
    );
    expect(roundTrip(text)).toBe(
      [
        'state === "S0"',
        ...Array.from({ length: 5 }, (_, i) => `  || state === "S${i + 1}"`),
      ].join("\n"),
    );
  });

  test("keeps the separator after a flat group within 80 columns", () => {
    for (let length = 50; length <= 74; length += 1) {
      const text = `["${"a".repeat(length)}" === state && true, state]`;
      for (const printed of roundTrip(text).split("\n")) {
        expect(printed.length).toBeLessThanOrEqual(80);
      }
    }
  });

  test("measures a line from a template's last line break", () => {
    const text = `\`${"a".repeat(70)}\n\${state}\` === state && state === "x"`;
    expect(roundTrip(text)).toBe(text);
  });

  test("stores a negative number as `-` applied to it", () => {
    const tree = R.unwrap(parseExpression("-1", scope));
    expect(tree).toMatchObject({ kind: ExprKind.Unary });
  });
});

const UNSTORABLE = "This text has a character that can't be stored.";
const CHAIN_PARENS = "Remove the parentheses around this `?.` chain.";

describe("parse errors", () => {
  test.each([
    ["state == null", "Use isMissing(…) to test for a missing value.", "=="],
    ["state == (null)", "Use isMissing(…) to test for a missing value.", "=="],
    [
      "((null)) != state",
      "Use isMissing(…) to test for a missing value.",
      "!=",
    ],
    ["state != 'CA'", "Use `!==`; `!=` isn't supported.", "!="],
    ["(count < 1) > (count >= 1)", NESTED_ORDERING, ">"],
    ["count < (-(1) > `x`)", NESTED_ORDERING, "<"],
    [
      "undefined",
      "`undefined` isn't supported. Use isMissing(…) to test for a missing value.",
      "undefined",
    ],
    [
      "count!",
      "`!` after a value isn't supported. Use isMissing(…) to test for a missing value.",
      "count!",
    ],
    ["stat", "Nothing here is called `stat`.", "stat"],
    ["nope()", "There's no function called `nope`.", "nope"],
    [
      "items.map(isMissing => isMissing(1))",
      "`isMissing` is a parameter, not a function.",
      "isMissing",
    ],
    [
      "items.map(lookup => lookup())",
      "`lookup` is a parameter, not a function.",
      "lookup",
    ],
    ["state.big()", "There's no method called `big`.", "big"],
    ["Math.random()", "There's no function `Math.random`.", "random"],
    ["items.constructor", "`constructor` can't be read.", "constructor"],
    ['items["__proto__"]', "`__proto__` can't be read.", '"__proto__"'],
    [
      'items[(("constructor"))]',
      "`constructor` can't be read.",
      '"constructor"',
    ],
    ["items?.[(`prototype`)]", "`prototype` can't be read.", "`prototype`"],
    [
      "({ __proto__: 1 })",
      "`__proto__` can't be used as a key.",
      "__proto__: 1",
    ],
    [
      '({ "constructor": 1 })',
      "`constructor` can't be used as a key.",
      '"constructor": 1',
    ],
    ["({ prototype })", "`prototype` can't be used as a key.", "prototype"],
    ["lookup", "`lookup` is a function; call it with (…).", "lookup"],
    ["isMissing", "`isMissing` is a function; call it with (…).", "isMissing"],
    ["x => 1", LAMBDA_ONLY_AS_ARGUMENT, "x => 1"],
    ["isMissing(() => 1)", LAMBDA_ONLY_AS_ARGUMENT, "() => 1"],
    ["items.some(x => true, () => 1)", LAMBDA_ONLY_AS_ARGUMENT, "() => 1"],
    [
      "lookup(count < 1, count > (2))",
      TYPE_ARGUMENTS,
      "count < 1, count > (2)",
    ],
    [
      "items.map(async x => x)",
      "`async x => x` isn't supported in expressions.",
      "async x => x",
    ],
    [
      "items.map(<T>(x) => x)",
      "`<T>(x) => x` isn't supported in expressions.",
      "<T>(x) => x",
    ],
    ["items.map((x?) => x)", "`x?` isn't supported in expressions.", "x?"],
    [
      "items.map((this) => 1)",
      "`this` isn't supported in expressions.",
      "this",
    ],
    [
      "items.map((\\u0074his) => 1)",
      "`\\u0074his` isn't supported in expressions.",
      "\\u0074his",
    ],
    ["count < items[0] > (1)", TYPE_ARGUMENTS, "count < items[0] > (1)"],
    ["count < 1 > `x`", TYPE_ARGUMENTS, "count < 1 > `x`"],
    [
      "count < ({ a: (items).filter(x => x > (count ?? 0)).length }).a",
      TYPE_ARGUMENTS,
      "count < ({ a: (items).filter(x => x > (count ?? 0)).length }).a",
    ],
    [
      "count < { a: count > (1) }.a",
      TYPE_ARGUMENTS,
      "count < { a: count > (1) }.a",
    ],
    [
      "count < [count > (1)].length",
      TYPE_ARGUMENTS,
      "count < [count > (1)].length",
    ],
    [
      "count < (count > (1)).length",
      TYPE_ARGUMENTS,
      "count < (count > (1)).length",
    ],
    ["Math.abs", "Call `Math.abs(…)`.", "Math.abs"],
    ["Math.PI", "There's no `Math.PI`.", "Math.PI"],
    ["1e999 > 1", "This number is too large.", "1e999"],
    ["9007199254740993", "This number is too large.", "9007199254740993"],
    [
      "1.00000000000000001",
      "This number has more digits than can be stored.",
      "1.00000000000000001",
    ],
    [
      "4503599627370496.5",
      "This number has more digits than can be stored.",
      "4503599627370496.5",
    ],
    ['"a\\u0000b"', UNSTORABLE, '"a\\u0000b"'],
    ["`a${count}\\0`", UNSTORABLE, "}\\0`"],
    ["`\\0${count}`", UNSTORABLE, "`\\0${"],
    ['({ "\\0": 1 })', UNSTORABLE, '"\\0"'],
    ['"\\uD800"', UNSTORABLE, '"\\uD800"'],
    ["`a\\uDC00`", UNSTORABLE, "`a\\uDC00`"],
    ['({ "\\uD800": 1 })', UNSTORABLE, '"\\uD800"'],
    ["count | 1", "`count | 1` isn't supported in expressions.", "count | 1"],
    [
      "({ count = 5 })",
      "`count = 5` isn't supported in expressions.",
      "count = 5",
    ],
    [
      "count ?? 1 || 2",
      "`??` and `||` can't be mixed without parentheses.",
      "||",
    ],
    [
      "count > 1 && count ?? false",
      "`??` and `&&` can't be mixed without parentheses.",
      "??",
    ],
    ["[...items]", "`...items` isn't supported in expressions.", "...items"],
    ["[, 1]", "A list can't have an empty item.", ","],
    ["[1, , 2]", "A list can't have an empty item.", ","],
    [
      "items.some(undefined => true)",
      "`undefined` isn't supported. Use isMissing(…) to test for a missing value.",
      "undefined",
    ],
    [
      "typeof count",
      "`typeof count` isn't supported in expressions.",
      "typeof count",
    ],
    [
      "count as number",
      "`count as number` isn't supported in expressions.",
      "count as number",
    ],
    ["({ a?: 1 })", "`a?: 1` isn't supported in expressions.", "a?: 1"],
    ["({ a!: 1 })", "`a!: 1` isn't supported in expressions.", "a!: 1"],
    [
      "({ readonly a: 1 })",
      "`readonly a: 1` isn't supported in expressions.",
      "readonly a: 1",
    ],
    ["({ count? })", "`count?` isn't supported in expressions.", "count?"],
    [
      "items.map((public x) => x)",
      "`public x` isn't supported in expressions.",
      "public x",
    ],
    ["items.reduce((a, a) => a, 0)", "`a` is already a parameter.", "a"],
    ["items.map(let => 1)", "`let` can't name a parameter.", "let"],
    ["items.map((yield) => 1)", "`yield` can't name a parameter.", "yield"],
    [
      "items.map((await) => (await) ** 2)",
      "`await` can't name a parameter.",
      "await",
    ],
    ["items.map(eval => 1)", "`eval` can't name a parameter.", "eval"],
    [
      "items.map(arguments => 1)",
      "`arguments` can't name a parameter.",
      "arguments",
    ],
    ["(items?.[0]).name", CHAIN_PARENS, "(items?.[0])"],
    ["(state?.length)[0]", CHAIN_PARENS, "(state?.length)"],
    ["((state?.trim()))?.trim()", CHAIN_PARENS, "((state?.trim()))"],
  ])("%s", (text, message, at) => {
    expect(errorsOf(text)).toContainEqual({ message, text: at });
  });

  test("parses without `ts.sys`, as in a browser", () => {
    const sys = ts.sys;
    Reflect.set(ts, "sys", undefined);
    try {
      expect(roundTrip("count > 1")).toBe("count > 1");
      expect(errorsOf("count >")[0].message).toBe("Expression expected.");
    } finally {
      Reflect.set(ts, "sys", sys);
    }
  });

  test("reports syntax errors in the admin's text", () => {
    expect(errorsOf("count >")[0].message).toBe("Expression expected.");
  });

  test.each([
    ["count; state", "Write a single expression.", "count; state"],
    ["count;", "Remove the `;`.", ";"],
    ["count ;  ", "Remove the `;`.", ";"],
    ["let x = 1;", "Write a single expression.", "let x = 1;"],
    ["count) || (state", "This `)` has no matching `(`.", ")"],
    ["count)", "This `)` has no matching `(`.", ")"],
    ["count / 2)", "This `)` has no matching `(`.", ")"],
    ["count 1", "Write a single expression.", "count 1"],
    ["count 1 2", "Write a single expression.", "count 1 2"],
    ["[1, 2", "']' expected.", ""],
    ["f(1", "')' expected.", ""],
    ["count +", "Expression expected.", ""],
  ])("%s isn't blamed on the parentheses around it", (text, message, at) => {
    expect(errorsOf(text)).toEqual([{ message, text: at }]);
  });

  test.each([
    ["[  , 1]", "A list can't have an empty item.", 3],
    ["`)${count})`)", "This `)` has no matching `(`.", 12],
  ])("%s is located past spaces and template text", (text, message, start) => {
    expect(parseExpression(text, scope)).toEqual(
      R.failure([{ message, start, end: start + 1 }]),
    );
  });

  test.each([
    ["count > 5 // adults only", "// adults only"],
    ["count; // note", "// note"],
    ["[/*,*/, 1]", "/*,*/"],
    ['// @ts-ignore\n"a" - 1', "// @ts-ignore"],
    ["`${count} // not a comment` /*@ts-nocheck*/", "/*@ts-nocheck*/"],
    ["count.type / 2 // c\n  + count", "// c"],
    ["items.map(of => of / 2 /* c */ + 1)", "/* c */"],
  ])("the comment in %s is rejected", (text, at) => {
    expect(errorsOf(text)).toEqual([
      {
        message: "Expressions can't keep comments. Remove this one.",
        text: at,
      },
    ]);
  });

  test.each(["count < (count > (count ?? 1))", "/\\)/"])(
    "a `)` in %s isn't reported as unmatched",
    (text) => {
      expect(errorsOf(text).map(({ message }) => message)).not.toContain(
        "This `)` has no matching `(`.",
      );
    },
  );
});

test.each([
  ["count.type / 2 + (count / 3)", "count.type / 2 + count / 3"],
  ["items.map(of => of / 2 + (of / 3))", "items.map(of => of / 2 + of / 3)"],
])("a `/` after a keyword in %s divides", (text, printed) => {
  expect(roundTrip(text)).toBe(printed);
});

test("conversion maps every node to its source, parentheses included", () => {
  const text =
    "((count + 1) > 1 ? `x${state}` : items.map((x) => (x.name))[0]) ?? [-count, { count, a: (!isCalifornia) }][0]";
  const file = ts.createSourceFile("/t.ts", text, ts.ScriptTarget.ES2020, true);
  const [statement] = file.statements;
  if (statement === undefined || !ts.isExpressionStatement(statement)) {
    throw new Error("expected an expression statement");
  }
  const { tree, source } = R.unwrap(
    convertExpression({ node: statement.expression, file, scope }),
  );
  const nodes: Expr[] = [];
  const walk = (expr: Expr) => {
    nodes.push(expr);
    children(expr).forEach(walk);
  };
  walk(tree);
  expect(nodes.filter((node) => !source.has(node))).toEqual([]);
  expect(source.size).toBe(nodes.length);
  const texts = nodes.map((node) => source.get(node)?.getText(file));
  expect(texts).toEqual([
    text,
    "((count + 1) > 1 ? `x${state}` : items.map((x) => (x.name))[0])",
    "(count + 1) > 1",
    "(count + 1)",
    "count",
    "1",
    "1",
    "`x${state}`",
    "state",
    "items.map((x) => (x.name))[0]",
    "items.map((x) => (x.name))",
    "items",
    "(x) => (x.name)",
    "(x.name)",
    "x",
    "0",
    "[-count, { count, a: (!isCalifornia) }][0]",
    "[-count, { count, a: (!isCalifornia) }]",
    "-count",
    "count",
    "{ count, a: (!isCalifornia) }",
    "count",
    "(!isCalifornia)",
    "isCalifornia",
    "0",
  ]);
});
