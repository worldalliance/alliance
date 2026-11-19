import {
  MATH_BINARY_FUNCTIONS,
  MATH_FUNCTIONS,
  MATH_VARIADIC_FUNCTIONS,
} from "../forms/formula-allowlist";
import { R, type Result } from "../result";
import {
  IS_MISSING,
  TypeKind,
  isRecordValue,
  mismatch,
  project,
  type Scope,
  type Value,
} from "./catalog";
import {
  SHOWS_PRIMITIVES_ONLY,
  callMethod,
  ignoresArgumentsBesideFunction,
  isPrimitive,
  type Lambda,
} from "./evaluate-methods";
import { binary, unary } from "./evaluate-operators";
import {
  Failure,
  FailureKind,
  evalError,
  finite,
  runEvery,
  type EvalFailure,
} from "./failure";
import {
  BinaryOp,
  ExprKind,
  LAMBDA_ONLY_AS_ARGUMENT,
  mathFunctionName,
  type Expr,
} from "./tree";

export type Bindings = Scope & {
  readInput: (id: string) => Result<Value, EvalFailure>;
  callFunction: (
    name: string,
    args: readonly Value[],
  ) => Result<Value, EvalFailure>;
};

type Params = ReadonlyMap<string, Value>;

const takes = ({ fn, arity }: { fn: string; arity: number }) =>
  evalError(`${fn} takes ${arity} value${arity === 1 ? "" : "s"}.`);

/**
 * Evaluates a tree. Unknown is `null`: comparisons with it are undecided
 * (`null`), `&&`, `||` and `!` follow SQL's three-valued rules, `??`,
 * `isMissing`, nullable function parameters, a list's `concat` and a
 * `reduce` starting value take it, and other operations on it give `null`. `&&` and `||` evaluate both sides,
 * so an error on either fails the whole expression; `?:` and `??` evaluate
 * only the side they pick.
 */
export function evaluate(
  expr: Expr,
  bindings: Bindings,
): Result<Value, EvalFailure> {
  const evaluator = new Evaluator(bindings);
  try {
    return R.success(evaluator.run(expr, new Map()));
  } catch (thrown) {
    if (thrown instanceof Failure) return R.failure(thrown.failure);
    throw thrown;
  }
}

class Evaluator {
  private readonly inputs = new Map<string, Result<Value, EvalFailure>>();
  private readonly refs = new Map<string, Result<Value, EvalFailure>>();
  private readonly evaluating = new Set<string>();

  constructor(private readonly bindings: Bindings) {}

  run(expr: Expr, params: Params): Value {
    switch (expr.kind) {
      case ExprKind.Literal:
        return expr.value;
      case ExprKind.Input:
        return settle(this.input(expr.id));
      case ExprKind.Ref:
        return settle(this.ref(expr.id));
      case ExprKind.Param: {
        const value = params.get(expr.name);
        if (value === undefined)
          throw evalError(`\`${expr.name}\` isn't defined here.`);
        return value;
      }
      case ExprKind.List:
        return this.all(expr.items, params);
      case ExprKind.Record: {
        const values = this.all(
          expr.entries.map((entry) => entry.value),
          params,
        );
        return Object.fromEntries(
          expr.entries.map((entry, index) => [entry.key, values[index]]),
        );
      }
      case ExprKind.Template:
        return template(expr.quasis, this.all(expr.parts, params));
      case ExprKind.Unary:
        return unary(expr.op, this.run(expr.operand, params));
      case ExprKind.Binary:
        return this.binary(expr, params);
      case ExprKind.Conditional: {
        const test = this.run(expr.test, params);
        if (test === null) return null;
        if (typeof test !== "boolean")
          throw evalError("A ? test needs a yes/no value.");
        return this.run(test ? expr.consequent : expr.alternate, params);
      }
      case ExprKind.Member:
        return member({
          target: this.run(expr.target, params),
          property: expr.property,
          named: true,
        });
      case ExprKind.Index: {
        const [target, index] = this.all([expr.target, expr.index], params);
        return indexInto(target, index);
      }
      case ExprKind.Call:
        return this.call(expr.fn, this.all(expr.args, params));
      case ExprKind.Method: {
        const lambdas = new Map<number, Lambda>();
        const plain: Expr[] = [];
        expr.args.forEach((arg, index) => {
          if (arg.kind === ExprKind.Lambda) {
            lambdas.set(index, (values) =>
              this.run(arg.body, bind({ params, names: arg.params, values })),
            );
          } else {
            plain.push(arg);
          }
        });
        // An expression's function ignores `thisArg`, so `thisArg` is
        // evaluated apart from the receiver and the call, and an error in
        // either outranks pending in the other.
        const ignored =
          lambdas.size > 0 && ignoresArgumentsBesideFunction(expr.method);
        const steps = [
          () => {
            const [target, ...values] = this.all(
              [expr.target, ...(ignored ? [] : plain)],
              params,
            );
            const args = expr.args.map(
              (_, index) => lambdas.get(index) ?? values.shift() ?? null,
            );
            return callMethod({ target, method: expr.method, args });
          },
        ];
        if (ignored) steps.push(() => this.all(plain, params));
        return runEvery(steps, (step) => step())[0];
      }
      case ExprKind.Lambda:
        throw evalError(LAMBDA_ONLY_AS_ARGUMENT);
      default:
        throw new Error(`unknown kind: ${expr satisfies never}`);
    }
  }

