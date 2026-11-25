import { expect, test } from "bun:test";
import { Undecided } from "./check";
import { partCondition, passes, problems } from "./check-test-support";

test("a part without a fallback picked can't stay undecided", () => {
  const rule = { ...partCondition, undecided: Undecided.NeedsPartFallback };
  expect(problems('state === "CA"', rule)).toEqual([
    {
      message:
        'This is undecided for members when `state` has no value. Pick what happens to those members: "Put them here" or "Continue to the next part".',
      at: 'state === "CA"',
    },
  ]);
  expect(problems("items.map(item => item.score).includes(3)", rule)).toEqual([
    {
      message:
        'This is undecided for members when an item of `items.map(item => item.score)` has no value. Pick what happens to those members: "Put them here" or "Continue to the next part".',
      at: "items.map(item => item.score).includes(3)",
    },
  ]);
  expect(problems("null", rule)).toEqual([
    {
      message:
        'This can be undecided for some members. Pick what happens to those members: "Put them here" or "Continue to the next part".',
      at: "null",
    },
  ]);
  expect(passes("total > 1", rule).mayBeUnknown).toBe(false);
});
