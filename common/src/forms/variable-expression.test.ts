import { R } from "../result";
import {
  compileVariableExpression,
  evaluateVariableExpression,
  exprValueToText,
  MATH_FUNCTION_NAMES,
  type ExprValue,
} from "./variable-expression";

const INPUTS = new Set(["input1", "input2", "input3"]);

const compile = (formula: string) => compileVariableExpression(formula, INPUTS);

const run = (
  formula: string,
  inputs: Record<string, ExprValue> = {},
): ExprValue => {
  const compiled = compile(formula);
  if (!compiled.ok) throw new Error(`failed to compile: ${compiled.error}`);
  return evaluateVariableExpression(
    compiled.value,
    new Map(Object.entries(inputs)),
  );
};

const errorFor = (formula: string): string => {
  const compiled = compile(formula);
  if (compiled.ok) throw new Error(`expected "${formula}" to be rejected`);
  return compiled.error;
};

describe("compileVariableExpression rejects everything outside the subset", () => {
  it.each([
    "input1.constructor",
    'input1["constructor"]',
    "input1.constructor.constructor",
    "input1.__proto__",
    'input1["__proto__"]',
    "input1.prototype",
    "{ constructor: 1 }",
    "[].constructor",
    "'text'.constructor",
    "input1.map(item => item.constructor)",
  ])("rejects %s, the CVE-2025-12735 shape", (formula) => {
    expect(errorFor(formula)).toContain("not available");
  });

  it("rejects calling anything but a Math function or a method", () => {
    expect(errorFor("foo(input1)")).toContain("can be called");
    expect(errorFor("round(input1)")).toContain("can be called");
    expect(errorFor("Math.round(input1)(input2)")).toContain("can be called");
    expect(errorFor("(item => item)(1)")).toContain("can be called");
  });

  it("rejects a method it does not know", () => {
    expect(errorFor("input1.explode()")).toContain(
      '"explode" is not a method you can call',
    );
    expect(errorFor("input1.toString()")).toContain("is not a method");
    expect(errorFor("input1.valueOf()")).toContain("is not a method");
  });

  it("rejects a method chosen at runtime", () => {
    expect(errorFor("input1[input2](1)")).toContain(
      "A method has to be called by name",
    );
  });

  it.each(["constructor", "toString", "valueOf", "hasOwnProperty"])(
    "rejects Math.%s, which comes from the prototype chain",
    (name) => {
      expect(errorFor(`Math.${name}(1)`)).toContain(
        "Math functions can be called",
      );
    },
  );

  it.each(["random", "sumPrecise"])("rejects Math.%s", (name) => {
    expect(errorFor(`Math.${name}()`)).toContain(
      "Math functions can be called",
    );
  });

  it("reaches no Math member the allowlist has not named", () => {
    const named = new Set<string>(MATH_FUNCTION_NAMES);
    const unnamed = Object.getOwnPropertyNames(Math).filter(
      (name) =>
        typeof Reflect.get(Math, name) === "function" && !named.has(name),
    );
    expect(unnamed).toContain("random");
    for (const name of unnamed) {
      expect(errorFor(`Math.${name}(1)`)).toContain("Math functions");
    }
  });

  it("names only Math functions that exist and answer with a number", () => {
    expect(MATH_FUNCTION_NAMES.length).toBeGreaterThan(30);
    for (const name of MATH_FUNCTION_NAMES) {
      expect(typeof Reflect.get(Math, name)).toBe("function");
      const compiled = compile(`Math.${name}(1, 1)`);
      expect(compiled.ok).toBe(true);
      if (!compiled.ok) continue;
      expect(typeof evaluateVariableExpression(compiled.value, new Map())).toBe(
        "number",
      );
    }
  });

  it("rejects Math used as anything but a call", () => {
    expect(errorFor("Math")).toContain('Unknown input "Math"');
    expect(errorFor("Math.round")).toContain("Math functions");
    expect(errorFor("Math.floor.call")).toContain("Math functions");
  });

  it("takes a Math function named as text, which is still a literal name", () => {
    expect(run("Math['round'](2.5)")).toBe(3);
    expect(errorFor("Math['constructor'](1)")).toContain("Math functions");
  });

  // jsep emits the same AST for `-x ** 2` and `(-x) ** 2`, so both are rejected.
  it.each(["-2 ** 2", "-input1 ** 2", "!input1 ** 2", "(-2) ** 2"])(
    "rejects %s, which JavaScript rejects as ambiguous",
    (formula) => {
      expect(errorFor(formula)).toContain("directly before ** reads two ways");
    },
  );

  it("takes a unary minus anywhere else around **", () => {
    expect(run("2 ** -1")).toBe(0.5);
    expect(run("-(2 ** 2)")).toBe(-4);
    expect(run("-2 * 2 ** 2")).toBe(-8);
  });

  it("rejects this and multi-statement input", () => {
    expect(errorFor("this")).toContain('"this" is not allowed');
    expect(errorFor("input1; input2")).toContain("single expression");
    expect(errorFor("input1, input2")).toContain("single expression");
    // jsep reports these as compound expressions, so the error names the
    // unsupported word.
    expect(errorFor("typeof input1")).toContain("typeof");
    expect(errorFor("new Date()")).toContain("new");
  });

  it("rejects an object key it cannot see in the formula", () => {
    expect(errorFor("{ [input1]: 1 }")).toContain("not computed");
    expect(errorFor("{ label: }")).toBeTruthy();
  });

  it("rejects empty and unparseable formulas", () => {
    expect(errorFor("")).toContain("empty");
    expect(errorFor("   ")).toContain("empty");
    expect(errorFor("input1 +")).toBeTruthy();
    expect(errorFor("(input1")).toBeTruthy();
  });

  it("rejects unknown inputs and lists the available ones", () => {
    const message = errorFor("nope * 2");
    expect(message).toContain('Unknown input "nope"');
    expect(message).toContain("input1, input2, input3");
  });

  it("suggests the logical operator when a bitwise one is used", () => {
    expect(errorFor("input1 | input2")).toContain('Did you mean "||"');
    expect(errorFor("input1 & input2")).toContain('Did you mean "&&"');
  });

  it("leaves argument counts to the function", () => {
    for (const formula of [
      "Math.round()",
      "Math.round(1, 2)",
      "Math.pow(input1)",
      "Math.min()",
      "Math.max(1, 2, 3, 4)",
    ]) {
      expect(R.isSuccess(compile(formula))).toBe(true);
    }
  });

  it("rejects null", () => {
    expect(errorFor("input1 ?? null")).toContain("null is not allowed");
  });
});

