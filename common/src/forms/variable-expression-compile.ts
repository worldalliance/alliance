import arrowPlugin, { type ArrowExpression } from "@jsep-plugin/arrow";
import objectPlugin, { type ObjectExpression } from "@jsep-plugin/object";
import jsep from "jsep";
import { thrownMessage } from "../errorMessage";
import { R, type Result } from "../result";
import {
  FORBIDDEN_PROPERTIES,
  KNOWN_METHODS,
  MATH_FUNCTION_NAMES,
  MATH_OBJECT_NAME,
} from "./formula-allowlist";
import {
  BinaryOp,
  ExprKind,
  UnaryOp,
  type ExprNode,
} from "./variable-expression-ast";

jsep.plugins.register(arrowPlugin, objectPlugin);

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

  const parsed = R.fromThrowable(() => jsep(trimmed), thrownMessage);
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
