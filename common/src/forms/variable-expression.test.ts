import { R } from "../result";
import {
  compileVariableExpression,
  evaluateVariableExpression,
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
  it("rejects property access, the CVE-2025-12735 shape", () => {
    expect(errorFor("input1.constructor")).toContain("Math functions");
    expect(errorFor('input1["constructor"]')).toContain("Math functions");
    expect(errorFor("input1.constructor.constructor")).toContain(
      "Math functions",
    );
  });

  it("rejects everything callable but a literal Math member", () => {
    expect(errorFor("foo(input1)")).toContain("Math functions can be called");
    expect(errorFor("round(input1)")).toContain("Math functions can be called");
    expect(errorFor("Math.round(input1)(input2)")).toContain(
      "Math functions can be called",
    );
    expect(errorFor("Math['round'](1)")).toContain(
      "Math functions can be called",
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

  // This catches new Math members that do not accept numeric arguments;
  // `Math.sumPrecise`, for example, requires an iterable.
  it("exposes only members that take and return numbers", () => {
    const members = Object.getOwnPropertyNames(Math).filter(
      (name) => typeof Reflect.get(Math, name) === "function",
    );
    expect(members.length).toBeGreaterThan(30);

    for (const name of members) {
      const compiled = compile(`Math.${name}(1, 1)`);
      if (!compiled.ok) continue;
      expect(typeof evaluateVariableExpression(compiled.value, new Map())).toBe(
        "number",
      );
    }
  });

  it("rejects Math used as anything but a call", () => {
    expect(errorFor("Math")).toContain('Unknown input "Math"');
    expect(errorFor("Math.round")).toContain("Math functions");
    expect(errorFor("Math.round(1).toFixed")).toContain("Math functions");
  });

  it("rejects this, arrays, and multi-statement input", () => {
    expect(errorFor("this")).toContain('"this" is not allowed');
    expect(errorFor("[1, 2]")).toContain("Arrays are not allowed");
    expect(errorFor("input1; input2")).toContain("single expression");
    expect(errorFor("input1, input2")).toContain("single expression");
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
    "(-2) ** 2",
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