describe("input lookup is not exposed to the prototype chain", () => {
  it.each(["constructor", "__proto__", "toString", "valueOf"])(
    "resolves a declared %s input to its own value, never a prototype member",
    (name) => {
      const compiled = compileVariableExpression(name, new Set([name]));
      if (!compiled.ok) throw new Error(compiled.error);

      expect(
        evaluateVariableExpression(compiled.value, new Map()),
      ).toBeUndefined();
      expect(
        evaluateVariableExpression(compiled.value, new Map([[name, 42]])),
      ).toBe(42);
    },
  );
});

describe("evaluateVariableExpression", () => {
  it("does arithmetic with the expected precedence", () => {
    expect(run("1 + 2 * 3")).toBe(7);
    expect(run("(1 + 2) * 3")).toBe(9);
    expect(run("2 ** 3 ** 2")).toBe(512);
    expect(run("-input1", { input1: 5 })).toBe(-5);
    expect(run("7 % 3")).toBe(1);
  });

  it("reads inputs", () => {
    expect(run("input1 * input2", { input1: 6, input2: 7 })).toBe(42);
  });

  it("propagates a missing input as undefined rather than guessing", () => {
    expect(run("input1 * 2", {})).toBeUndefined();
    expect(run("input1 + input2", { input1: 3 })).toBeUndefined();
  });

  it("uses ?? to supply a default for an unanswered field", () => {
    expect(run("(input1 ?? 0) + 5", {})).toBe(5);
    expect(run("(input1 ?? 0) + 5", { input1: 10 })).toBe(15);
    expect(run("input1 ?? 99", { input1: 0 })).toBe(0);
  });

  it("concatenates when either side of + is text", () => {
    expect(run("'You saved ' + input1 + ' kg'", { input1: 42 })).toBe(
      "You saved 42 kg",
    );
    expect(run("'a' + 'b'")).toBe("ab");
    expect(run("'over? ' + (input1 > 1)", { input1: 2 })).toBe("over? true");
  });

  it("concatenates a number the way it would be displayed alone", () => {
    expect(run("'total: ' + (0.1 + 0.2)")).toBe("total: 0.3");
  });

  it("blanks a sentence built on an unanswered field rather than writing undefined", () => {
    expect(run("'You saved ' + input1", {})).toBeUndefined();
    expect(run("'You saved ' + (input1 ?? 0)", {})).toBe("You saved 0");
  });

  it("coerces booleans in arithmetic", () => {
    expect(run("input1 + 1", { input1: true })).toBe(2);
    expect(run("input1 + 1", { input1: false })).toBe(1);
  });

  it("leaves non-numeric text and non-finite results to the display layer", () => {
    expect(run("'abc' * 2")).toBeNaN();
    expect(run("-'abc'")).toBeNaN();
    expect(run("Math.abs('abc')")).toBeNaN();
    expect(run("0 / 0")).toBeNaN();
    expect(run("Math.sqrt(-1)")).toBeNaN();
    expect(run("1 / 0")).toBe(Infinity);
    expect(run("'abc' > 1")).toBe(false);
  });

  it("compares two strings as text, as JavaScript does", () => {
    expect(run("'apple' < 'banana'")).toBe(true);
    expect(run("'b' < 'a'")).toBe(false);
    expect(run("input1 >= 'M' ? 'late' : 'early'", { input1: "Z" })).toBe(
      "late",
    );
  });

  it("refuses to write a non-finite number into text", () => {
    expect(run("'over ' + 1 / 0")).toBeUndefined();
  });

  it("evaluates comparisons and ternaries, including string results", () => {
    expect(run("input1 > 5", { input1: 6 })).toBe(true);
    expect(run("input1 >= 5 ? 'high' : 'low'", { input1: 5 })).toBe("high");
    expect(run("input1 >= 5 ? 'high' : 'low'", { input1: 2 })).toBe("low");
  });

  it("keeps == loose and === strict", () => {
    expect(run("input1 == 1", { input1: 1 })).toBe(true);
    expect(run("input1 === 1", { input1: 1 })).toBe(true);
    expect(run("input1 == 1", { input1: "1" })).toBe(true);
    expect(run("input1 === 1", { input1: "1" })).toBe(false);
    expect(run("input1 != 1", { input1: 2 })).toBe(true);
    expect(run("input1 !== 1", { input1: "1" })).toBe(true);
  });

  it("compares an unanswered field instead of blanking", () => {
    expect(run("input1 == 1", {})).toBe(false);
    expect(run("input1 != 1", {})).toBe(true);
  });

  it("short-circuits && and || without evaluating the far side", () => {
    expect(run("input1 && input2", { input1: false })).toBe(false);
    expect(run("input1 || 7", { input1: undefined })).toBe(7);
  });

  it("returns undefined from a function given a missing input", () => {
    expect(run("Math.round(input1)", {})).toBeUndefined();
    // `Math.pow(NaN, 0)` is 1, so this one only blanks if the argument is
    // checked before the call rather than after it.
    expect(run("Math.pow(input1, 0)", {})).toBeUndefined();
  });

  it("computes a realistic percentage", () => {
    expect(
      run("Math.round((input1 / (input2 ?? 1)) * 1000) / 10", {
        input1: 37,
        input2: 120,
      }),
    ).toBe(30.8);
  });
});

