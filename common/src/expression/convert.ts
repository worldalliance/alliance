import ts from "typescript";
import {
  FORBIDDEN_PROPERTIES,
  KNOWN_METHODS,
  MATH_FUNCTION_NAMES,
  MATH_OBJECT_NAME,
} from "../forms/formula-allowlist";
import { R, type Result } from "../result";
import {
  IS_MISSING,
  IS_MISSING_HINT,
  IS_ON_LIST,
  type Diagnostic,
  type Scope,
} from "./catalog";
import { STRICT_RESERVED } from "./convert-scope";
import {
  BINARY_OPS,
  COALESCE_MIXES,
  LOOSE_EQUALITY,
  ORDERING,
  unparenthesized,
  unsupportedMessage,
} from "./convert-syntax";
import { ExprKind, LAMBDA_ONLY_AS_ARGUMENT, UnaryOp, type Expr } from "./tree";

export const TYPE_ARGUMENTS =
  "TypeScript reads a `<` here and a `>` after it as a call with type arguments. Write the `<` comparison the other way round, with `>`.";

const UNDEFINED_UNSUPPORTED = `\`undefined\` isn't supported. ${IS_MISSING_HINT}`;

const MATH_FUNCTIONS: ReadonlySet<string> = new Set(MATH_FUNCTION_NAMES);

/**
 * Every tree node mapped to the TypeScript node it was converted from. A
 * parenthesized part maps to the parenthesized node, parentheses included.
 */
export type Converted = {
  tree: Expr;
  source: ReadonlyMap<Expr, ts.Expression>;
};

/** A function (`x => …`) is accepted only as a method's first argument. */
type Position = { lambdaAllowed: boolean };

class Converter {
  readonly source = new Map<Expr, ts.Expression>();
  readonly diagnostics: Diagnostic[] = [];
  private readonly params: string[][] = [];
  private readonly functions: ReadonlySet<string>;
  private readonly inputs: ReadonlySet<string>;
  private readonly namedIds: ReadonlyMap<string, string>;
  private readonly listIds: ReadonlyMap<string, string>;

  constructor(
    private readonly file: ts.SourceFile,
    scope: Scope,
  ) {
    this.functions = new Set(scope.catalog.functions.map((fn) => fn.name));
    this.inputs = new Set(scope.catalog.inputs.map((input) => input.id));
    this.namedIds = new Map(scope.named.map((named) => [named.name, named.id]));
    this.listIds = new Map(
      scope.catalog.lists.map((list) => [list.name, list.id]),
    );
  }

  private fail(node: ts.Node, message: string): Expr {
    return this.failAt(
      { start: node.getStart(this.file), end: node.getEnd() },
      message,
    );
  }

  private failAt(span: { start: number; end: number }, message: string): Expr {
    this.diagnostics.push({ message, ...span });
    return { kind: ExprKind.Literal, value: null };
  }

  /** Located on the comma after the hole, since the hole has no text. */
  private emptyItem(hole: ts.OmittedExpression): Expr {
    const scanner = ts.createScanner(ts.ScriptTarget.ES2020, true);
    scanner.setText(this.file.text, hole.end);
    scanner.scan();
    const comma = scanner.getTokenStart();
    return this.failAt(
      { start: comma, end: comma + 1 },
      "A list can't have an empty item.",
    );
  }

  /**
   * Postgres jsonb can't store U+0000 or an unpaired surrogate, so a tree
   * holding either can't be saved.
   */
  private storable(node: ts.Node & { text: string }): string {
    if (/[\0\p{Cs}]/u.test(node.text)) {
      this.fail(node, "This text has a character that can't be stored.");
    }
    return node.text;
  }

  private unsupported(node: ts.Node): Expr {
    return this.fail(node, unsupportedMessage(node.getText(this.file)));
  }

  convert(
    node: ts.Expression,
    position: Position = { lambdaAllowed: false },
  ): Expr {
    const tree = this.convertNode(node, position);
    this.source.set(tree, node);
    return tree;
  }

