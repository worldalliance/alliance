// Formulas use JavaScript coercion and comparison rules inside a closed,
// non-throwing evaluator. Missing inputs propagate as `undefined`, member
// access on `undefined` is safe, and only the globals, properties, methods, and
// AST node kinds explicitly listed below are reachable.

import arrowPlugin, { type ArrowExpression } from "@jsep-plugin/arrow";
import objectPlugin, { type ObjectExpression } from "@jsep-plugin/object";
import jsep from "jsep";
import { R, type Result } from "../result";

jsep.plugins.register(arrowPlugin, objectPlugin);

export type ExprRecord = { readonly [key: string]: ExprValue };

/** A formula lambda. Only array methods invoke it; it has no text form. */
export class ExprLambda {
  constructor(
    private readonly params: readonly string[],
    private readonly body: ExprNode,
    private readonly captured: ReadonlyMap<string, ExprValue>,
  ) {}

  call(args: readonly ExprValue[]): ExprValue {
    const scope = new Map(this.captured);
    this.params.forEach((name, index) => scope.set(name, args[index]));
    return evaluateVariableExpression(this.body, scope);
  }
}

/** Values a formula can produce; `undefined` means no usable value. */
export type ExprValue =
  | number
  | string
  | boolean
  | undefined
  | readonly ExprValue[]
  | ExprRecord
  | ExprLambda;

export function isExprArray(value: ExprValue): value is readonly ExprValue[] {
  return Array.isArray(value);
}

export function isExprRecord(value: ExprValue): value is ExprRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof ExprLambda)
  );
}

export enum ExprKind {
  Literal = "literal",
  Input = "input",
  Array = "array",
  Record = "record",
  Lambda = "lambda",
  Unary = "unary",
  Binary = "binary",
  Conditional = "conditional",
  Member = "member",
  MathCall = "mathCall",
  MethodCall = "methodCall",
}

export enum UnaryOp {
  Negate = "-",
  Plus = "+",
  Not = "!",
}

export enum BinaryOp {
  Add = "+",
  Subtract = "-",
  Multiply = "*",
  Divide = "/",
  Modulo = "%",
  Exponent = "**",
  LessThan = "<",
  GreaterThan = ">",
  LessOrEqual = "<=",
  GreaterOrEqual = ">=",
  Equal = "==",
  StrictEqual = "===",
  NotEqual = "!=",
  StrictNotEqual = "!==",
  And = "&&",
  Or = "||",
  Coalesce = "??",
}

export type ExprNode =
  | { kind: ExprKind.Literal; value: number | string | boolean }
  | { kind: ExprKind.Input; name: string }
  | { kind: ExprKind.Array; items: ExprNode[] }
  | { kind: ExprKind.Record; entries: { key: string; value: ExprNode }[] }
  | { kind: ExprKind.Lambda; params: string[]; body: ExprNode }
  | { kind: ExprKind.Unary; op: UnaryOp; operand: ExprNode }
  | { kind: ExprKind.Binary; op: BinaryOp; left: ExprNode; right: ExprNode }
  | {
      kind: ExprKind.Conditional;
      test: ExprNode;
      consequent: ExprNode;
      alternate: ExprNode;
    }
  | { kind: ExprKind.Member; target: ExprNode; property: ExprNode }
  | { kind: ExprKind.MathCall; fn: string; args: ExprNode[] }
  | {
      kind: ExprKind.MethodCall;
      target: ExprNode;
      method: string;
      args: ExprNode[];
    };

export const MATH_OBJECT_NAME = "Math";

const ARRAY_TEXT_SEPARATOR = ",";
const RECORD_TEXT = "[object Object]";

const LENGTH_PROPERTY = "length";

// Property reads never touch a prototype. Reject these names at compile time so
// attempts produce an error instead of `undefined`.
const FORBIDDEN_PROPERTIES: ReadonlySet<string> = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

const MAX_TEXT_LENGTH = 10_000;
const MAX_LIST_LENGTH = 10_000;

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

const MATH_FUNCTION_ALLOWED: ReadonlySet<string> = new Set(MATH_FUNCTION_NAMES);