  private all(exprs: readonly Expr[], params: Params): Value[] {
    return runEvery(exprs, (expr) => this.run(expr, params));
  }

  private input(id: string): Result<Value, EvalFailure> {
    const cached = this.inputs.get(id);
    if (cached !== undefined) return cached;
    const definition = this.bindings.catalog.inputs.find(
      (input) => input.id === id,
    );
    const read: Result<Value, EvalFailure> =
      definition === undefined
        ? R.failure({
            kind: FailureKind.Error,
            message: `There's no input \`${id}\`.`,
          })
        : R.flatMap(this.bindings.readInput(id), (value) => {
            const problem = mismatch(value, definition.type);
            return problem === undefined
              ? R.success(value)
              : R.failure({
                  kind: FailureKind.Error,
                  message: `Input \`${id}\` doesn't match its type: ${problem}`,
                });
          });
    this.inputs.set(id, read);
    return read;
  }

  private ref(id: string): Result<Value, EvalFailure> {
    const cached = this.refs.get(id);
    if (cached !== undefined) return cached;
    const named = this.bindings.named.find((each) => each.id === id);
    if (named === undefined) {
      return R.failure({
        kind: FailureKind.Error,
        message: `Named expression \`${id}\` doesn't exist.`,
      });
    }
    if (this.evaluating.has(id)) {
      return R.failure({
        kind: FailureKind.Error,
        message: `\`${named.name}\` depends on itself.`,
      });
    }
    this.evaluating.add(id);
    let result: Result<Value, EvalFailure>;
    try {
      result = R.success(this.run(named.tree, new Map()));
    } catch (thrown) {
      if (!(thrown instanceof Failure)) throw thrown;
      result = R.failure(thrown.failure);
    } finally {
      this.evaluating.delete(id);
    }
    this.refs.set(id, result);
    return result;
  }

  private binary(
    expr: Extract<Expr, { kind: ExprKind.Binary }>,
    params: Params,
  ): Value {
    if (expr.op === BinaryOp.Coalesce) {
      const left = this.run(expr.left, params);
      return left === null ? this.run(expr.right, params) : left;
    }
    const [left, right] = this.all([expr.left, expr.right], params);
    return binary({ op: expr.op, left, right });
  }