  private convertNode(node: ts.Expression, position: Position): Expr {
    if (ts.isParenthesizedExpression(node)) {
      return this.convertNode(node.expression, position);
    }
    if (ts.isNumericLiteral(node)) {
      const value = Number(node.text);
      // Past this a double skips integers, so `9007199254740993` would be
      // stored as `9007199254740992`.
      if (value > Number.MAX_SAFE_INTEGER) {
        return this.fail(node, "This number is too large.");
      }
      // `node.text` is already rounded, so `1.00000000000000001` reads as 1.
      // A hex, octal or binary literal is a safe integer by now, so exact.
      const source = node.getText(this.file);
      return /^0[box]/i.test(source) ||
        decimalDigits(source) === decimalDigits(String(value))
        ? { kind: ExprKind.Literal, value }
        : this.fail(node, "This number has more digits than can be stored.");
    }
    if (ts.isStringLiteral(node)) {
      return { kind: ExprKind.Literal, value: this.storable(node) };
    }
    if (ts.isNoSubstitutionTemplateLiteral(node)) {
      return {
        kind: ExprKind.Template,
        quasis: [this.storable(node)],
        parts: [],
      };
    }
    if (ts.isTemplateExpression(node)) {
      return {
        kind: ExprKind.Template,
        quasis: [
          this.storable(node.head),
          ...node.templateSpans.map((s) => this.storable(s.literal)),
        ],
        parts: node.templateSpans.map((span) => this.convert(span.expression)),
      };
    }
    switch (node.kind) {
      case ts.SyntaxKind.TrueKeyword:
        return { kind: ExprKind.Literal, value: true };
      case ts.SyntaxKind.FalseKeyword:
        return { kind: ExprKind.Literal, value: false };
      case ts.SyntaxKind.NullKeyword:
        return { kind: ExprKind.Literal, value: null };
    }
    if (ts.isIdentifier(node)) return this.identifier(node);
    if (ts.isArrayLiteralExpression(node)) {
      return {
        kind: ExprKind.List,
        items: node.elements.map((item) =>
          ts.isOmittedExpression(item)
            ? this.emptyItem(item)
            : ts.isSpreadElement(item)
              ? this.unsupported(item)
              : this.convert(item),
        ),
      };
    }
    if (ts.isObjectLiteralExpression(node)) return this.record(node);
    if (ts.isPrefixUnaryExpression(node)) {
      const op =
        node.operator === ts.SyntaxKind.ExclamationToken
          ? UnaryOp.Not
          : node.operator === ts.SyntaxKind.MinusToken
            ? UnaryOp.Negate
            : undefined;
      return op === undefined
        ? this.unsupported(node)
        : { kind: ExprKind.Unary, op, operand: this.convert(node.operand) };
    }
    if (ts.isBinaryExpression(node)) return this.binary(node);
    if (ts.isConditionalExpression(node)) {
      return {
        kind: ExprKind.Conditional,
        test: this.convert(node.condition),
        consequent: this.convert(node.whenTrue),
        alternate: this.convert(node.whenFalse),
      };
    }
    if (ts.isPropertyAccessExpression(node)) return this.member(node);
    if (ts.isElementAccessExpression(node)) {
      const key = unparenthesized(node.argumentExpression);
      if (ts.isStringLiteralLike(key) && FORBIDDEN_PROPERTIES.has(key.text)) {
        return this.fail(key, `\`${key.text}\` can't be read.`);
      }
      return {
        kind: ExprKind.Index,
        target: this.target(node.expression),
        index: this.convert(node.argumentExpression),
        optional: node.questionDotToken !== undefined,
      };
    }
    if (ts.isCallExpression(node)) return this.call(node);
    if (ts.isArrowFunction(node)) return this.lambda(node, position);
    if (ts.isNonNullExpression(node)) {
      return this.fail(
        node,
        `\`!\` after a value isn't supported. ${IS_MISSING_HINT}`,
      );
    }
    if (ts.isTaggedTemplateExpression(node) && node.typeArguments) {
      return this.fail(node, TYPE_ARGUMENTS);
    }
    return this.unsupported(node);
  }

  private identifier(node: ts.Identifier): Expr {
    const name = node.text;
    if (this.isParam(name)) return { kind: ExprKind.Param, name };
    if (name === "undefined") return this.fail(node, UNDEFINED_UNSUPPORTED);
    if (this.inputs.has(name)) return { kind: ExprKind.Input, id: name };
    const named = this.namedIds.get(name);
    if (named !== undefined) return { kind: ExprKind.Ref, id: named };
    if (
      this.functions.has(name) ||
      name === IS_MISSING ||
      name === IS_ON_LIST
    ) {
      return this.fail(node, `\`${name}\` is a function; call it with (…).`);
    }
    return this.fail(node, `Nothing here is called \`${name}\`.`);
  }

  private onList(node: ts.CallExpression): Expr {
    const [arg, ...rest] = node.arguments.map(unparenthesized);
    if (arg === undefined || rest.length > 0 || !ts.isStringLiteralLike(arg)) {
      return this.fail(
        node,
        `Name one list in quotes, like \`${IS_ON_LIST}("List name")\`.`,
      );
    }
    const listId = this.listIds.get(arg.text);
    if (listId !== undefined) return { kind: ExprKind.OnList, listId };
    const names = [...this.listIds.keys()].map((name) => JSON.stringify(name));
    return this.fail(
      arg,
      names.length === 0
        ? "There are no member lists yet."
        : `There's no list called ${JSON.stringify(arg.text)}. Lists: ${names.join(", ")}.`,
    );
  }