const UNARY_OP_BY_TOKEN: Record<string, UnaryOp> = {
  "-": UnaryOp.Negate,
  "+": UnaryOp.Plus,
  "!": UnaryOp.Not,
};

// Bitwise operators are the one deliberate omission — `|` is far more often a
// typo for `||` than a deliberate bitwise or, and a silent reinterpretation of
// a numeric answer is worse than an error message.
const BINARY_OP_BY_TOKEN: Record<string, BinaryOp> = {
  "+": BinaryOp.Add,
  "-": BinaryOp.Subtract,
  "*": BinaryOp.Multiply,
  "/": BinaryOp.Divide,
  "%": BinaryOp.Modulo,
  "**": BinaryOp.Exponent,
  "<": BinaryOp.LessThan,
  ">": BinaryOp.GreaterThan,
  "<=": BinaryOp.LessOrEqual,
  ">=": BinaryOp.GreaterOrEqual,
  "==": BinaryOp.Equal,
  "===": BinaryOp.StrictEqual,
  "!=": BinaryOp.NotEqual,
  "!==": BinaryOp.StrictNotEqual,
  "&&": BinaryOp.And,
  "||": BinaryOp.Or,
  "??": BinaryOp.Coalesce,
};

/**
 * jsep and its plugins type parsed nodes as the open `Expression` base. These
 * guards close the union before conversion so downstream switches remain
 * exhaustive.
 */
const CORE_EXPRESSION_TYPES: ReadonlySet<string> = new Set<jsep.ExpressionType>(
  [
    "ArrayExpression",
    "BinaryExpression",
    "CallExpression",
    "Compound",
    "ConditionalExpression",
    "Identifier",
    "Literal",
    "MemberExpression",
    "SequenceExpression",
    "ThisExpression",
    "UnaryExpression",
  ],
);

function isCoreExpression(node: jsep.Expression): node is jsep.CoreExpression {
  return CORE_EXPRESSION_TYPES.has(node.type);
}

function isArrowExpression(node: jsep.Expression): node is ArrowExpression {
  return node.type === "ArrowFunctionExpression";
}

function isObjectExpression(node: jsep.Expression): node is ObjectExpression {
  return node.type === "ObjectExpression";
}

function asMemberExpression(
  node: jsep.Expression,
): jsep.MemberExpression | undefined {
  return isCoreExpression(node) && node.type === "MemberExpression"
    ? node
    : undefined;
}

function isMathMember(member: jsep.MemberExpression): boolean {
  const { object } = member;
  return (
    isCoreExpression(object) &&
    object.type === "Identifier" &&
    object.name === MATH_OBJECT_NAME
  );
}

// Only statically named `Math` calls may reach the evaluator. Dynamic and
// inherited properties remain inaccessible.
function calledMathFunction(callee: jsep.Expression): string | undefined {
  const member = asMemberExpression(callee);
  if (member === undefined || !isMathMember(member)) return undefined;
  const name = staticPropertyName(member);
  return name !== undefined && MATH_FUNCTION_ALLOWED.has(name)
    ? name
    : undefined;
}

function staticPropertyName(member: jsep.MemberExpression): string | undefined {
  const { property, computed } = member;
  if (!isCoreExpression(property)) return undefined;
  if (!computed) {
    return property.type === "Identifier" ? property.name : undefined;
  }
  return property.type === "Literal" && typeof property.value === "string"
    ? property.value
    : undefined;
}

const mathOnlyFailure = <T>(): Result<T, string> =>
  R.failure(
    `Only ${MATH_OBJECT_NAME} functions can be called, as in ${MATH_OBJECT_NAME}.round(x).`,
  );

/**
 * Free identifiers outside `allowedInputs` fail compilation so renamed inputs
 * cannot silently blank a value in a live form.
 */
export function compileVariableExpression(
  formula: string,
  allowedInputs: ReadonlySet<string>,
): Result<ExprNode, string> {
  const trimmed = formula.trim();
  if (!trimmed) {
    return R.failure("Formula is empty.");
  }

  const parsed = R.fromThrowable(
    () => jsep(trimmed),
    (error) => (error instanceof Error ? error.message : String(error)),
  );
  if (!parsed.ok) {
    return R.failure(parsed.error);
  }

  return convert(parsed.value, allowedInputs);
}

