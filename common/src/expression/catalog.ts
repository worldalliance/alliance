import type { Expr } from "./tree";

export type Value =
  | null
  | boolean
  | number
  | string
  | readonly Value[]
  | { readonly [key: string]: Value };

export enum TypeKind {
  String = "string",
  Number = "number",
  Boolean = "boolean",
  Choice = "choice",
  List = "list",
  Record = "record",
  Nullable = "nullable",
}

export type ValueType =
  | { kind: TypeKind.String }
  | { kind: TypeKind.Number }
  | { kind: TypeKind.Boolean }
  | {
      kind: TypeKind.Choice;
      options: readonly { value: string; label: string }[];
    }
  | { kind: TypeKind.List; item: ValueType }
  | { kind: TypeKind.Record; fields: Readonly<Record<string, ValueType>> }
  | { kind: TypeKind.Nullable; inner: ValueType };

/**
 * An input engineers define in code. `id` is stable and is its name in text;
 * it doesn't start with `__`, which the save check keeps for its own names.
 */
export type InputDefinition = {
  id: string;
  label: string;
  type: ValueType;
};

/**
 * An engineer-defined function's signature; hosts bind its implementation.
 * Its name doesn't start with `__`, as an input id doesn't. It gives the same
 * result for the same arguments within one evaluation, since the save check
 * lets a guard on a call cover the same call repeated.
 */
export type FunctionDefinition = {
  name: string;
  params: readonly { name: string; type: ValueType }[];
  returns: ValueType;
};

/** A member list admins keep, read as `isOnList("<name>")`. */
export type MemberListName = { id: string; name: string };

/**
 * What expressions can read: the inputs and functions engineers define, and
 * the member lists that exist when the check or evaluation runs.
 */
export type Catalog = {
  inputs: readonly InputDefinition[];
  functions: readonly FunctionDefinition[];
  lists: readonly MemberListName[];
};

export type NamedExpression = {
  id: string;
  /**
   * The save check declares it as a variable, so callers keep it an
   * identifier that isn't a reserved word, `Math`, `undefined`, `eval`,
   * `arguments` or `globalThis`, doesn't start with `__`, and no input,
   * function, `isMissing` or other named expression uses.
   */
  name: string;
  tree: Expr;
};

/**
 * Function names, input ids and named-expression names read back as names,
 * which `true`, `class` or `my-name` don't, aren't `eval`, `arguments` or
 * `globalThis`, and differ from each other and from `Math`, `isMissing` and
 * `undefined`; the parser throws if not.
 */
export type Scope = {
  catalog: Catalog;
  named: readonly NamedExpression[];
};

/** A problem located in the text of the expression it is about. */
export type Diagnostic = {
  message: string;
  start: number;
  end: number;
  /** Set when the problem is inside this named expression's printed text. */
  namedExpression?: string;
};

export const IS_MISSING = "isMissing";

export const IS_ON_LIST = "isOnList";

export const IS_MISSING_HINT = "Use isMissing(…) to test for a missing value.";

/** Describes where `value` departs from `type`, or `undefined` if it fits. */
export function mismatch(value: Value, type: ValueType): string | undefined {
  switch (type.kind) {
    case TypeKind.String:
    case TypeKind.Number:
    case TypeKind.Boolean:
      return typeof value === type.kind &&
        (typeof value !== "number" || Number.isFinite(value))
        ? undefined
        : `expected ${type.kind}, got ${describe(value)}`;
    case TypeKind.Choice:
      return type.options.some((option) => option.value === value)
        ? undefined
        : `expected one of ${type.options.map((option) => JSON.stringify(option.value)).join(", ")}, got ${describe(value)}`;
    case TypeKind.List:
      if (!Array.isArray(value))
        return `expected a list, got ${describe(value)}`;
      for (const [index, item] of value.entries()) {
        const inner = mismatch(item, type.item);
        if (inner !== undefined) return `[${index}]: ${inner}`;
      }
      return undefined;
    case TypeKind.Record: {
      if (!isRecordValue(value)) {
        return `expected a record, got ${describe(value)}`;
      }
      for (const [key, field] of Object.entries(type.fields)) {
        if (!Object.hasOwn(value, key)) return `.${key}: missing`;
        const inner = mismatch(value[key], field);
        if (inner !== undefined) return `.${key}: ${inner}`;
      }
      // An undeclared key is member data, so it stays out of the message.
      return Object.keys(value).every((key) => Object.hasOwn(type.fields, key))
        ? undefined
        : "has a field its type doesn't declare";
    }
    case TypeKind.Nullable:
      return value === null ? undefined : mismatch(value, type.inner);
    default:
      throw new Error(`unknown type kind: ${type satisfies never}`);
  }
}

/**
 * `value` without the record fields `type` doesn't declare, at every depth, so
 * a host function receives the shape it declares, as TypeScript lets a wider
 * record pass for a narrower one.
 */
export function project(value: Value, type: ValueType): Value {
  switch (type.kind) {
    case TypeKind.String:
    case TypeKind.Number:
    case TypeKind.Boolean:
    case TypeKind.Choice:
      return value;
    case TypeKind.List:
      return Array.isArray(value)
        ? value.map((item) => project(item, type.item))
        : value;
    case TypeKind.Record:
      return isRecordValue(value)
        ? Object.fromEntries(
            Object.entries(type.fields)
              .filter(([key]) => Object.hasOwn(value, key))
              .map(([key, field]) => [key, project(value[key], field)]),
          )
        : value;
    case TypeKind.Nullable:
      return value === null ? null : project(value, type.inner);
    default:
      throw new Error(`unknown type kind: ${type satisfies never}`);
  }
}

export function isRecordValue(
  value: Value,
): value is { readonly [key: string]: Value } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Names the value's kind, not the value: inputs hold member data.
function describe(value: Value): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "a list";
  switch (typeof value) {
    case "number":
      return Number.isFinite(value) ? "a number" : String(value);
    case "string":
      return "text";
    case "boolean":
      return "a yes/no value";
    case "undefined":
      return "undefined";
    default:
      return "a record";
  }
}
