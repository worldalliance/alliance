import { R } from "../result";
import {
  TypeKind,
  type Catalog,
  type NamedExpression,
  type ValueType,
} from "./catalog";
import { checkExpression, type ResultRule } from "./check";
import { parseExpression } from "./parse";

export const string: ValueType = { kind: TypeKind.String };
const number: ValueType = { kind: TypeKind.Number };
const boolean: ValueType = { kind: TypeKind.Boolean };
const nullable = (inner: ValueType): ValueType => ({
  kind: TypeKind.Nullable,
  inner,
});

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
  ],
};

export const condition: ResultRule = { type: boolean };
export const variable: ResultRule = {};

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