function convert(
  node: jsep.Expression,
  scope: ReadonlySet<string>,
): Result<ExprNode, string> {
  if (isArrowExpression(node)) return convertArrow(node, scope);
  if (isObjectExpression(node)) return convertObject(node, scope);
  if (!isCoreExpression(node)) {
    return R.failure(`Unsupported expression (${node.type}).`);
  }

  switch (node.type) {
    case "Literal": {
      const { value } = node;
      if (
        typeof value === "number" ||
        typeof value === "string" ||
        typeof value === "boolean"
      ) {
        return R.success({ kind: ExprKind.Literal, value });
      }
      // jsep's `null` literal: there is no null in this language, and treating
      // it as "no value" would make `x ?? null` quietly meaningless.
      return R.failure("null is not allowed; leave the value out instead.");
    }

    case "Identifier": {
      if (!scope.has(node.name)) {
        const known = [...scope].sort().join(", ");
        return R.failure(
          known
            ? `Unknown input "${node.name}". Available: ${known}.`
            : `Unknown input "${node.name}". This variable has no inputs yet.`,
        );
      }
      return R.success({ kind: ExprKind.Input, name: node.name });
    }

    case "ArrayExpression": {
      const items: ExprNode[] = [];
      for (const element of node.elements) {
        // jsep leaves a hole in `[1, , 2]` as null.
        if (!element) return R.failure("Leave no gaps in a list.");
        const converted = convert(element, scope);
        if (!converted.ok) return converted;
        items.push(converted.value);
      }
      return R.success({ kind: ExprKind.Array, items });
    }

    case "UnaryExpression": {
      const op = UNARY_OP_BY_TOKEN[node.operator];
      if (!op) {
        return R.failure(`Unsupported operator "${node.operator}".`);
      }
      const operand = convert(node.argument, scope);
      if (!operand.ok) return operand;
      return R.success({ kind: ExprKind.Unary, op, operand: operand.value });
    }

    case "BinaryExpression": {
      const op = BINARY_OP_BY_TOKEN[node.operator];
      if (!op) {
        return R.failure(
          `Unsupported operator "${node.operator}".` +
            (node.operator === "|" || node.operator === "&"
              ? ` Did you mean "${node.operator}${node.operator}"?`
              : ""),
        );
      }
      // jsep emits the same AST for `-x ** 2` and `(-x) ** 2`, so reject both
      // rather than changing JavaScript's meaning.
      if (
        op === BinaryOp.Exponent &&
        isCoreExpression(node.left) &&
        node.left.type === "UnaryExpression"
      ) {
        const unary = node.left.operator;
        return R.failure(
          `"${unary}" directly before ** reads two ways, and parentheses cannot tell them apart here. Write ${MATH_OBJECT_NAME}.pow(${unary}x, 2) to apply "${unary}" first, or ${unary}(x ** 2) to apply it last.`,
        );
      }
      const left = convert(node.left, scope);
      if (!left.ok) return left;
      const right = convert(node.right, scope);
      if (!right.ok) return right;
      return R.success({
        kind: ExprKind.Binary,
        op,
        left: left.value,
        right: right.value,
      });
    }

    case "ConditionalExpression": {
      const test = convert(node.test, scope);
      if (!test.ok) return test;
      const consequent = convert(node.consequent, scope);
      if (!consequent.ok) return consequent;
      const alternate = convert(node.alternate, scope);
      if (!alternate.ok) return alternate;
      return R.success({
        kind: ExprKind.Conditional,
        test: test.value,
        consequent: consequent.value,
        alternate: alternate.value,
      });
    }

    case "CallExpression":
      return convertCall(node, scope);

    case "MemberExpression":
      return convertMember(node, scope);

    case "ThisExpression":
      return R.failure('"this" is not allowed.');

    // jsep reads `typeof x` and `new Date()` as two expressions side by side,
    // so the word operators land here rather than as their own node types.
    case "Compound":
    case "SequenceExpression":
      return R.failure(
        "Write a single expression: no commas or semicolons, and no typeof, new, in or instanceof.",
      );

    default:
      return R.failure(`Unsupported expression (${node satisfies never}).`);
  }
}

