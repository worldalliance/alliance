import { R } from "../result";
import {
  TypeKind,
  type Catalog,
  type NamedExpression,
  type ValueType,
} from "./catalog";
import { Undecided, checkExpression, type ResultRule } from "./check";
import { parseExpression } from "./parse";

export const NEEDLESS =
  "This fallback can't change the result: the value before `??` always has one. Remove the `?? …`.";
export const GUARDED =
  "This fallback isn't needed: an `isMissing(…)` check already decides the result when the value is missing. Remove the `?? …`.";
export const UNDECIDED_STATE =
  "This is undecided when `state` has no value. Add `?? false` or `?? true` to decide it then.";

export const string: ValueType = { kind: TypeKind.String };
const number: ValueType = { kind: TypeKind.Number };
const boolean: ValueType = { kind: TypeKind.Boolean };
const nullable = (inner: ValueType): ValueType => ({
  kind: TypeKind.Nullable,
  inner,
});

const maybe = nullable(boolean);
const numbers: ValueType = { kind: TypeKind.List, item: number };

export const catalog: Catalog = {
  inputs: [
    { id: "state", label: "State", type: nullable(string) },
    { id: "count", label: "Count", type: nullable(number) },
    { id: "total", label: "Total", type: number },
    {
      id: "usBased",
      label: "Based in the US",
      type: nullable({
        kind: TypeKind.Choice,
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      }),
    },
    {
      id: "marks",
      label: "Marks",
      type: { kind: TypeKind.List, item: nullable(number) },
    },
    {
      id: "items",
      label: "Items",
      type: {
        kind: TypeKind.List,
        item: {
          kind: TypeKind.Record,
          fields: { name: string, score: nullable(number) },
        },
      },
    },
  ],
  functions: [
    { name: "double", params: [{ name: "n", type: number }], returns: number },
    {
      name: "describe",
      params: [{ name: "n", type: nullable(number) }],
      returns: string,
    },
    {
      name: "highest",
      params: [
        {
          name: "marks",
          type: nullable({ kind: TypeKind.List, item: nullable(number) }),
        },
      ],
      returns: number,
    },
    {
      name: "flags",
      params: [{ name: "flags", type: { kind: TypeKind.List, item: maybe } }],
      returns: string,
    },
    {
      name: "agreed",
      params: [{ name: "flag", type: boolean }],
      returns: string,
    },
    {
      name: "maybeAgreed",
      params: [{ name: "flag", type: maybe }],
      returns: string,
    },
    {
      name: "flagged",
      params: [
        {
          name: "row",
          type: { kind: TypeKind.Record, fields: { flag: maybe } },
        },
      ],
      returns: string,
    },
    {
      name: "names",
      params: [
        {
          name: "names",
          type: nullable({ kind: TypeKind.List, item: nullable(string) }),
        },
      ],
      returns: string,
    },
    {
      name: "noted",
      params: [
        {
          name: "row",
          type: { kind: TypeKind.Record, fields: { note: nullable(string) } },
        },
      ],
      returns: string,
    },
    {
      name: "scored",
      params: [
        {
          name: "row",
          type: { kind: TypeKind.Record, fields: { n: number } },
        },
      ],
      returns: string,
    },
    {
      name: "maybeSum",
      params: [{ name: "numbers", type: nullable(numbers) }],
      returns: number,
    },
    {
      name: "rowSum",
      params: [
        {
          name: "row",
          type: {
            kind: TypeKind.Record,
            fields: { numbers: nullable(numbers) },
          },
        },
      ],
      returns: number,
    },
    {
      name: "sum",
      params: [{ name: "numbers", type: numbers }],
      returns: number,
    },
  ],
};

export const condition: ResultRule = {
  type: boolean,
  undecided: Undecided.NeedsFallback,
};
export const groupCondition: ResultRule = {
  type: boolean,
  undecided: Undecided.Allowed,
};
export const variable: ResultRule = { undecided: Undecided.Allowed };

export const named = ({
  id,
  name,
  text,
  others = [],
}: {
  id: string;
  name: string;
  text: string;
  others?: NamedExpression[];
}) => ({
  id,
  name,
  tree: R.unwrap(parseExpression(text, { catalog, named: others })),
});

type CheckOptions = ResultRule & { named?: NamedExpression[] };

function check(text: string, { named = [], ...rule }: CheckOptions) {
  return checkExpression({ source: text, scope: { catalog, named }, rule });
}

export function problems(text: string, options: CheckOptions = condition) {
  const checked = check(text, options);
  if (checked.ok) throw new Error(`expected ${text} to fail`);
  return checked.error.map(({ message, start, end, namedExpression }) => ({
    message,
    at:
      namedExpression === undefined
        ? text.slice(start, end)
        : `${namedExpression}@${start}`,
  }));
}

export const passes = (text: string, options: CheckOptions = condition) =>
  R.unwrap(check(text, options));
