import { describe, expect, test } from "bun:test";
import { R } from "../result";
import { catalog, condition, named } from "./check-test-support";
import { SaveProblemKind, checkNamedSave, type Dependent } from "./named";
import { parseExpression } from "./parse";

describe("a fallback the save makes needless", () => {
  const maybe = named({ id: "m", name: "maybe", text: "count" });
  const safe = named({
    id: "s",
    name: "safe",
    text: "maybe ?? 0",
    others: [maybe],
  });
  const tree = (text: string) =>
    R.unwrap(parseExpression(text, { catalog, named: [maybe, safe] }));
  const check = (source: string, dependents: Dependent[]) =>
    checkNamedSave({
      catalog,
      named: [maybe, safe],
      save: [{ id: "m", name: "maybe", source }],
      dependents,
    });
  const blocked = (source: string, dependents: Dependent[]) => {
    const result = check(source, dependents);
    if (result.ok) throw new Error("expected the save to be blocked");
    return result.error;
  };
  test.each([
    ["it can't change the result", "(maybe ?? 0) > 1"],
    [
      "an `isMissing` guard decides it",
      "isMissing(count) ? false : ((count === maybe) ?? false)",
    ],
  ])("doesn't block stored expressions when %s", (_, text) => {
    const stored: Dependent = { id: "g", stored: tree(text), rule: condition };
    expect(check("count", [stored]).ok).toBe(true);
    expect(check("total", [stored]).ok).toBe(true);
  });

  test("doesn't hide a stored reader's other problem", () => {
    const reader: Dependent = {
      id: "r",
      stored: tree("safe > 1"),
      rule: condition,
    };
    expect(blocked('"x"', [reader])).toContainEqual(
      expect.objectContaining({ kind: SaveProblemKind.Dependent, id: "r" }),
    );
  });

  test("is listed in a fixed dependent", () => {
    const fixed: Dependent = {
      id: "g",
      fixed: "(maybe ?? 0) > 1",
      rule: condition,
    };
    expect(blocked("total", [fixed])).toEqual([
      expect.objectContaining({
        id: "g",
        diagnostics: [
          expect.objectContaining({
            message: expect.stringMatching(
              /^This fallback can't change the result/,
            ),
          }),
        ],
      }),
    ]);
  });
});
