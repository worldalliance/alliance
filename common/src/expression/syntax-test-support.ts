import { TypeKind, type Scope } from "./catalog";
import { ExprKind } from "./tree";

export const scope: Scope = {
  catalog: {
    inputs: [
      { id: "state", label: "State", type: { kind: TypeKind.String } },
      { id: "count", label: "Count", type: { kind: TypeKind.Number } },
      {
        id: "items",
        label: "Items",
        type: {
          kind: TypeKind.List,
          item: {
            kind: TypeKind.Record,
            fields: {
              name: { kind: TypeKind.String },
              café: { kind: TypeKind.String },
            },
          },
        },
      },
    ],
    functions: [
      { name: "lookup", params: [], returns: { kind: TypeKind.String } },
    ],
    lists: [{ id: "l1", name: "California targets" }],
  },
  named: [
    {
      id: "n1",
      name: "isCalifornia",
      tree: { kind: ExprKind.Literal, value: true },
    },
  ],
};