  private record(node: ts.ObjectLiteralExpression): Expr {
    const entries: { key: string; value: Expr }[] = [];
    for (const property of node.properties) {
      const entry = ts.isPropertyAssignment(property)
        ? (ts.isIdentifier(property.name) ||
            ts.isStringLiteral(property.name)) && {
            key: ts.isStringLiteral(property.name)
              ? this.storable(property.name)
              : property.name.text,
            value: property.initializer,
          }
        : ts.isShorthandPropertyAssignment(property) && {
            key: property.name.text,
            value: property.name,
          };
      // Only TypeScript's checker rejects a `?`, `!` or modifier on a key, or
      // an `=` after a shorthand one, and the tree has nowhere to keep them.
      const marked =
        property.getChildCount(this.file) !==
        (ts.isPropertyAssignment(property) ? 3 : 1);
      if (!entry || marked) {
        this.unsupported(property);
      } else if (FORBIDDEN_PROPERTIES.has(entry.key)) {
        this.fail(property, `\`${entry.key}\` can't be used as a key.`);
      } else {
        entries.push({ key: entry.key, value: this.convert(entry.value) });
      }
    }
    return { kind: ExprKind.Record, entries };
  }

  private binary(node: ts.BinaryExpression): Expr {
    const kind = node.operatorToken.kind;
    const loose = LOOSE_EQUALITY.get(kind);
    if (loose !== undefined) {
      const comparesNull = [node.left, node.right].some(
        (side) => unparenthesized(side).kind === ts.SyntaxKind.NullKeyword,
      );
      return this.fail(
        node.operatorToken,
        comparesNull
          ? IS_MISSING_HINT
          : `Use \`${loose}\`; \`${node.operatorToken.getText(this.file)}\` isn't supported.`,
      );
    }
    const op = BINARY_OPS.get(kind);
    if (op === undefined) return this.unsupported(node);
    const mixed = [node.left, node.right]
      .filter(ts.isBinaryExpression)
      .map((side) => side.operatorToken.kind)
      .find(
        (inner) =>
          (kind === ts.SyntaxKind.QuestionQuestionToken) !==
            (inner === ts.SyntaxKind.QuestionQuestionToken) &&
          [kind, inner].every((each) => COALESCE_MIXES.has(each)),
      );
    const nested = [node.left, node.right]
      .map(unparenthesized)
      .some(
        (side) =>
          ts.isBinaryExpression(side) && ORDERING.has(side.operatorToken.kind),
      );
    if (ORDERING.has(kind) && nested) {
      return this.fail(
        node.operatorToken,
        "`<`, `>`, `<=` and `>=` can't compare the yes/no result of another comparison.",
      );
    }
    if (mixed !== undefined) {
      const other = ts.tokenToString(
        kind === ts.SyntaxKind.QuestionQuestionToken ? mixed : kind,
      );
      return this.fail(
        node.operatorToken,
        `\`??\` and \`${other}\` can't be mixed without parentheses.`,
      );
    }
    return {
      kind: ExprKind.Binary,
      op,
      left: this.convert(node.left),
      right: this.convert(node.right),
    };
  }

  private member(node: ts.PropertyAccessExpression): Expr {
    if (!ts.isIdentifier(node.name)) return this.unsupported(node);
    const property = node.name.text;
    if (FORBIDDEN_PROPERTIES.has(property)) {
      return this.fail(node.name, `\`${property}\` can't be read.`);
    }
    if (this.isMath(node.expression)) {
      return this.fail(
        node,
        MATH_FUNCTIONS.has(property)
          ? `Call \`${MATH_OBJECT_NAME}.${property}(…)\`.`
          : `There's no \`${MATH_OBJECT_NAME}.${property}\`.`,
      );
    }
    return {
      kind: ExprKind.Member,
      target: this.target(node.expression),
      property,
      optional: node.questionDotToken !== undefined,
    };
  }

  /** The tree has no parentheses, so `(a?.b).c` would print as `a?.b.c`. */
  private target(node: ts.Expression): Expr {
    return ts.isParenthesizedExpression(node) &&
      ts.isOptionalChain(unparenthesized(node))
      ? this.fail(node, "Remove the parentheses around this `?.` chain.")
      : this.convert(node);
  }

  private isMath(node: ts.Expression): boolean {
    return (
      ts.isIdentifier(node) &&
      node.text === MATH_OBJECT_NAME &&
      !this.isParam(MATH_OBJECT_NAME)
    );
  }