function convertArrow(
  node: ArrowExpression,
  scope: ReadonlySet<string>,
): Result<ExprNode, string> {
  if (node.async) return R.failure("An arrow function cannot be async.");

  const params: string[] = [];
  for (const param of node.params ?? []) {
    if (!isCoreExpression(param) || param.type !== "Identifier") {
      return R.failure(
        "An arrow function takes plain names, as in (item, index) => item.value.",
      );
    }
    params.push(param.name);
  }

  const body = convert(node.body, new Set([...scope, ...params]));
  if (!body.ok) return body;
  return R.success({ kind: ExprKind.Lambda, params, body: body.value });
}

function convertObject(
  node: ObjectExpression,
  scope: ReadonlySet<string>,
): Result<ExprNode, string> {
  const entries: { key: string; value: ExprNode }[] = [];
  for (const property of node.properties) {
    if (property.computed) {
      return R.failure("An object key has to be written out, not computed.");
    }
    const { key } = property;
    if (!isCoreExpression(key)) {
      return R.failure(`Unsupported object key (${key.type}).`);
    }
    const name =
      key.type === "Identifier"
        ? key.name
        : key.type === "Literal" && typeof key.value === "string"
          ? key.value
          : undefined;
    if (name === undefined) {
      return R.failure("An object key has to be a name or text.");
    }
    if (FORBIDDEN_PROPERTIES.has(name)) {
      return R.failure(`"${name}" is not available.`);
    }
    if (!property.value) {
      return R.failure(`Give "${name}" a value, as in { ${name}: input1 }.`);
    }
    const value = convert(property.value, scope);
    if (!value.ok) return value;
    entries.push({ key: name, value: value.value });
  }
  return R.success({ kind: ExprKind.Record, entries });
}

function convertMember(
  node: jsep.MemberExpression,
  scope: ReadonlySet<string>,
): Result<ExprNode, string> {
  if (isMathMember(node)) return mathOnlyFailure();

  const name = staticPropertyName(node);
  if (name !== undefined && FORBIDDEN_PROPERTIES.has(name)) {
    return R.failure(`"${name}" is not available.`);
  }

  const target = convert(node.object, scope);
  if (!target.ok) return target;

  if (name !== undefined) {
    return R.success({
      kind: ExprKind.Member,
      target: target.value,
      property: { kind: ExprKind.Literal, value: name },
    });
  }

  if (!node.computed) {
    return R.failure("A property has to be read by name.");
  }
  const property = convert(node.property, scope);
  if (!property.ok) return property;
  return R.success({
    kind: ExprKind.Member,
    target: target.value,
    property: property.value,
  });
}

function convertCall(
  node: jsep.CallExpression,
  scope: ReadonlySet<string>,
): Result<ExprNode, string> {
  const args: ExprNode[] = [];
  for (const argument of node.arguments) {
    const converted = convert(argument, scope);
    if (!converted.ok) return converted;
    args.push(converted.value);
  }

  const { callee } = node;
  const mathFn = calledMathFunction(callee);
  if (mathFn !== undefined) {
    return R.success({ kind: ExprKind.MathCall, fn: mathFn, args });
  }
  const member = asMemberExpression(callee);
  if (member === undefined) {
    return R.failure(
      `Only ${MATH_OBJECT_NAME} functions and the methods of a value can be called, as in ${MATH_OBJECT_NAME}.round(x) or input1.map(item => item.value).`,
    );
  }
  if (isMathMember(member)) return mathOnlyFailure();

  const method = staticPropertyName(member);
  if (method === undefined) {
    return R.failure("A method has to be called by name.");
  }
  if (!KNOWN_METHODS.has(method)) {
    return R.failure(`"${method}" is not a method you can call.`);
  }

  const target = convert(member.object, scope);
  if (!target.ok) return target;
  return R.success({
    kind: ExprKind.MethodCall,
    target: target.value,
    method,
    args,
  });
}

