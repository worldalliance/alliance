import { IS_ON_LIST } from "./catalog";
import {
  BinaryOp,
  ExprKind,
  UnaryOp,
  type Expr,
  type LiteralValue,
} from "./tree";

const WIDTH = 80;

enum DocKind {
  Group = "group",
  Indent = "indent",
  Line = "line",
}

type Doc =
  | string
  | readonly Doc[]
  | { kind: DocKind.Group; doc: Doc }
  | { kind: DocKind.Indent; doc: Doc }
  | { kind: DocKind.Line; flat: string };

const isList = (doc: Doc): doc is readonly Doc[] => Array.isArray(doc);

const group = (doc: Doc): Doc => ({ kind: DocKind.Group, doc });
const indent = (doc: Doc): Doc => ({ kind: DocKind.Indent, doc });
const line: Doc = { kind: DocKind.Line, flat: " " };
const softline: Doc = { kind: DocKind.Line, flat: "" };

type Frame = { depth: number; flat: boolean; doc: Doc };

/**
 * Whether `doc` fits flat in `room` together with what follows it up to the
 * next line break, as in Wadler's and Prettier's `fits`, so a separator after
 * a group counts against the group.
 */
function fits({
  doc,
  rest,
  room,
}: {
  doc: Doc;
  rest: readonly Frame[];
  room: number;
}): boolean {
  const pending: { flat: boolean; doc: Doc }[] = [{ flat: true, doc }];
  let restIndex = rest.length;
  while (room >= 0) {
    const frame = pending.pop() ?? rest[--restIndex];
    if (frame === undefined) return true;
    const { flat, doc: next } = frame;
    if (typeof next === "string") {
      const lineBreak = next.indexOf("\n");
      if (lineBreak >= 0) return lineBreak <= room;
      room -= next.length;
    } else if (isList(next)) {
      for (let index = next.length - 1; index >= 0; index -= 1) {
        pending.push({ flat, doc: next[index] });
      }
    } else {
      switch (next.kind) {
        case DocKind.Group:
        case DocKind.Indent:
          pending.push({ flat, doc: next.doc });
          break;
        case DocKind.Line:
          if (!flat) return true;
          room -= next.flat.length;
          break;
        default:
          throw new Error(`unknown doc kind: ${next satisfies never}`);
      }
    }
  }
  return false;
}

function render(doc: Doc): string {
  let out = "";
  let column = 0;
  const stack: Frame[] = [{ depth: 0, flat: false, doc }];
  for (let frame = stack.pop(); frame !== undefined; frame = stack.pop()) {
    const { depth, flat, doc: next } = frame;
    if (typeof next === "string") {
      out += next;
      const lineBreak = next.lastIndexOf("\n");
      column =
        lineBreak >= 0 ? next.length - lineBreak - 1 : column + next.length;
      continue;
    }
    if (isList(next)) {
      for (let index = next.length - 1; index >= 0; index -= 1) {
        stack.push({ depth, flat, doc: next[index] });
      }
      continue;
    }
    switch (next.kind) {
      case DocKind.Group: {
        stack.push({
          depth,
          flat:
            flat || fits({ doc: next.doc, rest: stack, room: WIDTH - column }),
          doc: next.doc,
        });
        break;
      }
      case DocKind.Indent:
        stack.push({ depth: depth + 2, flat, doc: next.doc });
        break;
      case DocKind.Line:
        if (flat) {
          out += next.flat;
          column += next.flat.length;
        } else {
          out += `\n${" ".repeat(depth)}`;
          column = depth;
        }
        break;
      default:
        throw new Error(`unknown doc kind: ${next satisfies never}`);
    }
  }
  return out;
}

const BINARY_PRECEDENCE: Record<BinaryOp, number> = {
  [BinaryOp.Coalesce]: 3,
  [BinaryOp.Or]: 4,
  [BinaryOp.And]: 5,
  [BinaryOp.Equal]: 9,
  [BinaryOp.NotEqual]: 9,
  [BinaryOp.LessThan]: 10,
  [BinaryOp.GreaterThan]: 10,
  [BinaryOp.LessOrEqual]: 10,
  [BinaryOp.GreaterOrEqual]: 10,
  [BinaryOp.Add]: 12,
  [BinaryOp.Subtract]: 12,
  [BinaryOp.Multiply]: 13,
  [BinaryOp.Divide]: 13,
  [BinaryOp.Modulo]: 13,
  [BinaryOp.Exponent]: 14,
};