  private call(fn: string, args: Value[]): Value {
    if (fn === IS_MISSING) {
      if (args.length !== 1) throw evalError(`${IS_MISSING} takes one value.`);
      return args[0] === null;
    }
    const mathName = mathFunctionName(fn);
    const math =
      mathName === undefined ? undefined : MATH_FUNCTIONS.get(mathName);
    if (math !== undefined) {
      if (!args.every((arg) => arg === null || typeof arg === "number")) {
        throw evalError(`${fn} takes numbers.`);
      }
      const arity = MATH_VARIADIC_FUNCTIONS.some((each) => each === mathName)
        ? args.length
        : MATH_BINARY_FUNCTIONS.some((each) => each === mathName)
          ? 2
          : 1;
      if (args.length !== arity) throw takes({ fn, arity });
      if (args.includes(null)) return null;
      return finite(math.apply(Math, args), fn);
    }
    const definition = this.bindings.catalog.functions.find(
      (each) => each.name === fn,
    );
    if (definition === undefined)
      throw evalError(`There's no function \`${fn}\`.`);
    const arity = definition.params.length;
    if (args.length !== arity) throw takes({ fn, arity });
    const projected = definition.params.map((param, index) =>
      project(args[index], param.type),
    );
    for (const [index, param] of definition.params.entries()) {
      const arg = projected[index];
      const problem = arg === null ? undefined : mismatch(arg, param.type);
      if (problem !== undefined)
        throw evalError(`${fn} ${param.name}: ${problem}`);
    }
    const unknownArg = definition.params.some(
      (param, index) =>
        projected[index] === null && !ACCEPTS_MISSING[param.type.kind],
    );
    if (unknownArg) return null;
    const value = settle(this.bindings.callFunction(fn, projected));
    const problem = mismatch(value, definition.returns);
    if (problem !== undefined) {
      throw evalError(
        `${fn} returned a value that doesn't match its type: ${problem}`,
      );
    }
    return value;
  }
}

const ACCEPTS_MISSING: Record<TypeKind, boolean> = {
  [TypeKind.String]: false,
  [TypeKind.Number]: false,
  [TypeKind.Boolean]: false,
  [TypeKind.Choice]: false,
  [TypeKind.List]: false,
  [TypeKind.Record]: false,
  [TypeKind.Nullable]: true,
};

function settle(result: Result<Value, EvalFailure>): Value {
  if (result.ok) return result.value;
  throw new Failure(result.error);
}

function bind({
  params,
  names,
  values,
}: {
  params: Params;
  names: readonly string[];
  values: readonly Value[];
}): Params {
  const next = new Map(params);
  names.forEach((name, index) => next.set(name, values[index] ?? null));
  return next;
}

const NOT_INDEXABLE = "This value can't be read by position or key.";

function template(quasis: readonly string[], parts: readonly Value[]): Value {
  if (parts.some((part) => part !== null && !isPrimitive(part))) {
    throw evalError(SHOWS_PRIMITIVES_ONLY);
  }
  if (parts.includes(null)) return null;
  return parts.reduce<string>(
    (text, part, index) => `${text}${String(part)}${quasis[index + 1]}`,
    quasis[0],
  );
}

/** `named` is false for a key from a value, which errors leave out. */
function member({
  target,
  property,
  named,
}: {
  target: Value;
  property: string;
  named: boolean;
}): Value {
  if (target === null) return null;
  if (
    (typeof target === "string" || Array.isArray(target)) &&
    property === "length"
  ) {
    return target.length;
  }
  if (isRecordValue(target)) {
    if (!Object.hasOwn(target, property)) {
      throw evalError(
        named
          ? `There's no field \`${property}\` here.`
          : "There's no field with this key here.",
      );
    }
    return target[property];
  }
  throw evalError(
    named
      ? `\`${property}\` can't be read from this value.`
      : "This value has no field with this key.",
  );
}

function indexInto(target: Value, index: Value): Value {
  if (
    index !== null &&
    typeof index !== "number" &&
    typeof index !== "string"
  ) {
    throw evalError(NOT_INDEXABLE);
  }
  if (target === null) return null;
  if (index === null) {
    const indexable =
      typeof target === "string" ||
      Array.isArray(target) ||
      isRecordValue(target);
    if (indexable) return null;
    throw evalError(NOT_INDEXABLE);
  }
  if (typeof target === "string" || Array.isArray(target)) {
    // `tsc` reads `tags["0"]` as a position, as it does any key that is a
    // number's own text.
    const position =
      typeof index === "string" && String(Number(index)) === index
        ? Number(index)
        : index;
    if (typeof position === "number") {
      if (!Number.isInteger(position))
        throw evalError("A position must be a whole number.");
      return target[position] ?? null;
    }
  }
  if (typeof index === "string") {
    return member({ target, property: index, named: false });
  }
  if (isRecordValue(target) && typeof index === "number") {
    return member({ target, property: String(index), named: false });
  }
  throw evalError(NOT_INDEXABLE);
}