describe("evaluates exactly as JavaScript does", () => {
  const SAME_AS_JS: string[] = [
    "1 + 2 * 3",
    "(1 + 2) * 3",
    "2 ** 3 ** 2",
    "7 % 3",
    "-(2 ** 2)",
    "Math.pow(-2, 2)",
    "1 / 3",
    "0.1 + 0.2",
    "'5' + 1",
    "1 + '5'",
    "'a' + 'b'",
    "'5' - '1'",
    "'5' * 2",
    "true + 1",
    "'apple' < 'banana'",
    "'10' < '9'",
    "'10' < 9",
    "true > 0",
    "'abc' > 1",
    "1 == '1'",
    "1 === '1'",
    "0 == false",
    "0 === false",
    "1 != '1'",
    "1 !== '1'",
    "!0",
    "!''",
    "!'a'",
    "0 || 'fallback'",
    "'' && 'unreached'",
    "0 ?? 3",
    "1 ? 'yes' : 'no'",
    "'' ? 'yes' : 'no'",
    "Math.round(2.5)",
    "Math.round(-2.5)",
    "Math.round(2.567)",
    "Math.trunc(-2.7)",
    "Math.floor(-2.1)",
    "Math.ceil(-2.9)",
    "Math.abs(-4)",
    "Math.sqrt(9)",
    "Math.pow(2, 10)",
    "Math.min(3, 1, 2)",
    "Math.max(3, 1, 2)",
    "Math.max()",
    "Math.pow(2, 0.5)",
    "Math.round(1.6, 9)",
    "Math.min()",
    "Math.hypot(3, 4)",
    "Math.sign(-3)",
    "Math.log2(8)",
    "Math.cbrt(27)",
    "Math.atan2(1, 1)",
    "Math.fround(5.5)",
  ];

  it.each(SAME_AS_JS)("%s", (formula) => {
    expect(run(formula)).toBe(eval(formula));
  });

  it("departs from JavaScript only on unanswered fields and scope", () => {
    expect(run("input1 * 2", {})).toBeUndefined();
    expect(run("'saved ' + input1", {})).toBeUndefined();
    expect(errorFor("Date.now()")).toBeTruthy();
    expect(errorFor("globalThis")).toBeTruthy();
  });

  it.each([
    "[1, 2, 3].length",
    "[1, 2, 3][1]",
    "[1, 2, 3]['1']",
    "'abc'['1']",
    "[1, 2, 3]['01']",
    "[1, 2, 3][' 1']",
    "[1, 2, 3]['1.0']",
    "[1, 2, 3]['-1']",
    "[1, 2, 3]['3']",
    "[3, 1, 2].filter(n => n > 1).length",
    "[1, 2, 3].map(n => n * 2)[2]",
    "[1, 2, 3].reduce((total, n) => total + n, 0)",
    "[1, 2, 3].some(n => n === 2)",
    "[1, 2, 3].every(n => n > 0)",
    "[1, 2, 3].indexOf(2)",
    "[1, 2, 3].includes(4)",
    "[1, 2, 3].slice(1).length",
    "[1, 2].concat([3]).length",
    "[[1], [2, 3]].flat().length",
    "[[1, [2]]].flat(2).length",
    "[[1, [2]]].flat(2)[0]",
    "[[[1]]].flat(3)[0]",
    "[1, 2, 3].at(-1)",
    "[1, 2, 3].find(n => n > 1)",
    "[1, 2, 3].findIndex(n => n > 1)",
    "[1, 2, 3].findLast(n => n < 3)",
    "[1, 2, 3].findLastIndex(n => n < 3)",
    "[1, 2].flatMap(n => [n, n]).length",
    "'abc'.length",
    "'abc'[1]",
    "'abc'.toUpperCase()",
    "'a,b'.split(',').length",
    "' a '.trim()",
    "'abc'.slice(1)",
    "'abc'.includes('b')",
    "'abc'.replace('b', 'B')",
    "'7'.padStart(3, '0')",
    "(1.005).toFixed(2)",
    "({ label: 'Solar', value: 'v1' }).label",
    "[1, 2, 3].sort((a, b) => b - a)[0]",
    "[10, 9, 1].sort() + ''",
    "['a', 'b'].join()",
    "['a', 'b'].join('')",
    "[1, 2] + ''",
    "[1, [2, 3]] + ''",
    "[1] + [2]",
    "[1] * 2",
    "['1'] * 2",
    "['1', '2'] * 2",
    "+[]",
    "+['2']",
    "({ a: 1 }) + ''",
    "({ a: 1 }) * 2",
    "[] + ({ a: 1 })",
    "['b'] < 'c'",
    "[2] < 3",
    "[1, 2] == '1,2'",
    "[1, 2] === '1,2'",
    "'abcd'.slice('1')",
    "'ab'.repeat('2')",
    "'abc'.at('1')",
    "(1.005).toFixed('2')",
    "[1, 2, 3].at('-1')",
    "[] + []",
    "[1] < [2]",
    "true + true",
    "'a' + true",
    "[1, 2]?.length",
    "({ a: 1 })?.a",
    "[1, 2, 3]?.map(n => n * 2)[0]",
  ])("%s", (formula) => {
    expect(run(formula)).toEqual(eval(formula));
  });
});

