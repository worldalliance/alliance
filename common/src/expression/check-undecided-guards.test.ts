import {
  UNDECIDED_STATE,
  condition,
  groupCondition,
  passes,
  problems,
  variable,
} from "./check-test-support";

describe("isUnknown guards", () => {
  test("an isUnknown guard decides the read it guards", () => {
    expect(passes('!isUnknown(state) && state === "CA"').mayBeUnknown).toBe(
      false,
    );
    expect(passes("!isUnknown(count) && count > 5").mayBeUnknown).toBe(false);
    expect(
      passes("isUnknown(count) ? null : count > 5", groupCondition)
        .mayBeUnknown,
    ).toBe(true);
    expect(
      passes("(isUnknown(count) ? null : count > 5) ?? false").mayBeUnknown,
    ).toBe(false);
  });

  test.each([
    "!isUnknown(marks.indexOf(1)) && !isUnknown(count) && marks.indexOf(1) > count",
    "!isUnknown(count) && !isUnknown(marks.indexOf(1)) && marks.indexOf(1) > count",
    "isUnknown(marks.indexOf(1)) || isUnknown(count) || marks.indexOf(1) > count",
    "!isUnknown(marks.indexOf(1)) && !isUnknown(count) ? marks.indexOf(1) > count : false",
    '((!isUnknown(state) && count === 1) ?? true) && state === "CA"',
  ])("a guard earlier in a chain decides %s", (text) => {
    expect(passes(text).mayBeUnknown).toBe(false);
  });

  test.each([
    'state === "CA" || isUnknown(state)',
    'state !== "CA" && !isUnknown(state)',
    '(state === "CA" || isUnknown(state)) && total > 1',
    "items[0]?.score === 1 || isUnknown(items[0]?.score)",
    'items.find(item => item.name === "a")?.score === 1 || isUnknown(items.find(item => item.name === "a")?.score)',
    "marks.indexOf(3) === 1 || isUnknown(marks.indexOf(3))",
    "marks.includes(3) || isUnknown(marks.includes(3))",
    'state === "CA" || isUnknown((state))',
    "marks.indexOf(count) === 1 || isUnknown(marks.indexOf(count))",
    "(count === 1) === true || isUnknown(count === 1)",
    "(count ?? marks.indexOf(3)) === 1 || isUnknown(count ?? marks.indexOf(3))",
    "marks.indexOf( 3 ) === 1 || isUnknown(marks.indexOf(3))",
    `items.find(item => item.name === 'a')?.score === 1 || isUnknown(items.find(item => item.name === "a")?.score)`,
  ])("a guard on the other side decides %s", (text) => {
    expect(passes(text, groupCondition).mayBeUnknown).toBe(false);
  });

  test.each([
    ["isUnknown(marks.indexOf(3) + 1)", condition],
    ["isUnknown(`${marks.indexOf(3)}`)", condition],
    ["isUnknown(double(marks.indexOf(3)))", condition],
    ['!isUnknown(state === "CA" ? 1 : 2)', condition],
    [
      "(marks.indexOf(3) + 1) === 1 || isUnknown(marks.indexOf(3) + 1)",
      condition,
    ],
    ["isUnknown(marks.indexOf(3) + 1) ? 0 : marks.indexOf(3) + 1", variable],
  ])(
    "a guard decides an unknown anywhere inside its read in %s",
    (text, rule) => {
      expect(passes(text, rule).mayBeUnknown).toBe(false);
    },
  );

  test.each([
    [
      "isUnknown(marks.map(m => m === count)) ? [] : marks.map(m => m === count)",
      "m === count",
    ],
    ['isUnknown([state === "CA"]) ? [] : [state === "CA"]', 'state === "CA"'],
    [
      'isUnknown({ ca: state === "CA" }) ? 0 : { ca: state === "CA" }',
      'state === "CA"',
    ],
  ])("a guard doesn't decide an item its read holds in %s", (text, item) => {
    expect(problems(text, variable).map(({ at }) => at)).toEqual([item]);
  });

  test.each([
    ["isUnknown(marks.includes(3)) ? false : marks.includes(3)", condition],
    ["!isUnknown(marks.includes(3)) ? marks.includes(3) : true", condition],
    ["isUnknown(marks.indexOf(3)) ? -1 : marks.indexOf(3)", variable],
  ])("a ternary guard decides %s", (text, rule) => {
    expect(passes(text, rule).mayBeUnknown).toBe(false);
  });

  test.each([
    'state === "CA" || isUnknown(count)',
    'state === "CA" && isUnknown(state)',
  ])("a guard doesn't decide %s", (text) => {
    expect(problems(text)).toEqual([{ message: UNDECIDED_STATE, at: text }]);
  });

  test("a guard on an input doesn't decide a lambda parameter of the same name", () => {
    const text = "marks.some(count => count === 1) || isUnknown(count)";
    expect(problems(text)).toEqual([
      {
        message:
          "This is undecided when `count` has no value. Add `?? false` or `?? true` to decide it then.",
        at: "count === 1",
      },
    ]);
  });

  test("a guard on a parameter doesn't decide a nested lambda's parameter of the same name", () => {
    const text =
      "items.every(i => isUnknown(i.score) || items.some(i => i.score === 2))";
    expect(problems(text)).toEqual([
      {
        message:
          "This is undecided when `i.score` has no value. Add `?? false` or `?? true` to decide it then.",
        at: "i.score === 2",
      },
    ]);
  });

  test("a guard on a parameter still decides it inside a nested lambda with other parameters", () => {
    passes(
      "items.every(i => isUnknown(i.score) || items.some(j => i.score === 2))",
    );
  });

  test.each([
    [
      'isUnknown([1].concat(state === "CA" ? 1 : 2)) ? false : [1].concat(state === "CA" ? 1 : 2).some(n => n > 1)',
      condition,
      'state === "CA"',
    ],
    [
      "!isUnknown([1].concat(marks.indexOf(3))) && sum([1].concat(marks.indexOf(3))) > 1",
      condition,
      "marks.indexOf(3)",
    ],
    [
      "isUnknown([1].concat(marks.indexOf(3))) ? [] : [1].concat(marks.indexOf(3))",
      variable,
      "marks.indexOf(3)",
    ],
  ])(
    "a guard doesn't decide an unknown a list's concat keeps as an item in %s",
    (text, rule, at) => {
      expect(problems(text, rule).map((problem) => problem.at)).toEqual([at]);
    },
  );

  test("an isUnknown on the right of ?? that may not run decides nothing after it", () => {
    const text = '((state === "CA") ?? isUnknown(count)) ? true : count === 1';
    expect(problems(text)).toEqual([
      {
        message:
          "This is undecided when `count` has no value. Add `?? false` or `?? true` to decide it then.",
        at: text,
      },
    ]);
    expect(
      passes("`${count ?? (isUnknown(total) ? 0 : 1)} ${total}`", variable)
        .mayBeUnknown,
    ).toBe(false);
    passes("(count ?? isUnknown(sum([1, 2]))) === 1 || sum([1, 2]) > 1");
  });

  test("such an isUnknown decides nothing about a read through a target that can be missing", () => {
    const text =
      '((state === "CA") ?? isUnknown(items[0]?.name)) ? true : items[0]?.name === "a"';
    expect(problems(text)).toEqual([
      {
        message:
          "This is undecided when `items[0]?.name` has no value. Add `?? false` or `?? true` to decide it then.",
        at: text,
      },
    ]);
  });

  test("such an isUnknown leaves a read through a target a guard covers known", () => {
    passes(
      "isUnknown(state) || ((count ?? isUnknown(state.length)) === true && state.length > 2)",
    );
  });
});
