import { R } from "../result";
import { type Value } from "./catalog";
import { failureOf, run, valueOf } from "./evaluate-test-support";
import { FailureKind } from "./failure";

describe("reads", () => {
  test.each<[string, Value]>([
    ["items[5]", null],
    ["items.at(-1).name", "b"],
    ['items.find(item => item.name === "z")', null],
    ["items.length", 2],
    [
      'items.filter(item => (item.score === 3) ?? false).map(item => item.name).join(",")',
      "a",
    ],
    ["items.map(item => item.score ?? 0).reduce((a, b) => a + b, 0)", 3],
    ['["b", "a"].sort()', ["a", "b"]],
    ["[1, 2].flatMap(n => [n, n])", [1, 1, 2, 2]],
    ["[[1], [2, 3]].flat()", [1, 2, 3]],
    ["items.sort((a, b) => a.score - b.score)", null],
    ["[3, 1, 4, 1, 5, 9, 2].sort((a, b) => a - b)", [1, 1, 2, 3, 4, 5, 9]],
    ['({ "1": "x" })[1]', "x"],
    ['({ a: 1, b: "x" })', { a: 1, b: "x" }],
    ["(1.234).toFixed(1)", "1.2"],
    ["Math.max(1, count, 3)", 7],
    ["Math.pow(2, 3)", 8],
    ["`${count} items`", "7 items"],
  ])("%s → %p", (text, expected) => {
    expect(valueOf(text)).toEqual(expected);
  });

  test("an undecided predicate follows three-valued rules over the items", () => {
    expect(valueOf("items.some(item => item.score === 3)")).toBe(true);
    expect(valueOf("items.some(item => item.score === 4)")).toBe(null);
    expect(valueOf("items.every(item => item.score === 4)")).toBe(false);
    expect(valueOf("items.every(item => item.score === 3)")).toBe(null);
    expect(valueOf("items.filter(item => item.score === 3)")).toBe(null);
    expect(
      valueOf("items.find(item => (item.score === 3) ?? false)?.name"),
    ).toBe("a");
  });

  test.each<[string, Value]>([
    ["[3, count].findIndex(x => x === 3)", 0],
    ["[3, count].find(x => x === 3)", 3],
    ["[count, 3].findIndex(x => x === 3)", null],
    ["[count, 3].findLastIndex(x => x === 3)", 1],
    ["[count, 3].findLast(x => x === 3)", 3],
    ["[3, count].findLastIndex(x => x === 3)", null],
    ["[count].findIndex(x => x === 3)", null],
  ])("with count unknown, %s → %p", (text, expected) => {
    expect(valueOf(text, { count: null })).toEqual(expected);
  });

  test("a predicate runs on every item, so an error on a later one fails the call", () => {
    expect(
      run('items.some(item => item.name === "a" || item.missing === 1)'),
    ).toEqual(
      R.failure({
        kind: FailureKind.Error,
        message: "There's no field `missing` here.",
      }),
    );
  });

  test("sort does not change the input", () => {
    const list = ["b", "a"];
    expect(valueOf("tags.sort()", { tags: list })).toEqual(["a", "b"]);
    expect(list).toEqual(["b", "a"]);
  });
});

