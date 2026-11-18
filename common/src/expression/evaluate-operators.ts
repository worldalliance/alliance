import { type Value } from "./catalog";
import { COMPARES_PRIMITIVES_ONLY, isPrimitive } from "./evaluate-methods";
import { evalError, finite } from "./failure";
import { BinaryOp, UnaryOp } from "./tree";

export const NEEDS_A_NUMBER = "- needs a number.";

export function unary(op: UnaryOp, operand: Value): Value {
  switch (op) {
    case UnaryOp.Not:
      if (operand !== null && typeof operand !== "boolean")
        throw evalError("! needs a yes/no value.");
      return operand === null ? null : !operand;
    case UnaryOp.Negate:
      if (operand !== null && typeof operand !== "number")
        throw evalError(NEEDS_A_NUMBER);
      return operand === null ? null : -operand;
    default:
      throw new Error(`unknown unary op: ${op satisfies never}`);
  }
}

const DECISIVE: Record<BinaryOp.And | BinaryOp.Or, boolean> = {
  [BinaryOp.And]: false,
  [BinaryOp.Or]: true,
};

function logical({
  op,
  left,
  right,
}: {
  op: BinaryOp.And | BinaryOp.Or;
  left: Value;
  right: Value;
}): Value {
  for (const side of [left, right]) {
    if (side !== null && typeof side !== "boolean") {
      throw evalError(`${op} needs yes/no values.`);
    }
  }
  const decisive = DECISIVE[op];
  if (left === decisive || right === decisive) return decisive;
  if (left === null || right === null) return null;
  return !decisive;
}

const ADD_NEEDS = "+ needs numbers or text.";
const needsNumbers = (op: BinaryOp) => `${op} needs numbers.`;
export const comparesMessage = (op: BinaryOp) =>
  `${op} compares two numbers or two pieces of text.`;

// Each operand is checked before an unknown one decides the result, so a
// rejected operand is an error whatever the other operand is.
export function binary({
  op,
  left,
  right,
}: {
  op: Exclude<BinaryOp, BinaryOp.Coalesce>;
  left: Value;
  right: Value;
}): Value {
  const each = (accepts: (side: Value) => boolean, message: string) => {
    if (![left, right].every((side) => side === null || accepts(side))) {
      throw evalError(message);
    }
  };
  switch (op) {
    case BinaryOp.And:
    case BinaryOp.Or:
      return logical({ op, left, right });
    case BinaryOp.Equal:
    case BinaryOp.NotEqual:
      each(isPrimitive, COMPARES_PRIMITIVES_ONLY);
      if (left === null || right === null) return null;
      return (left === right) === (op === BinaryOp.Equal);
    case BinaryOp.LessThan:
    case BinaryOp.GreaterThan:
    case BinaryOp.LessOrEqual:
    case BinaryOp.GreaterOrEqual:
      each(
        (side) => typeof side === "number" || typeof side === "string",
        comparesMessage(op),
      );
      if (left === null || right === null) return null;
      return relational({ op, left, right });
    case BinaryOp.Add:
      each(isPrimitive, ADD_NEEDS);
      if (left === null || right === null) return null;
      if (typeof left === "number" && typeof right === "number") {
        return finite(left + right, "+");
      }
      if (typeof left === "string" || typeof right === "string") {
        return `${String(left)}${String(right)}`;
      }
      throw evalError(ADD_NEEDS);
    case BinaryOp.Subtract:
    case BinaryOp.Multiply:
    case BinaryOp.Divide:
    case BinaryOp.Modulo:
    case BinaryOp.Exponent:
      each((side) => typeof side === "number", needsNumbers(op));
      if (left === null || right === null) return null;
      if (typeof left !== "number" || typeof right !== "number") {
        throw evalError(needsNumbers(op));
      }
      return finite(ARITHMETIC[op](left, right), op);
    default:
      throw new Error(`unknown binary op: ${op satisfies never}`);
  }
}

const ARITHMETIC: Record<
  | BinaryOp.Subtract
  | BinaryOp.Multiply
  | BinaryOp.Divide
  | BinaryOp.Modulo
  | BinaryOp.Exponent,
  (left: number, right: number) => number
> = {
  [BinaryOp.Subtract]: (left, right) => left - right,
  [BinaryOp.Multiply]: (left, right) => left * right,
  [BinaryOp.Divide]: (left, right) => left / right,
  [BinaryOp.Modulo]: (left, right) => left % right,
  [BinaryOp.Exponent]: (left, right) => left ** right,
};

function relational({
  op,
  left,
  right,
}: {
  op:
    | BinaryOp.LessThan
    | BinaryOp.GreaterThan
    | BinaryOp.LessOrEqual
    | BinaryOp.GreaterOrEqual;
  left: Value;
  right: Value;
}): boolean {
  if (
    !(typeof left === "number" && typeof right === "number") &&
    !(typeof left === "string" && typeof right === "string")
  ) {
    throw evalError(comparesMessage(op));
  }
  switch (op) {
    case BinaryOp.LessThan:
      return left < right;
    case BinaryOp.GreaterThan:
      return left > right;
    case BinaryOp.LessOrEqual:
      return left <= right;
    case BinaryOp.GreaterOrEqual:
      return left >= right;
    default:
      throw new Error(`unknown relational op: ${op satisfies never}`);
  }
}
