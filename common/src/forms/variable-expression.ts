// A formula is a JavaScript expression, evaluated as JavaScript would, with two
// departures: an unanswered field is `undefined` and blanks the result rather
// than reading as 0, and `Math` is the only reachable global. jsep only parses;
// compilation translates its output into the closed `ExprNode` union, so no AST
// node type reaches the evaluator without being named here first.

import jsep from "jsep";
import { R, type Result } from "../result";

/** Values a formula can produce; `undefined` means no usable value. */
export type ExprValue = number | string | boolean | undefined;

export enum ExprKind {
  Literal = "literal",
  Input = "input",
  Unary = "unary",
  Binary = "binary",
  Conditional = "conditional",
  Call = "call",
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
  | { kind: ExprKind.Literal; value: ExprValue }
  | { kind: ExprKind.Input; name: string }
  | { kind: ExprKind.Unary; op: UnaryOp; operand: ExprNode }
  | { kind: ExprKind.Binary; op: BinaryOp; left: ExprNode; right: ExprNode }
  | {
      kind: ExprKind.Conditional;
      test: ExprNode;
      consequent: ExprNode;
      alternate: ExprNode;
    }
  | { kind: ExprKind.Call; fn: string; args: ExprNode[] };

export const MATH_OBJECT_NAME = "Math";

type MathFunction = (...args: number[]) => number;

const EXCLUDED_MATH_FUNCTIONS: ReadonlySet<string> = new Set([
  // A variable has to read the same to the respondent filling the form, to the
  // output view afterwards, and to anyone looking at the response later.
  "random",
  // Takes an iterable rather than numbers, and this language has no arrays to
  // hand it, so every call it could express would throw.
  "sumPrecise",
]);

// Discovering allowed functions from `Math` preserves native behavior while
// keeping inherited Object members unreachable.
const MATH_FUNCTIONS: ReadonlyMap<string, MathFunction> = new Map(
  Object.getOwnPropertyNames(Math).flatMap((name) => {
    if (EXCLUDED_MATH_FUNCTIONS.has(name)) return [];
    const member: unknown = Reflect.get(Math, name);
    // Checked to be a function on `Math`, and every one of those takes and
    // returns numbers; nothing else can reach this cast.
    return typeof member === "function"
      ? [[name, member as MathFunction] as const]
      : [];
  }),
);

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
 * jsep types its return as the open `Expression` base, so this is the one place
 * a parsed node is narrowed to the closed union its own literal `type` fields
 * describe. Everything downstream switches on `type` and narrows natively.
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

// Only literal `Math.name(…)` calls may reach the evaluator; computed and
// inherited properties remain inaccessible.
function calledMathFunction(callee: jsep.Expression): string | undefined {
  if (!isCoreExpression(callee)) return undefined;
  if (callee.type !== "MemberExpression" || callee.computed) return undefined;

  const { object, property } = callee;
  if (!isCoreExpression(object) || object.type !== "Identifier") {
    return undefined;
  }
  if (object.name !== MATH_OBJECT_NAME) return undefined;
  if (!isCoreExpression(property) || property.type !== "Identifier") {
    return undefined;
  }
  return MATH_FUNCTIONS.has(property.name) ? property.name : undefined;
}

/**
 * Identifiers outside `allowedInputs` fail compilation so renamed inputs cannot
 * silently blank a value in a live form.
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
  allowedInputs: ReadonlySet<string>,
): Result<ExprNode, string> {
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
      if (!allowedInputs.has(node.name)) {
        const known = [...allowedInputs].sort().join(", ");
        return R.failure(
          known
            ? `Unknown input "${node.name}". Available: ${known}.`
            : `Unknown input "${node.name}". This variable has no inputs yet.`,
        );
      }
      return R.success({ kind: ExprKind.Input, name: node.name });
    }

    case "UnaryExpression": {
      const op = UNARY_OP_BY_TOKEN[node.operator];
      if (!op) {
        return R.failure(`Unsupported operator "${node.operator}".`);
      }
      const operand = convert(node.argument, allowedInputs);
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
      const left = convert(node.left, allowedInputs);
      if (!left.ok) return left;
      const right = convert(node.right, allowedInputs);
      if (!right.ok) return right;
      return R.success({
        kind: ExprKind.Binary,
        op,
        left: left.value,
        right: right.value,
      });
    }

    case "ConditionalExpression": {
      const test = convert(node.test, allowedInputs);
      if (!test.ok) return test;
      const consequent = convert(node.consequent, allowedInputs);
      if (!consequent.ok) return consequent;
      const alternate = convert(node.alternate, allowedInputs);
      if (!alternate.ok) return alternate;
      return R.success({
        kind: ExprKind.Conditional,
        test: test.value,
        consequent: consequent.value,
        alternate: alternate.value,
      });
    }

    case "CallExpression": {
      const fn = calledMathFunction(node.callee);
      if (fn === undefined) {
        return R.failure(
          `Only ${MATH_OBJECT_NAME} functions can be called, as in ${MATH_OBJECT_NAME}.round(x).`,
        );
      }
      const args: ExprNode[] = [];
      for (const argument of node.arguments) {
        const converted = convert(argument, allowedInputs);
        if (!converted.ok) return converted;
        args.push(converted.value);
      }
      return R.success({ kind: ExprKind.Call, fn, args });
    }

    case "MemberExpression":
      return R.failure(
        `Only ${MATH_OBJECT_NAME} functions can be used, as in ${MATH_OBJECT_NAME}.round(x).`,
      );

    case "ThisExpression":
      return R.failure('"this" is not allowed.');

    case "ArrayExpression":
      return R.failure("Arrays are not allowed.");

    case "Compound":
    case "SequenceExpression":
      return R.failure(
        "Write a single expression, without commas or semicolons.",
      );

    default:
      return R.failure(`Unsupported expression (${node satisfies never}).`);
  }
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

function toText(value: Exclude<ExprValue, undefined>): string | undefined {
  return typeof value === "number" ? formatExprNumber(value) : String(value);
}

/**
 * Evaluate a compiled formula. Operators behave as they do in JavaScript, with
 * one addition: an unanswered field is `undefined` and blanks the whole result
 * rather than reading as 0 or "undefined", which is what makes `??` the way to
 * supply a default. `NaN` and `Infinity` are left to the display layer.
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

    case ExprKind.Unary: {
      const operand = evaluateVariableExpression(node.operand, inputs);
      const op = node.op;
      switch (op) {
        case UnaryOp.Not:
          return !operand;
        case UnaryOp.Negate:
          return -Number(operand);
        case UnaryOp.Plus:
          return Number(operand);
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

    case ExprKind.Call: {
      const fn = MATH_FUNCTIONS.get(node.fn);
      if (fn === undefined) return undefined;
      const args: number[] = [];
      for (const argument of node.args) {
        const value = evaluateVariableExpression(argument, inputs);
        // `NaN` would not do here: `Math.pow(NaN, 0)` is 1, so an unanswered
        // field would come back as a real-looking answer.
        if (value === undefined) return undefined;
        args.push(Number(value));
      }
      return fn(...args);
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

  if (
    op === BinaryOp.Add &&
    (typeof left === "string" || typeof right === "string")
  ) {
    const leftText = toText(left);
    const rightText = toText(right);
    return leftText === undefined || rightText === undefined
      ? undefined
      : leftText + rightText;
  }

  // TypeScript takes the relational operators on this union as they are, so
  // those cases are the JavaScript ones: two strings compare as text, anything
  // else by number. It refuses the arithmetic operators, so those spell out the
  // `ToNumber` step the operator itself would apply.
  const a = Number(left);
  const b = Number(right);

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
      return left < right;
    case BinaryOp.GreaterThan:
      return left > right;
    case BinaryOp.LessOrEqual:
      return left <= right;
    case BinaryOp.GreaterOrEqual:
      return left >= right;
    default:
      throw new Error(`unhandled numeric op: ${op satisfies never}`);
  }
}