const CONDITIONAL = 2;
const UNARY = 15;
const POSTFIX = 17;
const PRIMARY = 18;

function precedence(expr: Expr): number {
  switch (expr.kind) {
    case ExprKind.Literal:
    case ExprKind.Input:
    case ExprKind.Ref:
    case ExprKind.Param:
    case ExprKind.List:
    case ExprKind.Record:
    case ExprKind.Template:
      return PRIMARY;
    case ExprKind.Unary:
      return UNARY;
    case ExprKind.Binary:
      return BINARY_PRECEDENCE[expr.op];
    case ExprKind.Conditional:
    case ExprKind.Lambda:
      return CONDITIONAL;
    case ExprKind.Member:
    case ExprKind.Index:
    case ExprKind.Call:
    case ExprKind.Method:
    case ExprKind.OnList:
      return POSTFIX;
    default:
      throw new Error(`unknown kind: ${expr satisfies never}`);
  }
}

// `- -x` printed tight reads as `--x`, a decrement.
const DOUBLES_INTO_TOKEN: Record<UnaryOp, boolean> = {
  [UnaryOp.Negate]: true,
  [UnaryOp.Not]: false,
};

const LOGICAL: Record<BinaryOp, boolean> = {
  [BinaryOp.Add]: false,
  [BinaryOp.Subtract]: false,
  [BinaryOp.Multiply]: false,
  [BinaryOp.Divide]: false,
  [BinaryOp.Modulo]: false,
  [BinaryOp.Exponent]: false,
  [BinaryOp.LessThan]: false,
  [BinaryOp.GreaterThan]: false,
  [BinaryOp.LessOrEqual]: false,
  [BinaryOp.GreaterOrEqual]: false,
  [BinaryOp.Equal]: false,
  [BinaryOp.NotEqual]: false,
  [BinaryOp.And]: true,
  [BinaryOp.Or]: true,
  [BinaryOp.Coalesce]: true,
};

// A member's property comes from an identifier the parser accepted, and Unicode
// never withdraws an identifier character, so this engine's tables accept it too.
const IDENTIFIER = /^[\p{ID_Start}$_][\p{ID_Continue}$\u200C\u200D]*$/u;
// A record key can be any text, and the engine's Unicode tables can be newer
// than the parser's, so only ASCII keys are written bare.
export const BARE_KEY = /^[A-Za-z_$][\w$]*$/;

export type PrintNames = {
  /**
   * The current name of a named expression; the printer throws for an id
   * with none, since printing the id would read back as another name. A
   * name in `params`, the function parameters around the reference, would
   * print a read of the parameter, so callers rule that out.
   */
  refName: (id: string, params: ReadonlySet<string>) => string | undefined;
  /** A member list's current name; the printer throws for an id with none. */
  listName: (id: string) => string | undefined;
};

/** Prints a tree in its canonical layout, which is what admins see as text. */
export function printExpression(expr: Expr, names: PrintNames): string {
  return render(toDoc(expr, names, new Set()));
}

