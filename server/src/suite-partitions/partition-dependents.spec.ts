import { SaveProblemKind } from "@alliance/common/expression/named";
import { ExprKind, type Expr } from "@alliance/common/expression/tree";
import { ONLY_LISTS_AND_FORMULAS } from "./partition-check";
import { dependentId, outsideReadProblems } from "./partition-dependents";
import { EVERYONE_ELSE, type PartitionPart } from "./partition-parts";

// No input exists yet, so a named expression reading one stands in for the
// first input a catalog gains.
const answer: Expr = { kind: ExprKind.Input, id: "answer" };
const named = [{ id: "f-answered", name: "answered", tree: answer }];
const part = (id: string, condition: Expr | null): PartitionPart => ({
  id,
  name: id,
  condition,
  fallback: null,
  noRequiredWorkTick: null,
  cells: [],
});
const partitions = [
  {
    suiteName: "Suite",
    version: {
      id: 1,
      suiteId: 7,
      parts: [
        part("Answered", { kind: ExprKind.Ref, id: "f-answered" }),
        part("Anyone", { kind: ExprKind.Literal, value: true }),
        part(EVERYONE_ELSE, null),
      ],
      savedById: null,
      createdAt: new Date(),
    },
  },
];
const problem = (partId: string, text: string) => ({
  kind: SaveProblemKind.Dependent,
  id: dependentId(7, partId),
  text,
  diagnostics: [
    { message: ONLY_LISTS_AND_FORMULAS, start: 0, end: text.length },
  ],
});

describe("outsideReadProblems", () => {
  it("refuses a stored or fixed part reading an input through formulas", () => {
    expect(
      outsideReadProblems({
        partitions,
        named,
        fixed: [
          {
            id: dependentId(7, "Anyone"),
            tree: { kind: ExprKind.Ref, id: "f-answered" },
            mayBeUnknown: false,
          },
        ],
        print: () => "answered",
      }),
    ).toEqual([problem("Answered", "answered"), problem("Anyone", "answered")]);
  });

  it("passes parts reading only lists and formulas", () => {
    expect(
      outsideReadProblems({
        partitions,
        named: [
          {
            ...named[0],
            tree: { kind: ExprKind.Literal, value: true },
          },
        ],
        fixed: [],
        print: () => "",
      }),
    ).toEqual([]);
  });
});
