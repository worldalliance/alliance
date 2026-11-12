import type { Expr } from "./tree";

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

/** An input engineers define in code. `id` is stable and is its name in text. */
export type InputDefinition = {
  id: string;
  label: string;
  type: ValueType;
};

/** An engineer-defined function's signature; hosts bind its implementation. */
export type FunctionDefinition = {
  name: string;
  params: readonly { name: string; type: ValueType }[];
  returns: ValueType;
};

export type Catalog = {
  inputs: readonly InputDefinition[];
  functions: readonly FunctionDefinition[];
};

export type NamedExpression = {
  id: string;
  name: string;
  tree: Expr;
};

/**
 * Function names, input ids and named-expression names read back as names,
 * which `true`, `class` or `my-name` don't, and differ from each other and
 * from `Math`, `isUnknown` and `undefined`; the parser throws if not.
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
};

export const IS_UNKNOWN = "isUnknown";

export const IS_UNKNOWN_HINT = "Use isUnknown(…) to test for a missing value.";