function toDoc(
  expr: Expr,
  names: PrintNames,
  params: ReadonlySet<string>,
): Doc {
  const at = (child: Expr, minimum: number): Doc => {
    const doc = toDoc(child, names, params);
    return precedence(child) < minimum ? ["(", doc, ")"] : doc;
  };
  const list = ({
    open,
    items,
    close,
  }: {
    open: string;
    items: Doc[];
    close: string;
  }): Doc =>
    items.length === 0
      ? `${open}${close}`
      : group([
          open,
          indent([softline, join(items, [",", line])]),
          softline,
          close,
        ]);
  // TypeScript reads `a < b, c > (d)` as a call with type arguments, so an
  // item followed by a comma can't end in a bare `<` comparison.
  const items = (exprs: readonly Expr[]): Doc[] =>
    exprs.map((item, index) => {
      const closed = index < exprs.length - 1 && endsInLessThan(item);
      if (item.kind === ExprKind.Lambda) return lambda(item, { closed });
      return closed
        ? ["(", toDoc(item, names, params), ")"]
        : at(item, CONDITIONAL);
    });
  const lambda = (
    expr: Extract<Expr, { kind: ExprKind.Lambda }>,
    { closed }: { closed: boolean },
  ): Doc => {
    const head =
      expr.params.length === 1 ? expr.params[0] : `(${expr.params.join(", ")})`;
    const body = toDoc(expr.body, names, new Set([...params, ...expr.params]));
    return [
      head,
      " => ",
      closed ||
      startsWithRecord(expr.body) ||
      precedence(expr.body) < CONDITIONAL
        ? ["(", body, ")"]
        : body,
    ];
  };
  const args = (exprs: readonly Expr[]) =>
    list({ open: "(", items: items(exprs), close: ")" });

  switch (expr.kind) {
    case ExprKind.Literal:
      return literal(expr.value);
    case ExprKind.Input:
      return expr.id;
    case ExprKind.Ref: {
      const name = names.refName(expr.id, params);
      if (name === undefined) {
        throw new Error(`no name for named expression ${expr.id}`);
      }
      return name;
    }
    case ExprKind.Param:
      return expr.name;
    case ExprKind.OnList: {
      const name = names.listName(expr.listId);
      if (name === undefined) {
        throw new Error(`no name for member list ${expr.listId}`);
      }
      return [IS_ON_LIST, "(", literal(name), ")"];
    }
    case ExprKind.List:
      return list({ open: "[", items: items(expr.items), close: "]" });
    case ExprKind.Record:
      return expr.entries.length === 0
        ? "{}"
        : group([
            "{",
            indent([
              line,
              join(
                expr.entries.map(({ key, value }) => [
                  BARE_KEY.test(key) ? key : JSON.stringify(key),
                  ": ",
                  at(value, CONDITIONAL),
                ]),
                [",", line],
              ),
            ]),
            line,
            "}",
          ]);
    case ExprKind.Template:
      return [
        "`",
        ...expr.parts.flatMap((part, index) => [
          escapeTemplate(expr.quasis[index]),
          "${",
          toDoc(part, names, params),
          "}",
        ]),
        escapeTemplate(expr.quasis[expr.parts.length]),
        "`",
      ];
    case ExprKind.Unary: {
      const doubled =
        DOUBLES_INTO_TOKEN[expr.op] && expr.operand.kind === ExprKind.Unary;
      return [expr.op, at(expr.operand, doubled ? POSTFIX : UNARY)];
    }
    case ExprKind.Binary:
      return binary(expr, at);
    case ExprKind.Conditional:
      return group([
        at(expr.test, BINARY_PRECEDENCE[BinaryOp.Coalesce]),
        indent([
          line,
          "? ",
          at(expr.consequent, CONDITIONAL),
          line,
          ": ",
          at(expr.alternate, CONDITIONAL),
        ]),
      ]);
    case ExprKind.Member:
      // The parser builds a member only from `.name`; brackets would parse
      // back as an index.
      if (!IDENTIFIER.test(expr.property))
        throw new Error(
          `member property isn't an identifier: ${expr.property}`,
        );
      return [
        target(expr.target, at),
        expr.optional ? "?." : ".",
        expr.property,
      ];
    case ExprKind.Index:
      return [
        target(expr.target, at),
        expr.optional ? "?.[" : "[",
        toDoc(expr.index, names, params),
        "]",
      ];
    case ExprKind.Call:
      return [expr.fn, args(expr.args)];
    case ExprKind.Method:
      return [
        target(expr.target, at),
        expr.optional ? "?." : ".",
        expr.method,
        args(expr.args),
      ];
    case ExprKind.Lambda:
      return lambda(expr, { closed: false });
    default:
      throw new Error(`unknown kind: ${expr satisfies never}`);
  }
}