/**
 * Trims binary-float noise (0.1 + 0.2) without imposing a fixed precision.
 * `undefined` for `NaN` and `Infinity`, which have no reading a respondent
 * could use — `formatVariableValue` renders that as empty.
 */
export function formatExprNumber(value: number): string | undefined {
  return Number.isFinite(value)
    ? String(Number(value.toPrecision(12)))
    : undefined;
}

/**
 * Converts a formula value to JavaScript-style text. Missing, non-finite, and
 * lambda values return `undefined`.
 */
export function exprValueToText(value: ExprValue): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "number") return formatExprNumber(value);
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return String(value);
  if (isExprArray(value)) return joinValues(value, ARRAY_TEXT_SEPARATOR);
  if (isExprRecord(value)) return RECORD_TEXT;
  return undefined;
}

function joinValues(values: readonly ExprValue[], separator: string): string {
  return values.map((value) => exprValueToText(value) ?? "").join(separator);
}

function concatText(left: ExprValue, right: ExprValue): ExprValue {
  const leftText = exprValueToText(left);
  const rightText = exprValueToText(right);
  return leftText === undefined || rightText === undefined
    ? undefined
    : leftText + rightText;
}

function toPrimitive(
  value: Exclude<ExprValue, undefined>,
): string | number | boolean {
  if (typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "boolean") return value;
  return exprValueToText(value) ?? "";
}

function toNumber(value: ExprValue): number {
  if (value === undefined) return NaN;
  const primitive = toPrimitive(value);
  if (typeof primitive === "number") return primitive;
  if (typeof primitive === "boolean") return primitive ? 1 : 0;
  return Number(primitive);
}

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

type NativeMethod = (this: unknown, ...args: unknown[]) => unknown;

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

const MATH_FUNCTIONS = nativeMethods(Math, MATH_FUNCTION_NAMES);
const ARRAY_METHODS = nativeMethods(Array.prototype, ARRAY_METHOD_NAMES);
const STRING_METHODS = nativeMethods(String.prototype, STRING_METHOD_NAMES);
const NUMBER_METHODS = nativeMethods(Number.prototype, NUMBER_METHOD_NAMES);

// Taken from the names rather than from the tables above, so an engine missing
// a newer method still compiles the same formula as every other engine. The
// call blanks there rather than a form saving on one device and not another.
const KNOWN_METHODS: ReadonlySet<string> = new Set([
  ...ARRAY_METHOD_NAMES,
  ...STRING_METHOD_NAMES,
  ...NUMBER_METHOD_NAMES,
]);

// Native sort and reverse mutate their receiver; copy arrays to keep evaluation
// pure.
const REWRITES_ITS_LIST: ReadonlySet<string> = new Set(["sort", "reverse"]);

function toNativeArgument(value: ExprValue): unknown {
  return value instanceof ExprLambda
    ? (...args: ExprValue[]) => value.call(args)
    : value;
}

// Cap each step because chained calls can allocate the limit repeatedly.
function withinBounds(value: unknown): boolean {
  if (typeof value === "string") return value.length <= MAX_TEXT_LENGTH;
  if (Array.isArray(value)) return value.length <= MAX_LIST_LENGTH;
  return true;
}

function methodsFor(
  target: ExprValue,
): ReadonlyMap<string, NativeMethod> | undefined {
  if (isExprArray(target)) return ARRAY_METHODS;
  if (typeof target === "string") return STRING_METHODS;
  if (typeof target === "number") return NUMBER_METHODS;
  return undefined;
}

function callMethod(
  target: ExprValue,
  method: string,
  args: readonly ExprValue[],
): ExprValue {
  const native = methodsFor(target)?.get(method);
  if (native === undefined) return undefined;

  const receiver =
    isExprArray(target) && REWRITES_ITS_LIST.has(method) ? [...target] : target;
  const called = R.fromThrowable(() =>
    native.apply(receiver, args.map(toNativeArgument)),
  );
  if (!called.ok || !withinBounds(called.value)) return undefined;
  // Allowlisted methods return ExprValue-compatible values. A callback passed
  // to a non-callback parameter may return as a native function, which the
  // evaluator treats like ExprLambda: it has no text or readable properties.
  return called.value as ExprValue;
}