  private isParam(name: string): boolean {
    return this.params.some((scope) => scope.includes(name));
  }

  private call(node: ts.CallExpression): Expr {
    if (node.typeArguments !== undefined) {
      return this.fail(node, TYPE_ARGUMENTS);
    }
    if (node.questionDotToken !== undefined) return this.unsupported(node);
    const { expression: callee } = node;
    const args = ({ lambdaFirst }: { lambdaFirst: boolean }) =>
      node.arguments.map((arg, index) =>
        this.convert(arg, { lambdaAllowed: lambdaFirst && index === 0 }),
      );
    if (ts.isIdentifier(callee)) {
      const name = callee.text;
      if (this.isParam(name)) {
        return this.fail(callee, `\`${name}\` is a parameter, not a function.`);
      }
      if (name === IS_ON_LIST) return this.onList(node);
      if (name !== IS_MISSING && !this.functions.has(name)) {
        return this.fail(callee, `There's no function called \`${name}\`.`);
      }
      return {
        kind: ExprKind.Call,
        fn: name,
        args: args({ lambdaFirst: false }),
      };
    }
    if (
      !ts.isPropertyAccessExpression(callee) ||
      !ts.isIdentifier(callee.name)
    ) {
      return this.unsupported(node);
    }
    const name = callee.name.text;
    if (this.isMath(callee.expression)) {
      return MATH_FUNCTIONS.has(name)
        ? {
            kind: ExprKind.Call,
            fn: `${MATH_OBJECT_NAME}.${name}`,
            args: args({ lambdaFirst: false }),
          }
        : this.fail(
            callee.name,
            `There's no function \`${MATH_OBJECT_NAME}.${name}\`.`,
          );
    }
    if (!KNOWN_METHODS.has(name)) {
      return this.fail(callee.name, `There's no method called \`${name}\`.`);
    }
    return {
      kind: ExprKind.Method,
      target: this.target(callee.expression),
      method: name,
      args: args({ lambdaFirst: true }),
      optional: callee.questionDotToken !== undefined,
    };
  }

  private lambda(node: ts.ArrowFunction, { lambdaAllowed }: Position): Expr {
    if (!lambdaAllowed) {
      return this.fail(node, LAMBDA_ONLY_AS_ARGUMENT);
    }
    const params: string[] = [];
    for (const param of node.parameters) {
      if (
        !ts.isIdentifier(param.name) ||
        param.initializer !== undefined ||
        param.dotDotDotToken !== undefined ||
        param.questionToken !== undefined ||
        param.type !== undefined ||
        (param.modifiers?.length ?? 0) > 0
      ) {
        return this.unsupported(param);
      }
      if (param.name.text === "undefined") {
        return this.fail(param, UNDEFINED_UNSUPPORTED);
      }
      if (param.name.text === "this") return this.unsupported(param);
      if (
        STRICT_RESERVED.has(param.name.text) ||
        param.name.text === "eval" ||
        param.name.text === "arguments"
      ) {
        return this.fail(
          param,
          `\`${param.name.text}\` can't name a parameter.`,
        );
      }
      if (params.includes(param.name.text)) {
        return this.fail(
          param,
          `\`${param.name.text}\` is already a parameter.`,
        );
      }
      params.push(param.name.text);
    }
    if (
      ts.isBlock(node.body) ||
      node.type !== undefined ||
      node.typeParameters !== undefined ||
      (node.modifiers?.length ?? 0) > 0
    ) {
      return this.unsupported(node);
    }
    this.params.push(params);
    const body = this.convert(node.body);
    this.params.pop();
    return { kind: ExprKind.Lambda, params, body };
  }
}

/** Diagnostic spans are offsets into `file`. */
export function convertExpression({
  node,
  file,
  scope,
}: {
  node: ts.Expression;
  file: ts.SourceFile;
  scope: Scope;
}): Result<Converted, Diagnostic[]> {
  const converter = new Converter(file, scope);
  const tree = converter.convert(node);
  return converter.diagnostics.length > 0
    ? R.failure(converter.diagnostics)
    : R.success({ tree, source: converter.source });
}

/** Significant digits and exponent, so `0.50` and `5e-1` compare equal. */
function decimalDigits(text: string): string {
  const [mantissa = "", exponent = "0"] = text
    .replaceAll("_", "")
    .toLowerCase()
    .split("e");
  const [whole = "", fraction = ""] = mantissa.split(".");
  const digits = (whole + fraction).replace(/^0+/, "");
  const significant = digits.replace(/0+$/, "");
  const leadingZeros = whole.length + fraction.length - digits.length;
  return significant === ""
    ? "0"
    : `${significant}e${Number(exponent) + whole.length - leadingZeros}`;
}
