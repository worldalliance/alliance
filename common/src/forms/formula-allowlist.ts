export const MATH_OBJECT_NAME = "Math";

// Property reads never touch a prototype. Reject these names at compile time so
// attempts produce an error instead of `undefined`.
export const FORBIDDEN_PROPERTIES: ReadonlySet<string> = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

// Keep this allowlist stable across browser and mobile runtimes. Runtime
// discovery would make formulas compile differently as engines add methods.
// `random` is nondeterministic; `sumPrecise` accepts an iterable, not numbers.
export const MATH_FUNCTION_NAMES = [
  "abs",
  "acos",
  "acosh",
  "asin",
  "asinh",
  "atan",
  "atan2",
  "atanh",
  "cbrt",
  "ceil",
  "clz32",
  "cos",
  "cosh",
  "exp",
  "expm1",
  "floor",
  "fround",
  "hypot",
  "imul",
  "log",
  "log10",
  "log1p",
  "log2",
  "max",
  "min",
  "pow",
  "round",
  "sign",
  "sin",
  "sinh",
  "sqrt",
  "tan",
  "tanh",
  "trunc",
] as const;

// Use native implementations for JavaScript-compatible defaults and ordering.
// Exclude locale-dependent methods and methods that return unsupported values.
export const ARRAY_METHOD_NAMES = [
  "map",
  "filter",
  "flatMap",
  "find",
  "findIndex",
  "findLast",
  "findLastIndex",
  "some",
  "every",
  "reduce",
  "sort",
  "reverse",
  "slice",
  "concat",
  "includes",
  "indexOf",
  "lastIndexOf",
  "at",
  "join",
  "flat",
] as const;

export const STRING_METHOD_NAMES = [
  "toLowerCase",
  "toUpperCase",
  "trim",
  "trimStart",
  "trimEnd",
  "charAt",
  "at",
  "slice",
  "substring",
  "concat",
  "includes",
  "startsWith",
  "endsWith",
  "indexOf",
  "lastIndexOf",
  "split",
  "replace",
  "replaceAll",
  "repeat",
  "padStart",
  "padEnd",
] as const;

export const NUMBER_METHOD_NAMES = ["toFixed", "toPrecision"] as const;

export type ArrayMethodName = (typeof ARRAY_METHOD_NAMES)[number];
export type StringMethodName = (typeof STRING_METHOD_NAMES)[number];
export type NumberMethodName = (typeof NUMBER_METHOD_NAMES)[number];

export type NativeMethod = (this: unknown, ...args: unknown[]) => unknown;

function nativeMethods(
  prototype: object,
  names: readonly string[],
): ReadonlyMap<string, NativeMethod> {
  return new Map(
    names.flatMap((name) => {
      const member: unknown = Reflect.get(prototype, name);
      // Read by an allowlisted name from a built-in object, so the cast cannot
      // expose arbitrary functions.
      return typeof member === "function"
        ? [[name, member as NativeMethod] as const]
        : [];
    }),
  );
}

export const MATH_FUNCTIONS = nativeMethods(Math, MATH_FUNCTION_NAMES);
export const ARRAY_METHODS = nativeMethods(Array.prototype, ARRAY_METHOD_NAMES);
export const STRING_METHODS = nativeMethods(
  String.prototype,
  STRING_METHOD_NAMES,
);
export const NUMBER_METHODS = nativeMethods(
  Number.prototype,
  NUMBER_METHOD_NAMES,
);

// Taken from the names rather than from the tables above, so an engine missing
// a newer method still compiles the same formula as every other engine. The
// call blanks there rather than a form saving on one device and not another.
export const KNOWN_METHODS: ReadonlySet<string> = new Set([
  ...ARRAY_METHOD_NAMES,
  ...STRING_METHOD_NAMES,
  ...NUMBER_METHOD_NAMES,
]);