describe("operators", () => {
  test.each<[string, Value]>([
    ["count - 2", 5],
    ["count * 2", 14],
    ["count / 2", 3.5],
    ["count % 3", 1],
    ["2 ** 3", 8],
    ["count > 6", true],
    ["count > 7", false],
    ["count < 8", true],
    ["count < 7", false],
    ["count >= 7", true],
    ["count >= 8", false],
    ["count <= 7", true],
    ["count <= 6", false],
    ['"a" < "b"', true],
    ['"b" < "a"', false],
    ['"n" + 1 + true', "n1true"],
    ["!false", true],
    ['true || state === "CA"', true],
    ["false ? 1 : 2", 2],
    ['state === "CA" ? 1 : 2', null],
    ['({ a: 1 })["a"]', 1],
    ['"abc"[1]', "b"],
    ['"abc"["length"]', 3],
    ['items["length"]', 2],
    ['tags["1"]', "y"],
    ['"abc"["0"]', "a"],
    ["isMissing(state) ? 0 : 1", 0],
  ])("%s → %p", (text, expected) => {
    expect(valueOf(text)).toEqual(expected);
  });

  test.each([
    ['"a" < 1', "< compares two numbers or two pieces of text."],
    [
      "items[0] === items[1]",
      "Only text, numbers and yes/no values can be compared.",
    ],
    ["items + 1", "+ needs numbers or text."],
    ["Math.pow(10, 308) + Math.pow(10, 308)", "+ didn't give a finite number."],
    ['"a" - 1', "- needs numbers."],
    ["!count", "! needs a yes/no value."],
    ['-"a"', "- needs a number."],
    ["count && true", "&& needs yes/no values."],
    ["true && count", "&& needs yes/no values."],
    ["false || count", "|| needs yes/no values."],
    ["count ? 1 : 2", "A ? test needs a yes/no value."],
    ["items[0.5]", "A position must be a whole number."],
    ["count[0]", "This value can't be read by position or key."],
    ["count[state]", "This value can't be read by position or key."],
    ["count.size", "`size` can't be read from this value."],
    [
      "`${items}`",
      "Only text, numbers and yes/no values can be shown in text.",
    ],
    [
      "`${state} ${items}`",
      "Only text, numbers and yes/no values can be shown in text.",
    ],
    ["count.includes(1)", "`includes` can't be called on this value."],
    ["count.includes(state)", "`includes` can't be called on this value."],
    ['"a".includes(item => true)', "`includes` doesn't take a function."],
    ["state.includes(item => true)", "`includes` doesn't take a function."],
    [
      '"a".includes((item) => true, state)',
      "`includes` doesn't take a function.",
    ],
    [
      '"a".concat(tags)',
      "`concat` takes only text, numbers and yes/no values.",
    ],
    [
      "(1).toFixed(items[0])",
      "`toFixed` takes only text, numbers and yes/no values.",
    ],
    ["tags.join(tags)", "`join` takes only text, numbers and yes/no values."],
    [
      'tags.indexOf("x", items[0])',
      "`indexOf` takes only text, numbers and yes/no values.",
    ],
    [
      "state.startsWith(items[0])",
      "`startsWith` takes only text, numbers and yes/no values.",
    ],
    [
      "state.includes(items[0])",
      "Only text, numbers and yes/no values can be compared.",
    ],
    ["state[true]", "This value can't be read by position or key."],
    ["double()", "double takes 1 value."],
    ["half(1, 2)", "half takes 1 value."],
    [
      "items.sort(() => true)",
      "The function passed to `sort` has to give a number.",
    ],
    [
      "items.some(() => 1)",
      "The function passed to `some` has to give yes or no.",
    ],
  ])("%s fails", (text, message) => {
    expect(failureOf(text)).toEqual({ kind: FailureKind.Error, message });
  });

  test.each([
    ["({ a: 1 })[state]", "There's no field with this key here."],
    ['"abc"[state]', "This value has no field with this key."],
  ])("%s fails without the key, which is member data", (text, message) => {
    expect(run(text, { overrides: { state: "Jane Doe" } })).toEqual(
      R.failure({ kind: FailureKind.Error, message }),
    );
  });

  test.each<[string, Value[], Value]>([
    ['names.join(", ")', ["a", null], null],
    ['names.join(", ")', ["a", "b"], "a, b"],
    ['names.sort()[0] === "b"', ["b", null], null],
    ["names.sort()", ["b", "a"], ["a", "b"]],
    ["names.concat(state)", ["a"], ["a", null]],
  ])("%s over %p → %p", (text, names, expected) => {
    expect(valueOf(text, { names })).toEqual(expected);
  });

  test.each([
    [
      "items.join()",
      "Only text, numbers and yes/no values can be shown in text.",
    ],
    [
      "items.includes(items[0])",
      "Only text, numbers and yes/no values can be compared.",
    ],
    [
      "items.sort()",
      "Only text, numbers and yes/no values can be sorted without a function.",
    ],
    [
      "[[10], [9]].sort()",
      "Only text, numbers and yes/no values can be sorted without a function.",
    ],
    [
      "[[1]].indexOf([1])",
      "Only text, numbers and yes/no values can be compared.",
    ],
    [
      "[{ a: 1 }].lastIndexOf({ a: 1 })",
      "Only text, numbers and yes/no values can be compared.",
    ],
  ])("%s fails", (text, message) => {
    expect(failureOf(text)).toEqual({ kind: FailureKind.Error, message });
  });

  test.each<[string, Value]>([
    [
      "items.reduce((acc, item) => ({ total: acc.total + 1 }), { total: 0 })",
      { total: 2 },
    ],
    ["items.reduce((acc, item) => acc.concat([item.name]), [])", ["a", "b"]],
  ])("%s → %p", (text, expected) => {
    expect(valueOf(text)).toEqual(expected);
  });

  test.each([
    [
      "items[0] === items[5] || true",
      "Only text, numbers and yes/no values can be compared.",
    ],
    ["state < items[0]", "< compares two numbers or two pieces of text."],
    ["items + items[5]", "+ needs numbers or text."],
    ['state - "a"', "- needs numbers."],
    [
      '"a".concat(items[0], state)',
      "`concat` takes only text, numbers and yes/no values.",
    ],
    ['Math.max(state, "a")', "Math.max takes numbers."],
    ['add(state, "a")', "add b: expected number, got text"],
  ])("%s fails though an operand is unknown", (text, message) => {
    expect(failureOf(text)).toEqual({ kind: FailureKind.Error, message });
  });

  test("a host function's pending result is pending, and an error outranks it", () => {
    expect(failureOf("later() === 1 || true")).toEqual({
      kind: FailureKind.Pending,
      waitingOn: ["action:3"],
    });
    expect(failureOf('later() === 1 || broken === "y"')).toEqual({
      kind: FailureKind.Error,
      message: "read failed",
    });
  });

  test("sort makes every comparison, so an unknown one hides no failure", () => {
    const items = [
      { name: "a", score: 1 },
      { name: "b", score: null },
      { name: "c", score: 2 },
    ];
    const sorted = (fallback: string) =>
      run(
        `items.sort((a, b) => a.name === "c" || b.name === "c" ? ${fallback} : a.score - b.score)`,
        { overrides: { items } },
      );
    expect(sorted("later()")).toEqual(
      R.failure({ kind: FailureKind.Pending, waitingOn: ["action:3"] }),
    );
    expect(sorted("Math.log(-1)")).toEqual(
      R.failure({
        kind: FailureKind.Error,
        message: "Math.log didn't give a finite number.",
      }),
    );
    expect(sorted("0")).toEqual(R.success(null));
  });

  test("sort compares the same pairs on every engine", () => {
    // Native sort compares 1 with 6 on V8 and 20 with 22 on V8 and Bun; the
    // merge sort compares neither.
    const list = [
      0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 1, 3, 5, 7, 9, 11, 13, 15, 17,
      19, 21,
    ];
    const sorted = run(
      `[${list.join(", ")}].sort((a, b) => [a, b].includes(1) && [a, b].includes(6) || [a, b].includes(20) && [a, b].includes(22) ? Math.log(-1) : a - b)`,
    );
    expect(sorted).toEqual(R.success([...list].sort((a, b) => a - b)));
  });

  test("a host error inside a function argument isn't made an expression error", () => {
    expect(() => run("[1].map(x => boom())")).toThrow(
      new RangeError("host bug"),
    );
    expect(() => run("[1].map(x => [2].map(y => boom()))")).toThrow(
      new RangeError("host bug"),
    );
    expect(() => run("[2, 1].sort((a, b) => boom())")).toThrow(
      new RangeError("host bug"),
    );
    expect(() => run("[1].reduce((a, b) => boom(), 0)")).toThrow(
      new RangeError("host bug"),
    );
  });

  test("a native method's error is the same text on every engine", () => {
    expect(failureOf('"a".repeat(-1)')).toEqual({
      kind: FailureKind.Error,
      message: "`repeat` couldn't run with these values.",
    });
  });
});
