// TypeScript runs with `noLib`, so this file defines every global visible to a
// formula. Keep these signatures synchronized with the evaluator allowlists;
// `formula-lib.test.ts` checks method names in both directions.

import { MATH_FUNCTION_NAMES, MATH_OBJECT_NAME } from "./variable-expression";

// `noLib` still requires these intrinsic declarations to type-check a formula.
const INTRINSICS = `
interface Object {}
interface Function {}
interface CallableFunction {}
interface NewableFunction {}
interface IArguments {}
interface RegExp {}
interface Boolean {}
`;

const STRING_LIB = `
interface String {
  readonly length: number;
  readonly [index: number]: string;
  toLowerCase(): string;
  toUpperCase(): string;
  trim(): string;
  trimStart(): string;
  trimEnd(): string;
  charAt(index: number): string;
  at(index: number): string | undefined;
  slice(start?: number, end?: number): string;
  substring(start: number, end?: number): string;
  concat(...parts: string[]): string;
  includes(search: string, from?: number): boolean;
  startsWith(search: string, from?: number): boolean;
  endsWith(search: string, end?: number): boolean;
  indexOf(search: string, from?: number): number;
  lastIndexOf(search: string, from?: number): number;
  split(separator: string, limit?: number): string[];
  replace(search: string, replacement: string): string;
  replaceAll(search: string, replacement: string): string;
  repeat(count: number): string;
  padStart(length: number, pad?: string): string;
  padEnd(length: number, pad?: string): string;
}
`;

const NUMBER_LIB = `
interface Number {
  toFixed(digits?: number): string;
  toPrecision(digits?: number): string;
}
`;

const ARRAY_LIB = `
type FlatArray<Arr, Depth extends number> = {
  done: Arr;
  recur: Arr extends ReadonlyArray<infer Inner>
    ? FlatArray<Inner, [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20][Depth]>
    : Arr;
}[Depth extends -1 ? "done" : "recur"];

interface Array<T> {
  readonly length: number;
  [index: number]: T;
  map<U>(fn: (item: T, index: number, list: T[]) => U): U[];
  filter(fn: (item: T, index: number, list: T[]) => unknown): T[];
  flatMap<U>(fn: (item: T, index: number, list: T[]) => U | U[]): U[];
  find(fn: (item: T, index: number, list: T[]) => unknown): T | undefined;
  findIndex(fn: (item: T, index: number, list: T[]) => unknown): number;
  findLast(fn: (item: T, index: number, list: T[]) => unknown): T | undefined;
  findLastIndex(fn: (item: T, index: number, list: T[]) => unknown): number;
  some(fn: (item: T, index: number, list: T[]) => unknown): boolean;
  every(fn: (item: T, index: number, list: T[]) => unknown): boolean;
  reduce(fn: (total: T, item: T, index: number, list: T[]) => T): T;
  reduce<U>(fn: (total: U, item: T, index: number, list: T[]) => U, start: U): U;
  sort(compare?: (a: T, b: T) => number): T[];
  reverse(): T[];
  slice(start?: number, end?: number): T[];
  concat(...items: (T | T[])[]): T[];
  includes(search: T, from?: number): boolean;
  indexOf(search: T, from?: number): number;
  lastIndexOf(search: T, from?: number): number;
  at(index: number): T | undefined;
  join(separator?: string): string;
  flat<A, D extends number = 1>(this: A, depth?: D): FlatArray<A, D>[];
}
interface ReadonlyArray<T> extends Array<T> {}
`;

export const MATH_BINARY_FUNCTIONS = ["atan2", "imul", "pow"] as const;

export const MATH_VARIADIC_FUNCTIONS = ["hypot", "max", "min"] as const;

const parametersFor = (name: string): string => {
  if (MATH_BINARY_FUNCTIONS.some((each) => each === name)) {
    return "a: number, b: number";
  }
  if (MATH_VARIADIC_FUNCTIONS.some((each) => each === name)) {
    return "...values: number[]";
  }
  return "x: number";
};

const mathLib = (): string => {
  const members = MATH_FUNCTION_NAMES.map(
    (name) => `  ${name}(${parametersFor(name)}): number;`,
  ).join("\n");
  return `
interface ${MATH_OBJECT_NAME} {
${members}
}
declare var ${MATH_OBJECT_NAME}: ${MATH_OBJECT_NAME};
`;
};

export const FORMULA_LIB: string = [
  INTRINSICS,
  STRING_LIB,
  NUMBER_LIB,
  ARRAY_LIB,
  mathLib(),
].join("\n");
