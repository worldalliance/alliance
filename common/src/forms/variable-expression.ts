// Formulas use JavaScript coercion and comparison rules inside a closed
// evaluator that throws past its step budget and where a native coercion
// fails. Missing inputs propagate as `undefined`, member access on `undefined`
// is safe, and a formula reaches only the globals and methods in
// `formula-allowlist.ts`, the length and items of lists and text, and own
// record fields.

import { R } from "../result";
import {
  ARRAY_METHODS,
  FORBIDDEN_PROPERTIES,
  MATH_FUNCTIONS,
  NUMBER_METHODS,
  STRING_METHODS,
  type NativeMethod,
} from "./formula-allowlist";
import {
  EvaluationTooLong,
  sizeOf,
  spendOnNested,
  spendOnReceiver,
  spendSteps,
  withStepBudget,
} from "./formula-step-budget";
import {
  BinaryOp,
  ExprKind,
  UnaryOp,
  type ExprNode,
} from "./variable-expression-ast";

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

const ARRAY_TEXT_SEPARATOR = ",";
const RECORD_TEXT = "[object Object]";

const LENGTH_PROPERTY = "length";

const MAX_TEXT_LENGTH = 10_000;
const MAX_LIST_LENGTH = 10_000;

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
  spendSteps(values.length);
  return values
    .map((value) => {
      spendSteps(sizeOf(value));
      return exprValueToText(value) ?? "";
    })
    .join(separator);
}

function concatText(left: ExprValue, right: ExprValue): ExprValue {
  const leftText = exprValueToText(left);
  const rightText = exprValueToText(right);
  if (leftText === undefined || rightText === undefined) return undefined;
  spendSteps(leftText.length + rightText.length);
  return leftText + rightText;
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
  spendSteps(primitive.length);
  return Number(primitive);
}

// Native sort and reverse mutate their receiver; copy arrays to keep evaluation
// pure.
const REWRITES_ITS_LIST: ReadonlySet<string> = new Set(["sort", "reverse"]);

// These turn a list their callback returns into text, or copy it. The others
// only store it, pass it on, or test whether it is truthy.
const READS_RETURNED_LIST: ReadonlySet<string> = new Set([
  "sort",
  "replace",
  "replaceAll",
  "flatMap",
]);

function toNativeArgument(value: ExprValue, method: string): unknown {
  const native: unknown = value;
  // A callback wrapped for one method can come back out of it, as the value
  // `reduce` starts from does, and still has to pay here.
  const call =
    value instanceof ExprLambda
      ? (args: ExprValue[]) => value.call(args)
      : typeof native === "function"
        ? (args: ExprValue[]): ExprValue =>
            Reflect.apply(native, undefined, args)
        : undefined;
  if (call === undefined) return value;
  if (!READS_RETURNED_LIST.has(method)) {
    return (...args: ExprValue[]) => call(args);
  }
  return (...args: ExprValue[]) => {
    const result = call(args);
    if (isExprArray(result)) spendOnNested(result);
    return result;
  };
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
  spendOnReceiver(target, method);
  // Native methods turn list arguments into text wherever they read text.
  args.forEach(spendOnNested);
  const called = R.fromThrowable(() =>
    native.apply(
      receiver,
      args.map((argument) => toNativeArgument(argument, method)),
    ),
  );
  if (!called.ok) {
    if (called.error instanceof EvaluationTooLong) throw called.error;
    return undefined;
  }
  if (!withinBounds(called.value)) return undefined;
  spendSteps(sizeOf(called.value));
  // Allowlisted methods return ExprValue-compatible values. A callback passed
  // to a non-callback parameter may return as a native function, which the
  // evaluator treats like ExprLambda: it has no text or readable properties.
  return called.value as ExprValue;
}

// Match canonical JavaScript indexes: "1" is an index, while "01", " 1", and
// "1.0" are property names.
function arrayIndex(key: ExprValue, length: number): number | undefined {
  const index = typeof key === "string" ? toNumber(key) : key;
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
 * Throws once it runs past its step budget, and where a native coercion fails,
 * as `({ toString: 1 }) == 'x'` does.
 */
export function evaluateVariableExpression(
  node: ExprNode,
  inputs: ReadonlyMap<string, ExprValue>,
): ExprValue {
  return withStepBudget(() => {
    spendSteps(1);
    return evaluateNode(node, inputs);
  });
}

// `==` may turn a list compared with anything but a list into text.
function looseEquals(left: ExprValue, right: ExprValue): boolean {
  if (isExprArray(left) !== isExprArray(right)) {
    spendOnNested(left);
    spendOnNested(right);
  }
  return left == right;
}

function evaluateNode(
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
      return looseEquals(left, right);
    case BinaryOp.StrictEqual:
      return left === right;
    case BinaryOp.NotEqual:
      return !looseEquals(left, right);
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
