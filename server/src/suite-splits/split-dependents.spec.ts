import { SaveProblemKind } from "@alliance/common/expression/named";
import { ExprKind, type Expr } from "@alliance/common/expression/tree";
import { ONLY_LISTS_AND_FORMULAS } from "./split-check";
import { dependentId, outsideReadProblems } from "./split-dependents";
import { EVERYONE_ELSE, type SplitGroup } from "./split-groups";

// No input exists yet, so a named expression reading one stands in for the
// first input a catalog gains.
const answer: Expr = { kind: ExprKind.Input, id: "answer" };
const named = [{ id: "f-answered", name: "answered", tree: answer }];
const group = (id: string, condition: Expr | null): SplitGroup => ({
  id,
  name: id,
  condition,
  fallback: null,
  noRequiredWorkTick: null,
  cells: [],
});
const splits = [
  {
    suiteName: "Suite",
    version: {
      id: 1,
      suiteId: 7,
      groups: [
        group("Answered", { kind: ExprKind.Ref, id: "f-answered" }),
        group("Anyone", { kind: ExprKind.Literal, value: true }),
        group(EVERYONE_ELSE, null),
      ],
      savedById: null,
      createdAt: new Date(),
    },
  },
];
const problem = (groupId: string, text: string) => ({
  kind: SaveProblemKind.Dependent,
  id: dependentId(7, groupId),
  text,
  diagnostics: [
    { message: ONLY_LISTS_AND_FORMULAS, start: 0, end: text.length },
  ],
});

describe("outsideReadProblems", () => {
  it("refuses a stored or fixed group reading an input through formulas", () => {
    expect(
      outsideReadProblems({
        splits,
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

  it("passes groups reading only lists and formulas", () => {
    expect(
      outsideReadProblems({
        splits,
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