// Match canonical JavaScript indexes: "1" is an index, while "01", " 1", and
// "1.0" are property names.
function arrayIndex(key: ExprValue, length: number): number | undefined {
  const index = typeof key === "string" ? Number(key) : key;
  if (typeof index !== "number" || !Number.isInteger(index)) return undefined;
  if (typeof key === "string" && String(index) !== key) return undefined;
  return index >= 0 && index < length ? index : undefined;
}

// Restrict property access to own record keys plus list and string lengths or
// indexes.
function readMember(target: ExprValue, key: ExprValue): ExprValue {
  if (target === undefined || key === undefined) return undefined;

  if (typeof target === "string") {
    if (key === LENGTH_PROPERTY) return target.length;
    const index = arrayIndex(key, target.length);
    return index === undefined ? undefined : target.charAt(index);
  }

  if (isExprArray(target)) {
    if (key === LENGTH_PROPERTY) return target.length;
    const index = arrayIndex(key, target.length);
    return index === undefined ? undefined : target[index];
  }

  if (isExprRecord(target)) {
    const name = typeof key === "string" ? key : exprValueToText(key);
    if (name === undefined || FORBIDDEN_PROPERTIES.has(name)) return undefined;
    return Object.hasOwn(target, name) ? target[name] : undefined;
  }

  return undefined;
}

/**
 * Evaluates a compiled formula. Arithmetic and relational operators propagate
 * unanswered inputs as `undefined`; equality still compares them, and `??`
 * supplies a default. `NaN` and `Infinity` are left to the display layer.
 */
export function evaluateVariableExpression(
  node: ExprNode,
  inputs: ReadonlyMap<string, ExprValue>,
): ExprValue {
  switch (node.kind) {
    case ExprKind.Literal:
      return node.value;

    case ExprKind.Input:
      // A Map, not a plain object: an input named `constructor` or `__proto__`
      // would otherwise resolve off Object.prototype and hand the evaluator a
      // value no `ExprValue` branch expects.
      return inputs.get(node.name);

    case ExprKind.Array:
      return node.items.map((item) => evaluateVariableExpression(item, inputs));

    case ExprKind.Record:
      // `fromEntries` defines each key as an own property, so a key named
      // `__proto__` stays data instead of reaching the setter.
      return Object.fromEntries(
        node.entries.map(({ key, value }) => [
          key,
          evaluateVariableExpression(value, inputs),
        ]),
      );

    case ExprKind.Lambda:
      return new ExprLambda(node.params, node.body, inputs);

    case ExprKind.Unary: {
      const operand = evaluateVariableExpression(node.operand, inputs);
      const op = node.op;
      switch (op) {
        case UnaryOp.Not:
          return !operand;
        case UnaryOp.Negate:
          return -toNumber(operand);
        case UnaryOp.Plus:
          return toNumber(operand);
        default:
          throw new Error(`unknown unary op: ${op satisfies never}`);
      }
    }

    case ExprKind.Binary:
      return evaluateBinary(node.op, node.left, node.right, inputs);

    case ExprKind.Conditional:
      return evaluateVariableExpression(node.test, inputs)
        ? evaluateVariableExpression(node.consequent, inputs)
        : evaluateVariableExpression(node.alternate, inputs);

    case ExprKind.Member:
      return readMember(
        evaluateVariableExpression(node.target, inputs),
        evaluateVariableExpression(node.property, inputs),
      );

    case ExprKind.MathCall: {
      // Allowed by name but absent from this engine: the call has no answer
      // here rather than the formula having no meaning everywhere.
      const fn = MATH_FUNCTIONS.get(node.fn);
      if (fn === undefined) return undefined;
      const args: number[] = [];
      for (const argument of node.args) {
        const value = evaluateVariableExpression(argument, inputs);
        // `NaN` would not do here: `Math.pow(NaN, 0)` is 1, so an unanswered
        // field would come back as a real-looking answer.
        if (value === undefined) return undefined;
        args.push(toNumber(value));
      }
      const result = fn.apply(Math, args);
      return typeof result === "number" ? result : undefined;
    }

    case ExprKind.MethodCall: {
      const target = evaluateVariableExpression(node.target, inputs);
      if (target === undefined) return undefined;
      return callMethod(
        target,
        node.method,
        node.args.map((argument) =>
          evaluateVariableExpression(argument, inputs),
        ),
      );
    }

    default:
      throw new Error(`unknown node kind: ${node satisfies never}`);
  }
}