describe("compileVariableExpression accepts the documented subset", () => {
  it("compiles each supported construct", () => {
    for (const formula of [
      "input1",
      "1.5",
      "'text'",
      "true",
      "input1 + input2 - input3",
      "input1 * input2 / 2",
      "input1 % 2",
      "input1 ** 2",
      "!input1",
      "+input1",
      "input1 ?? input2 ?? 0",
      "input1 && input2 || input3",
      "input1 < 1 ? input2 : input3",
      "Math.min(input1, Math.max(input2, 0))",
    ]) {
      expect(R.isSuccess(compile(formula))).toBe(true);
    }
  });
});

describe("lists, records and the methods that read them", () => {
  const CHOICES: ExprValue = [
    { label: "Solar", value: "v1" },
    { label: "Wind", value: "v2" },
  ];

  it("writes a record the way JavaScript writes one, not as one of its keys", () => {
    expect(exprValueToText(CHOICES[0])).toBe("[object Object]");
    expect(exprValueToText(CHOICES)).toBe("[object Object],[object Object]");
    expect(run("'You picked ' + input1", { input1: CHOICES })).toBe(
      "You picked [object Object],[object Object]",
    );
    expect(
      run("'You picked ' + input1.map(choice => choice.label).join(', ')", {
        input1: CHOICES,
      }),
    ).toBe("You picked Solar, Wind");
  });

  it("writes a list of text as its parts, joined with a comma", () => {
    expect(exprValueToText(["a", "b"])).toBe("a,b");
    expect(run("input1", { input1: CHOICES })).toEqual(CHOICES);
  });

  it("has no text for a value with no reading of its own", () => {
    expect(exprValueToText(1 / 0)).toBeUndefined();
    expect(exprValueToText(undefined)).toBeUndefined();
  });

  it("reads a choice by label and by value", () => {
    expect(run("input1[0].label", { input1: CHOICES })).toBe("Solar");
    expect(
      run("input1.map(choice => choice.value).join('|')", { input1: CHOICES }),
    ).toBe("v1|v2");
    expect(
      run("input1.some(choice => choice.value === 'v2')", { input1: CHOICES }),
    ).toBe(true);
  });

  it("sorts by text unless given a comparator, as JavaScript does", () => {
    expect(run("[10, 9, 1].sort()")).toEqual([1, 10, 9]);
    expect(run("[10, 9, 1].sort((a, b) => a - b)")).toEqual([1, 9, 10]);
    expect(run("['b', 'a'].sort()")).toEqual(["a", "b"]);
  });

  it("gives a lambda the item, its position and the whole list", () => {
    expect(
      run("input1.map((item, index) => index + ':' + item).join('|')", {
        input1: ["a", "b"],
      }),
    ).toBe("0:a|1:b");
    expect(
      run("input1.map((item, index, all) => all.length).at(0)", {
        input1: ["a", "b"],
      }),
    ).toBe(2);
  });

  it("lets a lambda read the inputs around it", () => {
    expect(
      run("input1.filter(n => n > input2).length", {
        input1: [1, 5, 9],
        input2: 4,
      }),
    ).toBe(2);
  });

  it("reduces with and without a starting value", () => {
    expect(
      run("input1.reduce((total, n) => total + n, 0)", { input1: [1, 2, 3] }),
    ).toBe(6);
    expect(
      run("input1.reduce((total, n) => total + n)", { input1: [1, 2, 3] }),
    ).toBe(6);
    expect(run("[].reduce((total, n) => total + n)")).toBeUndefined();
  });

  it("builds a record in the formula", () => {
    expect(run("{ label: input1, count: 2 }", { input1: "Solar" })).toEqual({
      label: "Solar",
      count: 2,
    });
    expect(run("({ label: 'Solar' }).label")).toBe("Solar");
  });

  it("reads a key a record does not have as undefined, not as an error", () => {
    expect(run("input1.nope", { input1: { label: "Solar" } })).toBeUndefined();
    expect(run("input1[0]", { input1: [] })).toBeUndefined();
    expect(run("input1[9]", { input1: ["a"] })).toBeUndefined();
  });

  it("leaves an unanswered field undefined instead of throwing on it", () => {
    expect(run("input1.length", {})).toBeUndefined();
    expect(run("input1.map(item => item)", {})).toBeUndefined();
    expect(run("input1.length ?? 0", {})).toBe(0);
  });

  it("blanks a method call whose receiver is unanswered", () => {
    expect(run("input1.slice(1)", {})).toBeUndefined();
    expect(run("input1.join(',')", {})).toBeUndefined();
  });

  it.each([
    ["'abc'.slice(input1)", "'abc'.slice(undefined)"],
    ["['a', 'b'].join(input1)", "['a', 'b'].join(undefined)"],
    ["['a', 'b'].includes(input1)", "['a', 'b'].includes(undefined)"],
    ["['a', 'b'].indexOf(input1)", "['a', 'b'].indexOf(undefined)"],
    ["'ab'.padEnd(input1, '.')", "'ab'.padEnd(undefined, '.')"],
    ["'ab'.repeat(input1)", "'ab'.repeat(undefined)"],
    ["'a b'.split(input1)", "'a b'.split(undefined)"],
    ["['a', 'b'].at(input1)", "['a', 'b'].at(undefined)"],
  ])("passes an unanswered argument through: %s", (formula, javascript) => {
    expect(run(formula, {})).toEqual(eval(javascript));
  });

  it("has no value for a method that is read but never called", () => {
    expect(run("input1.map", { input1: [1] })).toBeUndefined();
    expect(run("Math.round(1).toFixed")).toBeUndefined();
  });

  it("refuses to build a string larger than the answers it came from", () => {
    expect(run("'ab'.repeat(3)")).toBe("ababab");
    expect(run("'ab'.repeat(100000)")).toBeUndefined();
    expect(run("'ab'.padStart(100000, '-')")).toBeUndefined();
  });

  it("coerces a list and a record in arithmetic the way JavaScript does", () => {
    expect(run("input1 * 2", { input1: ["1"] })).toBe(2);
    expect(run("input1 * 2", { input1: ["1", "2"] })).toBeNaN();
    expect(run("input1 - 1", { input1: { label: "Solar" } })).toBeNaN();
  });

  it("cannot reach a prototype through a record built in the formula", () => {
    expect(run("({ label: 'a' })['toString']")).toBeUndefined();
    expect(
      run("input1['hasOwnProperty']", { input1: { label: "a" } }),
    ).toBeUndefined();
    expect(run("input1['length']", { input1: { label: "a" } })).toBeUndefined();
  });
});
