import { R, type Result } from "../result";
import {
  TypeKind,
  type Catalog,
  type NamedExpression,
  type Value,
} from "./catalog";
import { evaluate } from "./evaluate";
import { FailureKind, type EvalFailure } from "./failure";
import { parseExpression } from "./parse";

const string = { kind: TypeKind.String } as const;
const number = { kind: TypeKind.Number } as const;
const nullable = <T extends object>(inner: T) =>
  ({ kind: TypeKind.Nullable, inner }) as const;

export const catalog: Catalog = {
  inputs: [
    { id: "state", label: "State", type: nullable(string) },
    { id: "count", label: "Count", type: nullable(number) },
    { id: "zero", label: "Zero", type: number },
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
    {
      id: "tags",
      label: "Tags",
      type: nullable({ kind: TypeKind.List, item: string }),
    },
    {
      id: "names",
      label: "Names",
      type: { kind: TypeKind.List, item: nullable(string) },
    },
    { id: "waiting", label: "Waiting", type: string },
    { id: "waitingToo", label: "Waiting too", type: string },
    { id: "broken", label: "Broken", type: string },
    { id: "mistyped", label: "Mistyped", type: number },
    {
      id: "choice",
      label: "Choice",
      type: { kind: TypeKind.Choice, options: [{ value: "a", label: "A" }] },
    },
  ],
  functions: [
    { name: "double", params: [{ name: "n", type: number }], returns: number },
    {
      name: "describe",
      params: [{ name: "n", type: nullable(number) }],
      returns: string,
    },
    { name: "half", params: [{ name: "n", type: number }], returns: number },
    { name: "boom", params: [], returns: number },
    { name: "later", params: [], returns: number },
    {
      name: "add",
      params: [
        { name: "a", type: number },
        { name: "b", type: number },
      ],
      returns: number,
    },
    {
      name: "namesOf",
      params: [
        {
          name: "people",
          type: {
            kind: TypeKind.List,
            item: { kind: TypeKind.Record, fields: { name: string } },
          },
        },
      ],
      returns: string,
    },
    {
      name: "nameOf",
      params: [
        {
          name: "person",
          type: nullable({ kind: TypeKind.Record, fields: { name: string } }),
        },
      ],
      returns: string,
    },
  ],
  lists: [
    { id: "list-on", name: "Volunteers" },
    { id: "list-off", name: "Waitlisted" },
    { id: "list-broken", name: "Unreadable" },
  ],
};

const values: Record<string, Value> = {
  state: null,
  count: 7,
  zero: 0,
  items: [
    { name: "a", score: 3 },
    { name: "b", score: null },
  ],
  tags: ["x", "y"],
  mistyped: "seven",
};

const pending = (key: string): Result<Value, EvalFailure> =>
  R.failure({ kind: FailureKind.Pending, waitingOn: [key] });

export function run(
  text: string,
  {
    overrides = {},
    named = [],
  }: { overrides?: Record<string, Value>; named?: NamedExpression[] } = {},
): Result<Value, EvalFailure> {
  const tree = R.unwrap(parseExpression(text, { catalog, named }));
  return evaluate(tree, {
    catalog,
    named,
    readInput: (id) => {
      if (id === "waiting") return pending("action:1");
      if (id === "waitingToo") return pending("action:2");
      if (id === "broken")
        return R.failure({ kind: FailureKind.Error, message: "read failed" });
      return R.success(id in overrides ? overrides[id] : values[id]);
    },
    callFunction: (name, args) => {
      if (name === "boom") throw new RangeError("host bug");
      if (name === "later") return pending("action:3");
      if (name === "namesOf" || name === "nameOf")
        return R.success(JSON.stringify(args[0]));
      return R.success(
        name === "double" ? Number(args[0]) * 2 : `n=${String(args[0])}`,
      );
    },
    isOnList: (listId) =>
      listId === "list-broken"
        ? R.failure({ kind: FailureKind.Error, message: "read failed" })
        : R.success(listId === "list-on"),
  });
}

export const valueOf = (text: string, overrides?: Record<string, Value>) =>
  R.unwrap(run(text, { overrides }));

export const failureOf = (text: string) => {
  const result = run(text);
  if (result.ok) throw new Error(`expected ${text} to fail`);
  return result.error;
};