function evaluateBinary(
  op: BinaryOp,
  leftNode: ExprNode,
  rightNode: ExprNode,
  inputs: ReadonlyMap<string, ExprValue>,
): ExprValue {
  switch (op) {
    case BinaryOp.Coalesce: {
      const left = evaluateVariableExpression(leftNode, inputs);
      return left === undefined
        ? evaluateVariableExpression(rightNode, inputs)
        : left;
    }
    case BinaryOp.And: {
      const left = evaluateVariableExpression(leftNode, inputs);
      return left ? evaluateVariableExpression(rightNode, inputs) : left;
    }
    case BinaryOp.Or: {
      const left = evaluateVariableExpression(leftNode, inputs);
      return left ? left : evaluateVariableExpression(rightNode, inputs);
    }
    case BinaryOp.Add:
    case BinaryOp.Subtract:
    case BinaryOp.Multiply:
    case BinaryOp.Divide:
    case BinaryOp.Modulo:
    case BinaryOp.Exponent:
    case BinaryOp.LessThan:
    case BinaryOp.GreaterThan:
    case BinaryOp.LessOrEqual:
    case BinaryOp.GreaterOrEqual:
    case BinaryOp.Equal:
    case BinaryOp.StrictEqual:
    case BinaryOp.NotEqual:
    case BinaryOp.StrictNotEqual:
      break;
    default:
      throw new Error(`unknown binary op: ${op satisfies never}`);
  }

  const left = evaluateVariableExpression(leftNode, inputs);
  const right = evaluateVariableExpression(rightNode, inputs);

  // Equality runs before the unanswered-field check, as in JavaScript: an
  // unanswered field is not equal to 1, rather than making the whole comparison
  // blank.
  switch (op) {
    case BinaryOp.Equal:
      return left == right;
    case BinaryOp.StrictEqual:
      return left === right;
    case BinaryOp.NotEqual:
      return left != right;
    case BinaryOp.StrictNotEqual:
      return left !== right;
    default:
      break;
  }

  if (left === undefined || right === undefined) {
    return undefined;
  }

  const leftPrimitive = toPrimitive(left);
  const rightPrimitive = toPrimitive(right);
  const bothText =
    typeof leftPrimitive === "string" && typeof rightPrimitive === "string";

  if (
    op === BinaryOp.Add &&
    (typeof leftPrimitive === "string" || typeof rightPrimitive === "string")
  ) {
    return concatText(left, right);
  }

  const a = toNumber(leftPrimitive);
  const b = toNumber(rightPrimitive);

  switch (op) {
    case BinaryOp.Add:
      return a + b;
    case BinaryOp.Subtract:
      return a - b;
    case BinaryOp.Multiply:
      return a * b;
    case BinaryOp.Divide:
      return a / b;
    case BinaryOp.Modulo:
      return a % b;
    case BinaryOp.Exponent:
      return a ** b;
    case BinaryOp.LessThan:
      return bothText ? leftPrimitive < rightPrimitive : a < b;
    case BinaryOp.GreaterThan:
      return bothText ? leftPrimitive > rightPrimitive : a > b;
    case BinaryOp.LessOrEqual:
      return bothText ? leftPrimitive <= rightPrimitive : a <= b;
    case BinaryOp.GreaterOrEqual:
      return bothText ? leftPrimitive >= rightPrimitive : a >= b;
    default:
      throw new Error(`unhandled numeric op: ${op satisfies never}`);
  }
}
