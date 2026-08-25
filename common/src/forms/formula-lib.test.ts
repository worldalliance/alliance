import { FORMULA_LIB, MATH_BINARY_FUNCTIONS } from "./formula-lib";
import {
  MATH_FUNCTION_NAMES,
  type ArrayMethodName,
  type NumberMethodName,
  type StringMethodName,
} from "./variable-expression";
import { checkVariableFormulaType } from "./variable-formula-check";

const ARRAY_CALLS: Record<ArrayMethodName, string> = {
  map: "list.map(item => item)",
  filter: "list.filter(item => item)",
  flatMap: "list.flatMap(item => [item])",
  find: "list.find(item => item)",
  findIndex: "list.findIndex(item => item)",
  findLast: "list.findLast(item => item)",
  findLastIndex: "list.findLastIndex(item => item)",
  some: "list.some(item => item)",
  every: "list.every(item => item)",
  reduce: "list.reduce((total, item) => total + item, 0)",
  sort: "list.sort((a, b) => a - b)",
  reverse: "list.reverse()",
  slice: "list.slice(0, 1)",
  concat: "list.concat(list)",
  includes: "list.includes(1)",
  indexOf: "list.indexOf(1)",
  lastIndexOf: "list.lastIndexOf(1)",
  at: "list.at(0)",
  join: "list.join(', ')",
  flat: "list.flat()",
};

const STRING_CALLS: Record<StringMethodName, string> = {
  toLowerCase: "text.toLowerCase()",
  toUpperCase: "text.toUpperCase()",
  trim: "text.trim()",
  trimStart: "text.trimStart()",
  trimEnd: "text.trimEnd()",
  charAt: "text.charAt(0)",
  at: "text.at(0)",
  slice: "text.slice(0, 1)",
  substring: "text.substring(0, 1)",
  concat: "text.concat('a')",
  includes: "text.includes('a')",
  startsWith: "text.startsWith('a')",
  endsWith: "text.endsWith('a')",
  indexOf: "text.indexOf('a')",
  lastIndexOf: "text.lastIndexOf('a')",
  split: "text.split(',')",
  replace: "text.replace('a', 'b')",
  replaceAll: "text.replaceAll('a', 'b')",
  repeat: "text.repeat(2)",
  padStart: "text.padStart(3, '.')",
  padEnd: "text.padEnd(3, '.')",
};

const NUMBER_CALLS: Record<NumberMethodName, string> = {
  toFixed: "num.toFixed(2)",
  toPrecision: "num.toPrecision(3)",
};

const ENV: ReadonlyMap<string, string> = new Map([
  ["list", "number[]"],
  ["text", "string"],
  ["num", "number"],
]);

// Coerce each call to text so these checks cover method availability, not
// whether its return type can render.
const accepts = (call: string): string | null => {
  const checked = checkVariableFormulaType(`'' + (${call})`, ENV);
  return checked.ok ? null : checked.error;
};

describe("declares every method the evaluator runs", () => {
  it.each(Object.entries(ARRAY_CALLS))("%s", (_name, call) => {
    expect(accepts(call)).toBeNull();
  });

  it.each(Object.entries(STRING_CALLS))("%s", (_name, call) => {
    expect(accepts(call)).toBeNull();
  });

  it.each(Object.entries(NUMBER_CALLS))("%s", (_name, call) => {
    expect(accepts(call)).toBeNull();
  });

  it.each(MATH_FUNCTION_NAMES)("Math.%s", (name) => {
    const args = MATH_BINARY_FUNCTIONS.some((each) => each === name)
      ? "1, 2"
      : "1";
    expect(accepts(`Math.${name}(${args})`)).toBeNull();
  });
});

describe("declares nothing the evaluator cannot run", () => {
  it("names no Math function outside the allowlist", () => {
    const declared = [...FORMULA_LIB.matchAll(/^ {2}(\w+)\(/gm)].map(
      (match) => match[1],
    );
    const mathOnly = declared.filter((name) =>
      MATH_FUNCTION_NAMES.some((allowed) => allowed === name),
    );
    expect(mathOnly.sort()).toEqual([...MATH_FUNCTION_NAMES].sort());
  });
});
