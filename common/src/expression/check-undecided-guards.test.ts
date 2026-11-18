import {
  GUARDED,
  NEEDLESS,
  UNDECIDED_STATE,
  condition,
  groupCondition,
  passes,
  problems,
  variable,
} from "./check-test-support";

describe("isUnknown guards", () => {
  test("a guarded starting value of reduce leaves a fallback in its function allowed", () => {
    expect(
      passes(
        "isUnknown(count) || [1].reduce((n, x) => isUnknown(n ?? 0) ? 1 / 0 : 1, count) > 0",
      ).mayBeUnknown,
    ).toBe(false);
  });

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
    [
      'isUnknown(marks.indexOf(3)) ? "none" : describe(marks.indexOf(3) + 1)',
      variable,
    ],
  ])("a ternary guard decides %s", (text, rule) => {
    expect(passes(text, rule).mayBeUnknown).toBe(false);
  });

  test.each([
    'state === "CA" || isUnknown(count)',
    'state === "CA" && isUnknown(state)',
  ])("a guard doesn't decide %s", (text) => {
    expect(problems(text)).toEqual([{ message: UNDECIDED_STATE, at: text }]);
  });

  test.each([
    '((state === "CA") ?? false) || isUnknown(state)',
    'isUnknown(state) || ((state === "CA") ?? false)',
    'isUnknown(state) ? false : ((state === "CA") ?? false)',
    "isUnknown(state) || ((state.length > 2) ?? false)",
    "isUnknown(usBased) || (({ yes: 1, no: 2 }[usBased] > 0) ?? false)",
    "isUnknown(count) || [isUnknown(count) || ((count > 1) ?? false)].length > 0",
    'isUnknown(state) ? false : (isUnknown(state) || isUnknown((state === "CA") ?? false))',
  ])("a fallback a guard makes needless says so: %s", (text) => {
    expect(problems(text)).toEqual([{ message: GUARDED, at: "false" }]);
  });

  test.each([
    'state === "CA" && (state ?? "x") === "CA"',
    'state !== "CA" || (state ?? "CA") !== "CA"',
    'state === "CA" && ((state === "CA") ?? false)',
    'items.some(it => (it["score"] === 1 && (it["score"] ?? 0) > 1) ?? false)',
    'state === "CA" && ((usBased === "yes") ?? (state === "CA") ?? false)',
    'state === "CA" && ((usBased === "yes") ?? (state.length > 1) ?? false)',
  ])(
    "a fallback after a read `&&` or `||` narrowed isn't needless: %s",
    (text) => {
      passes(text, groupCondition);
    },
  );

  test.each([
    "isUnknown(count) || [count].length > 0",
    "isUnknown(count) || [count].map((c) => c + 1).length > 0",
  ])(
    "a fallback after a left a guard decides through a list never runs: %s",
    (left) => {
      expect(passes(`(${left}) ?? (state === "CA")`).mayBeUnknown).toBe(false);
    },
  );

  test("a fallback after a read narrowed to nothing gets tsc's message alone", () => {
    expect(
      problems(
        "count === 1 && count === 2 && (count ?? 0) > 0",
        groupCondition,
      ),
    ).toEqual([
      {
        message:
          "This comparison appears to be unintentional because the types '1' and '2' have no overlap.",
        at: "count === 2",
      },
    ]);
  });

  test('a fallback after `["length"]` is needless as one after `.length`', () => {
    expect(problems('(marks["length"] > 0) ?? false')).toEqual([
      { message: NEEDLESS, at: "false" },
    ]);
  });

  test("a guard on a read that can't be missing leaves the plain needless message", () => {
    expect(problems("isUnknown(total) || ((total > 1) ?? false)")).toEqual([
      { message: NEEDLESS, at: "false" },
    ]);
  });

  test("a fallback a function or list receives isn't needless beside a guard", () => {
    passes("isUnknown(count) || 1 / (describe(count ?? 1).length - 6) > 0");
    passes("isUnknown(count) || sum([count ?? 1]) > 0");
    passes(
      'isUnknown(count) || [1].reduce((a, x) => describe(a) === "n=null" ? 1 / 0 : 1, count ?? 1) > 0',
    );
    passes(
      "isUnknown(count) || [count ?? 1].some(n => describe(n) === 'n=null')",
    );
  });

  test.each([
    "isUnknown(count) || [1, 2].reduce((a, x) => x === 1 ? (count ?? 0) : sum([a]), 0) > 0",
    "!isUnknown(count) && [1, 2].reduce((a, x) => x === 1 ? (count ?? 0) : sum([a]), 0) > 0",
    "isUnknown(count) || [1, 2].reduce((a, x) => sum([a]) + (count ?? 0), 0) > 0",
    "isUnknown(count) || [1].some((y) => [1, 2].reduce((a, x) => x === 1 ? (count ?? 0) : sum([a]), 0) > 0)",
  ])(
    "a fallback reduce's function gives back isn't needless beside a guard: %s",
    (text) => {
      passes(text);
    },
  );

  test.each([
    "isUnknown(marks.indexOf(3)) || highest([marks.indexOf(3)]) > 0",
    "isUnknown(marks.indexOf(3)) || { n: marks.indexOf(3) }.n > 0",
    "isUnknown(marks.indexOf(3)) || [1].map(x => marks.indexOf(3)).length > 0",
    'isUnknown(marks.indexOf(3)) || describe(marks.indexOf(3) + 1) === "a"',
  ])("a guard still decides a read a function or list receives: %s", (text) => {
    passes(text);
  });

  test("a narrowed read a function receives doesn't allow a fallback after the call", () => {
    expect(
      problems('(count === 1 && ((describe(count) === "n") ?? false)) ?? true'),
    ).toEqual([{ message: NEEDLESS, at: "false" }]);
  });

  test("a deep nest of guards and fallbacks blames the guard only beside the read", () => {
    let text = 'state === "CA"';
    for (let depth = 0; depth < 40; depth += 1) {
      text = `isUnknown(state) || ((${text}) ?? false)`;
    }
    expect(problems(text)).toEqual([
      { message: GUARDED, at: "false" },
      ...Array.from({ length: 39 }, () => ({ message: NEEDLESS, at: "false" })),
    ]);
  });

  test.each([
    [
      "isUnknown(count) || ((count === 1 ?? count === 2) ?? false)",
      "count === 2",
    ],
    [
      '!isUnknown(count) && ((count === 1 ?? state === "CA") ?? false)',
      'state === "CA"',
    ],
  ])(
    "an inner fallback the guard makes run hands it on in %s",
    (text, inner) => {
      expect(problems(text)).toEqual([
        { message: GUARDED, at: inner },
        { message: GUARDED, at: "false" },
      ]);
    },
  );

  test("a guard before a needless fallback still decides the chain around it", () => {
    expect(
      problems(
        '(((!isUnknown(state) && state === "CA") ?? true) && state === "CA") ?? true',
      ),
    ).toEqual([
      { message: GUARDED, at: "true" },
      { message: GUARDED, at: "true" },
    ]);
  });

  test("a guard beside `||` outside an isUnknown argument leaves a fallback inside needed", () => {
    passes("isUnknown(count) || (isUnknown(count ?? 1) ? 1 / 0 : 0) > 0");
  });

  test("a ternary test's guard outside an isUnknown argument makes a fallback inside needless", () => {
    expect(
      problems("isUnknown(count) ? false : isUnknown(count ?? 1)"),
    ).toEqual([{ message: GUARDED, at: "1" }]);
  });

  test("a ternary test's guard on a read stays unheld in a list inside its branch", () => {
    expect(
      problems(
        "!isUnknown(count) && (isUnknown(count) ? 0 : [count ?? 0].length) > 0",
      ),
    ).toEqual([{ message: GUARDED, at: "0" }]);
  });

  test("an inner function's parameter of the same name isn't fed", () => {
    expect(
      problems(
        "(count === 1 && [count].some(c => [1].some(c => (c ?? 2) > 0))) ?? true",
      ),
    ).toEqual([{ message: NEEDLESS, at: "2" }]);
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

  const found = "marks.find((m) => m === 1)";
  test.each([
    ["", "((total > 1 ? total : null) ?? count) === 1", ""],
    ["", "((false ? total : null) ?? count) === 1", ""],
    ["", `(${found} ?? count) === 1`, ""],
    [
      `isUnknown(${found}) && (`,
      `(${found} ?? count) === 1`,
      " ? true : false)",
    ],
  ])(
    "after a left that can be missing, %s%s%s reports the fallback's unknown",
    (before, comparison, after) => {
      expect(problems(`${before}${comparison}${after}`)).toContainEqual({
        message:
          "This is undecided when `count` has no value. Add `?? false` or `?? true` to decide it then.",
        at: comparison,
      });
    },
  );

  test("a guard that decides a nullable left keeps its fallback from the result", () => {
    passes(`isUnknown(${found}) || ((${found} ?? count) === 1 ? true : false)`);
  });

  test("a list item whose missing value a guard decides keeps its fallback", () => {
    passes(
      `isUnknown(${found}) || [(${found} ?? count) === 1].some((x) => x ?? false)`,
    );
  });

  test.each([
    '(true ? true : null) ?? [state === "CA"].length > 0',
    'isUnknown(count) || [count].some((m) => (m > 0) ?? ([state === "CA"].length > 0))',
  ])(
    "a list item in a fallback after a left proven known stays unreported in %s",
    (text) => {
      expect(passes(text).mayBeUnknown).toBe(false);
    },
  );

  test("a fallback that never runs reports no function's undecided argument", () => {
    passes('(true ? true : null) ?? describe(state === "CA" ? 1 : 2) === "a"');
  });

  test("a fallback after reduce's accumulator from a known start is needless", () => {
    const reduced = (start: string) =>
      `[1, 2].reduce((acc, m) => acc ?? (state === "CA" ? 1 : 2), ${start}) > 1`;
    expect(problems(reduced("0"))).toEqual([
      { message: NEEDLESS, at: '(state === "CA" ? 1 : 2)' },
    ]);
    expect(
      problems(
        '[1, 2].reduce((acc, m) => acc ?? (state === "CA"), true) ?? false',
      ),
    ).toEqual([
      { message: NEEDLESS, at: '(state === "CA")' },
      { message: NEEDLESS, at: "false" },
    ]);
    expect(
      problems(
        "marks[0] === 1 && [marks[0]].reduce((a, x) => (a ?? 0) + 1, 0) > 0",
      ),
    ).toContainEqual({ message: NEEDLESS, at: "0" });
  });

  test("a fallback after reduce's accumulator from a start that can be missing stays checked", () => {
    expect(
      problems(
        '[1, 2].reduce((acc, m) => acc ?? (state === "CA" ? 1 : 2), count) > 1',
      ),
    ).toContainEqual({ message: UNDECIDED_STATE, at: 'state === "CA"' });
  });

  test("a fallback after reduce's accumulator with no start stays allowed when the list can hold a missing item", () => {
    passes(
      "marks[0] === 1 && [marks[0], 2].reduce((a, x) => a ?? 0) > 0",
      variable,
    );
  });

  test.each([
    'state === "CA"',
    '`${state}` === "CA"',
    '(state === "CA") ? true : false',
  ])(
    "a fallback after reduce's accumulator from an undecided start counted quietly stays allowed: %s",
    (start) => {
      passes(`isUnknown([1].reduce((a, x) => a ?? false, ${start}))`);
    },
  );

  test("a fallback after reduce's accumulator a guarded read feeds stays allowed", () => {
    passes(
      "isUnknown(count) || [1, 2].reduce((acc, m) => m === 1 ? count : (acc ?? 0), 0) > 0",
    );
  });

  test.each([
    [
      '(state === "CA")',
      "(acc ?? (count === 1 ? true : false))",
      "count === 1",
    ],
    [
      '(state === "CA")',
      "(acc ?? [1].some((n) => count === n))",
      "count === n",
    ],
    [
      '(state === "CA" ? true : false)',
      "(acc ?? (count === 1 ? true : false))",
      "count === 1",
    ],
  ])(
    "a fallback after reduce's accumulator the function can leave missing, through %s, reports %s",
    (branch, fallback, at) => {
      const text = `[1, 2].reduce((acc, m) => m === 1 ? ${branch} : ${fallback}, true) ?? false`;
      expect(problems(text)).toContainEqual({
        message:
          "This is undecided when `count` has no value. Add `?? false` or `?? true` to decide it then.",
        at,
      });
    },
  );

  const afterReduceParam = (params: string, read: string) =>
    `[1, 2].reduce(${params} => ${read} === 1 ? (state === "CA") : ((${read} > 1) ?? (count === 1 ? true : false)), true) ?? false`;

  test.each([
    ["(acc, m)", "m"],
    ["(acc, m, i)", "i"],
  ])(
    "a fallback after reduce's parameter from a known list is needless: %s",
    (params, read) => {
      expect(problems(afterReduceParam(params, read))).toEqual([
        { message: NEEDLESS, at: "(count === 1 ? true : false)" },
      ]);
    },
  );

  test.each([
    "marks[0] === 1 && [marks[0]].some((m, i) => (i > 0) ?? false)",
    "marks[0] === 1 && [marks[0]].map((m, i) => (i > 0) ?? false).length > 0",
  ])("a fallback after an item function's index is needless: %s", (text) => {
    expect(problems(text)).toContainEqual({ message: NEEDLESS, at: "false" });
  });

  test.each([
    `isUnknown(${found}) || ((${found} ?? describe(state === "CA" ? 1 : 2).length) === 1 ? true : false)`,
    'isUnknown(count) || [count].some((m) => (m > 0) ?? (describe(state === "CA" ? 1 : 2) === "a"))',
    `isUnknown(${found}) || (((${found} ?? null) ?? describe(state === "CA" ? 1 : 2).length) === 1 ? true : false)`,
    'isUnknown(count) || sum([count ?? (state === "CA" ? 1 : 2)]) > 0',
    'isUnknown(count) || highest([count ?? (state === "CA" ? 1 : 2)]) > 0',
    'isUnknown(count) || describe(count ?? (state === "CA" ? 1 : 2)) === "a"',
  ])(
    "a fallback after a left proven known, as in %s, reports its function's undecided argument",
    (text) => {
      expect(problems(text)).toContainEqual({
        message: UNDECIDED_STATE,
        at: 'state === "CA"',
      });
    },
  );

  test("a fallback a held read's list carries on saves once decided", () => {
    passes(
      'isUnknown(count) || sum([count ?? ((state === "CA" ?? false) ? 1 : 2)]) > 0',
    );
  });
});