// A lambda body starting with `{` reads as a block. Parentheses inside the
// body can already hide the record, which leaves the wrap redundant but valid.
function startsWithRecord(expr: Expr): boolean {
  switch (expr.kind) {
    case ExprKind.Record:
      return true;
    case ExprKind.Member:
    case ExprKind.Index:
    case ExprKind.Method:
      return startsWithRecord(expr.target);
    case ExprKind.Binary:
      return startsWithRecord(expr.left);
    case ExprKind.Conditional:
      return startsWithRecord(expr.test);
    case ExprKind.Literal:
    case ExprKind.Input:
    case ExprKind.Ref:
    case ExprKind.Param:
    case ExprKind.List:
    case ExprKind.Template:
    case ExprKind.Unary:
    case ExprKind.Call:
    case ExprKind.Lambda:
    case ExprKind.OnList:
      return false;
    default:
      throw new Error(`unknown kind: ${expr satisfies never}`);
  }
}

// Follows the operands printed last, which may be parenthesized after all.
function endsInLessThan(expr: Expr): boolean {
  switch (expr.kind) {
    case ExprKind.Binary:
      return expr.op === BinaryOp.LessThan || endsInLessThan(expr.right);
    case ExprKind.Conditional:
      return endsInLessThan(expr.alternate);
    case ExprKind.Lambda:
      return endsInLessThan(expr.body);
    case ExprKind.Literal:
    case ExprKind.Input:
    case ExprKind.Ref:
    case ExprKind.Param:
    case ExprKind.List:
    case ExprKind.Record:
    case ExprKind.Template:
    case ExprKind.Unary:
    case ExprKind.Member:
    case ExprKind.Index:
    case ExprKind.Call:
    case ExprKind.Method:
    case ExprKind.OnList:
      return false;
    default:
      throw new Error(`unknown kind: ${expr satisfies never}`);
  }
}

type At = (child: Expr, minimum: number) => Doc;

function target(expr: Expr, at: At): Doc {
  return expr.kind === ExprKind.Literal && typeof expr.value === "number"
    ? ["(", at(expr, 0), ")"]
    : at(expr, POSTFIX);
}

function binary(expr: Extract<Expr, { kind: ExprKind.Binary }>, at: At): Doc {
  const own = BINARY_PRECEDENCE[expr.op];
  // Mixing `??` with `&&` or `||` unparenthesized is a syntax error, and mixing
  // `&&` with `||` reads ambiguously, so a different logical operator nests in
  // parentheses.
  const operand = (child: Expr, minimum: number): Doc =>
    LOGICAL[expr.op] &&
    child.kind === ExprKind.Binary &&
    LOGICAL[child.op] &&
    child.op !== expr.op
      ? ["(", at(child, 0), ")"]
      : at(child, minimum);

  if (expr.op === BinaryOp.Exponent) {
    return [operand(expr.left, POSTFIX), " ** ", operand(expr.right, own)];
  }
  const chain: Expr[] = [expr.right];
  let first: Expr = expr.left;
  while (first.kind === ExprKind.Binary && first.op === expr.op) {
    chain.unshift(first.right);
    first = first.left;
  }
  return group([
    operand(first, own),
    indent(chain.map((next) => [line, expr.op, " ", operand(next, own + 1)])),
  ]);
}

function literal(value: LiteralValue): string {
  if (typeof value === "string") return JSON.stringify(value);
  // Text writes a negative number as `-` applied to it.
  if (
    typeof value === "number" &&
    (!Number.isFinite(value) || value < 0 || Object.is(value, -0))
  ) {
    throw new Error(`number literal text can't write: ${value}`);
  }
  return String(value);
}

function escapeTemplate(text: string): string {
  return text
    .replaceAll("\\", "\\\\")
    .replaceAll("`", "\\`")
    .replaceAll("${", "\\${")
    .replaceAll("\r", "\\r");
}

function join(items: readonly Doc[], separator: Doc): Doc[] {
  return items.flatMap((item, index) =>
    index === 0 ? [item] : [separator, item],
  );
}
