import { condition, named, passes, problems } from "./check-test-support";

describe("a check beside && or ||", () => {
  const unstoppedAt = (read: string) =>
    `This function can't take a missing value here, and gets one when \`${read}\` has none: \`&&\` and \`||\` run both sides, so a check beside one doesn't stop it. Add \`?? …\` to \`${read}\`, or check it with a ternary, which runs only the branch it takes, as in \`isMissing(${read}) ? … : …\`.`;
  const unstopped = unstoppedAt("count");

  test.each([
    ["isMissing(count) || sum([count]) > 0", "[count]"],
    [
      "isMissing(count) || maybeSum([count].map((m) => m)) > 0",
      "[count].map((m) => m)",
    ],
    ["(count === 1 && sum([count]) > 0) ?? false", "[count]"],
    ["!isMissing(count) && sum([count]) > 0", "[count]"],
    ["isMissing(count) || sum([count ?? count]) > 0", "[count ?? count]"],
    [
      "isMissing(count) || sum(([1].length > 0 ? [count] : null) ?? []) > 0",
      "([1].length > 0 ? [count] : null) ?? []",
    ],
    [
      "isMissing(count) || sum([[count].reduce((a, x) => a + x, 0)]) > 0",
      "[[count].reduce((a, x) => a + x, 0)]",
    ],
    [
      "isMissing(count) || sum([count].map((m) => m)) > 0",
      "[count].map((m) => m)",
    ],
    ["isMissing(count) || [count].map((m) => sum([m])).length > 0", "[m]"],
    ["isMissing(count) || [count].some((m) => sum([m]) > 0)", "[m]"],
    ["isMissing(count) || [1].reduce((a, x) => sum([a]), count) > 0", "[a]"],
    ["isMissing(count) || [count, 1].reduce((a, x) => sum([a])) > 0", "[a]"],
    [
      "isMissing(count) || [1, 2].reduce((a, x) => x === 1 ? count : sum([a]), 0) > 0",
      "[a]",
    ],
    [
      "isMissing(count) || [1, 2].reduce((a, x) => count === 1 ? a : sum([a]), 0) > 0",
      "[a]",
    ],
    [
      "!isMissing(count) && [1, 2].reduce((a, x) => x === 1 ? count : sum([a]), 0) > 0",
      "[a]",
    ],
    [
      "isMissing(count) || [1, 2].reduce((a, x) => sum([a]) + count, 0) > 0",
      "[a]",
    ],
    [
      "isMissing(count) || [1].some((y) => [1, 2].reduce((a, x) => x === 1 ? count : sum([a]), 0) > 0)",
      "[a]",
    ],
    ["isMissing(count) || [[count]].map((l) => sum(l)).length > 0", "l"],
    [
      "isMissing(count) || sum([count].sort((a, b) => a - b)) > 0",
      "[count].sort((a, b) => a - b)",
    ],
    [
      'isMissing(count) || sum([[count].join() === "" ? 1 : 2]) > 0',
      '[[count].join() === "" ? 1 : 2]',
    ],
    ["isMissing(count) || [[count]].some((l) => sum(l) > 0)", "l"],
    ["isMissing(count) || [count].some((m, i, l) => sum(l) > 0)", "l"],
    ["(count === 1 && [[count]].some((l) => sum(l) > 0)) ?? false", "l"],
    [
      "isMissing(count) || [count].map((m) => [m]).some((l) => sum(l) > 0)",
      "l",
    ],
    ['isMissing(count) || [{ n: count }].some((r) => scored(r) === "a")', "r"],
    [
      "isMissing(count) || [1].reduce((a, x) => a.concat([sum(a)]), [count]).length > 0",
      "a",
    ],
    ['isMissing(count) || scored({ n: count }) === "a"', "{ n: count }"],
    [
      "isMissing(count) || [[count]].some((l) => isMissing(l) ? false : sum(l) > 0)",
      "l",
    ],
    [
      "isMissing(count) || [[count]].some((l) => !isMissing(l) && sum(l) > 0)",
      "l",
    ],
    [
      "isMissing(count) || [[count]].some((l) => isMissing(l) || sum(l) > 0)",
      "l",
    ],
    [
      "isMissing(count) || sum(isMissing([count]) ? [] : [count]) > 0",
      "isMissing([count]) ? [] : [count]",
    ],
    [
      'isMissing(count) || [{ n: count }].some((r) => isMissing(r) ? false : scored(r) === "s")',
      "r",
    ],
    [
      "isMissing(count) || [count].some((m, i, l) => isMissing(l) ? false : sum(l) > 0)",
      "l",
    ],
    [
      "isMissing(count) || [[count]].map((l) => isMissing(l) ? [] : l).some((l) => sum(l) > 0)",
      "l",
    ],
    ["isMissing(count) || maybeSum([count]) > 0", "[count]"],
    [
      "isMissing(count) || maybeSum(total > 0 ? [count] : null) > 0",
      "total > 0 ? [count] : null",
    ],
    [
      "isMissing(count) || rowSum({ numbers: [count] }) > 0",
      "{ numbers: [count] }",
    ],
    ["isMissing(count) || sum([double(count)]) > 0", "[double(count)]"],
    [
      "isMissing(count) || sum([total > 0 && count > 0 ? 1 : 2]) > 0",
      "[total > 0 && count > 0 ? 1 : 2]",
    ],
    [
      "isMissing(count) || sum([count > 5 && count > 0 ? 1 : 2]) > 0",
      "[count > 5 && count > 0 ? 1 : 2]",
    ],
    [
      "(count === 1 && sum([count > 0 && total > 0 ? 1 : 2]) > 0) ?? false",
      "[count > 0 && total > 0 ? 1 : 2]",
    ],
    [
      "(count === 1 && sum([(count ?? 1) > 0 && count > 0 ? 1 : 2]) > 0) ?? false",
      "[(count ?? 1) > 0 && count > 0 ? 1 : 2]",
    ],
    [
      "(count === 1 && sum([(isMissing(count) || total > 0) && count > 0 ? 1 : 2]) > 0) ?? false",
      "[(isMissing(count) || total > 0) && count > 0 ? 1 : 2]",
    ],
    [
      "(count !== 1 || sum([(count ?? 1) > 0 && count > 0 ? 1 : 2]) > 0) ?? false",
      "[(count ?? 1) > 0 && count > 0 ? 1 : 2]",
    ],
    ["isMissing(count) || ([count] ?? []).some((v) => sum([v]) > 0)", "[v]"],
    [
      "isMissing(count) || ((total > 0 ? [count] : null) ?? []).some((v) => sum([v]) > 0)",
      "[v]",
    ],
    [
      "isMissing(count) || sum(([count] ?? []).map((v) => v)) > 0",
      "([count] ?? []).map((v) => v)",
    ],
    [
      "(count === 1 && ([count] ?? []).some((v) => sum([v]) > 0)) ?? false",
      "[v]",
    ],
    ["isMissing(count) || [([count] ?? [])].some((k) => sum(k) > 0)", "k"],
    [
      "isMissing(count) || sum(([count] ?? []).filter((v) => v > 0)) > 0",
      "([count] ?? []).filter((v) => v > 0)",
    ],
    [
      "isMissing(count) || (([count] ?? []).find((v) => sum([v]) > 0) ?? 0) > 0",
      "[v]",
    ],
    [
      "isMissing(count) || ([count] ?? []).reduce((a, v) => a + sum([v]), 0) > 0",
      "[v]",
    ],
    [
      "isMissing(count) || (([count] ?? null) ?? []).some((v) => sum([v]) > 0)",
      "[v]",
    ],
    [
      "isMissing(count) || [1, 2].reduce((a, x) => sum(a) > 0 ? ([count] ?? []) : a, [1]).length > 0",
      "a",
    ],
    [
      "isMissing(count) || [{ n: count }].some((r) => sum([r.n === 1 ? 1 : 2]) > 0)",
      "[r.n === 1 ? 1 : 2]",
    ],
    ["isMissing(count) || [{ n: [count] }].some((r) => sum(r.n) > 0)", "r.n"],
    ["isMissing(count) || sum([{ n: count }.n]) > 0", "[{ n: count }.n]"],
  ])(
    "a check beside && or || doesn't stop a missing value a function rejects: %s",
    (text, at) => {
      expect(problems(text)).toEqual([{ message: unstopped, at }]);
    },
  );

  test.each([
    ["items.some((i) => isMissing(i.score) || sum([i.score]) > 0)", "i.score"],
    ["isMissing(marks[0]) || sum([marks[0]]) > 0", "marks[0]"],
    [
      'items.some((i) => isMissing(i["score"]) || sum([i.score]) > 0)',
      "i.score",
    ],
    [
      'items.some((i) => isMissing(i.score) || sum([i["score"]]) > 0)',
      'i["score"]',
    ],
  ])("a field or item read is reported too: %s", (text, read) => {
    expect(problems(text)).toEqual([
      { message: unstoppedAt(read), at: `[${read}]` },
    ]);
  });

  test("a named expression is reported where it is read, or inside it when it holds the defect", () => {
    const c = named({ id: "n1", name: "c", text: "count" });
    expect(
      problems("isMissing(c) || sum([c]) > 0", { ...condition, named: [c] }),
    ).toEqual([{ message: unstoppedAt("c"), at: "[c]" }]);
    const text = "isMissing(count) || sum([count]) > 0";
    const s = named({ id: "n2", name: "s", text });
    expect(problems("s", { ...condition, named: [s] })).toEqual([
      { message: unstopped, at: `s@${text.indexOf("[count]")}` },
    ]);
  });

  test("a read narrowed beside && or || inside a list is reported beside the other side's report, and either fallback saves", () => {
    const inner = "count === 1 && count > 0";
    expect(problems(`sum([${inner} ? 1 : 2]) > 0`)).toEqual([
      { message: unstopped, at: `[${inner} ? 1 : 2]` },
      {
        message:
          "This is undecided when `count` has no value. Add `?? false` or `?? true` to decide it then.",
        at: inner,
      },
    ]);
    passes(`sum([(${inner}) ?? false ? 1 : 2]) > 0`);
    passes("sum([(count === 1 && (count ?? 0) > 0) ?? false ? 1 : 2]) > 0");
  });

  test("a read an inner && or || leaves unrun is reported too, and its fallback saves", () => {
    const inner = "(count ?? 0) > 0 && count > 0 ? 1 : 2";
    expect(problems(`isMissing(count) || sum([${inner}]) > 0`)).toEqual([
      { message: unstopped, at: `[${inner}]` },
    ]);
    passes(
      "isMissing(count) || sum([(count ?? 0) > 0 && (count ?? 0) > 0 ? 1 : 2]) > 0",
    );
  });

  test("a read a ternary test around the call decides is reported too, and its fallback saves", () => {
    expect(
      problems("isMissing(count) || (count > 0 ? sum([count]) : 0) > 0"),
    ).toEqual([{ message: unstopped, at: "[count]" }]);
    passes("isMissing(count) || (count > 0 ? sum([count ?? 0]) : 0) > 0");
  });

  test.each([
    [
      "isMissing(count) || sum([[count].length]) > 0",
      "[[count].length]",
      "isMissing(count) || sum([[count ?? 0].length]) > 0",
    ],
    [
      "!isMissing(count) && sum([count, total].filter((m) => !isMissing(m))) > 0",
      "[count, total].filter((m) => !isMissing(m))",
      "!isMissing(count) && sum([count ?? 0, total].filter((m) => !isMissing(m))) > 0",
    ],
    [
      "(count === 1 && sum([(count ?? 0) === 1 ? count : 0]) > 0) ?? false",
      "[(count ?? 0) === 1 ? count : 0]",
      "(count === 1 && sum([(count ?? 0) === 1 ? count ?? 0 : 0]) > 0) ?? false",
    ],
  ])(
    "%s is reported, an accepted over-report, and its fallback saves",
    (text, at, fixed) => {
      expect(problems(text)).toEqual([{ message: unstopped, at }]);
      passes(fixed);
    },
  );

  test("a read in a record field the parameter doesn't declare is reported, an accepted over-report, and its fallback saves", () => {
    const row = (extra: string) =>
      `isMissing(count) || [{ n: 1, extra: ${extra} }].some((r) => scored(r) === "a")`;
    expect(problems(row("count"))).toEqual([{ message: unstopped, at: "r" }]);
    passes(row("count ?? 0"));
  });

  test.each([
    [
      'isMissing(count) || [{ n: count }].some((r) => isMissing(r.n) ? false : scored(r) === "a")',
      "r",
      'isMissing(count) || [{ n: count ?? 0 }].some((r) => isMissing(r.n) ? false : scored(r) === "a")',
    ],
    [
      "isMissing(count) || [[count]].some((l) => isMissing(l[0]) ? false : sum(l) > 0)",
      "l",
      "isMissing(count) || [[count ?? 0]].some((l) => isMissing(l[0]) ? false : sum(l) > 0)",
    ],
  ])(
    "a ternary checking a parameter's field or item doesn't stop %s, an accepted over-report, and its fallback saves",
    (text, at, fixed) => {
      expect(problems(text)).toEqual([{ message: unstopped, at }]);
      passes(fixed);
    },
  );

  test.each([
    "isMissing(count) || [1, 2].reduce((a, x) => x === 1 ? count ?? 0 : sum([a]), 0) > 0",
    "isMissing(count) || [1, 2].reduce((a, x) => (count ?? 0) === 1 ? a : sum([a]), 0) > 0",
  ])(
    "the fallback asked for on a read reaching reduce's accumulator saves: %s",
    (text) => {
      passes(text);
    },
  );

  test.each([
    [
      "isMissing(count) || [count].some((m) => isMissing(total) ? false : sum([m]) > 0)",
      "[m]",
    ],
    [
      "isMissing(count) || [count].some((m) => isMissing(count) ? sum([m]) > 0 : false)",
      "[m]",
    ],
    [
      "isMissing(count) || [count].some((m) => isMissing(count) || sum([m]) > 0)",
      "[m]",
    ],
    [
      "isMissing(count) || [[count]].some((l) => isMissing(count) || sum(l) > 0)",
      "l",
    ],
  ])(
    "only the branch a ternary on the carried read guards is clear of it: %s",
    (text, at) => {
      expect(problems(text)).toEqual([{ message: unstopped, at }]);
    },
  );

  test("every read reaching the same argument is named", () => {
    expect(
      problems(
        "isMissing(count) || isMissing(marks[0]) || sum([count, marks[0]]) > 0",
      ),
    ).toEqual([
      { message: unstopped, at: "[count, marks[0]]" },
      { message: unstoppedAt("marks[0]"), at: "[count, marks[0]]" },
    ]);
  });

  test.each([
    "isMissing(count) ? true : sum([count]) > 0",
    "isMissing(count) ? true : [[count]].some((l) => !isMissing(l) && sum(l) > 0)",
    "isMissing(count) || sum([count ?? 1]) > 0",
    "isMissing(count) || (isMissing(count) ? 0 : sum([count])) > 0",
    "isMissing(count) || [1].reduce((a, x) => sum([a ?? 0]), count) > 0",
    "isMissing(count) || sum([count].map((m) => m ?? 0)) > 0",
    "isMissing(count) || double(count) > 0",
    'isMissing(count) || describe(count) === "a"',
    "isMissing(count) || highest([count]) > 0",
    "isMissing(count) || highest([count].map((m) => m)) > 0",
    "isMissing(count) || highest([count].concat([1])) > 0",
    "isMissing(count) || maybeSum(isMissing(count) ? null : [count]) > 0",
    'isMissing(count) || flagged({ flag: count === 1 }) === "a"',
    "isMissing(count) || [double(count)].length > 0",
    "isMissing(count) || [double(count) > 0].length > 0",
    "isMissing(count) || [count].map((m) => double(m)).length > 0",
    "isMissing(count) || double([count].length) > 0",
    "isMissing(count) || double([count].indexOf(1)) > 0",
    "isMissing(count) || double([count].reduce((a, x) => a + x, 0)) > 0",
    "isMissing(count) || sum([[count].find((m) => m > 0) ?? 0]) > 0",
    "isMissing(count) || [[count]].map((l) => l.length).length > 0",
    "isMissing(count) || sum([[count]].map((l) => l[0] ?? 0)) > 0",
    "isMissing(count) || sum([[count][0] ?? 0]) > 0",
    "isMissing(count) || sum([total > 0 && !isMissing(count) && count > 0 ? 1 : 2]) > 0",
    "isMissing(count) || sum([(isMissing(count) || count > 0) ? 1 : 2]) > 0",
    "isMissing(count) || sum([count].map((m, i) => i)) > 0",
    "isMissing(count) || [count].reduce((a, x, i) => a + sum([i]), 0) > 0",
    "isMissing(count) || [count].reduce((a, x) => sum([a]), 0) > 0",
    "isMissing(count) || [count].reduce((a, x) => [sum(a)], [1]).length > 0",
    "isMissing(count) || [count].some((m) => maybeSum(m > 0 ? [1] : null) > 0)",
    "isMissing(count) || sum([count].sort()) > 0",
    'isMissing(count) || sum([count].join() === "" ? [1] : [2]) > 0',
    "isMissing(count) || ((true ? true : null) ?? sum([count]) > 0)",
    'isMissing(state) || names([state].map((x) => x)) === "a"',
    'isMissing(usBased) || names([usBased].map((x) => x)) === "a"',
    'isMissing(state) || [{ note: state }].some((r) => noted(r) === "a")',
    'isMissing(state) || noted([{ note: state }].map((r) => r)[0] ?? { note: null }) === "a"',
    "isMissing(count) || [{ n: count }].some((r) => sum(r.n === 1 ? [1] : [2]) > 0)",
    "isMissing(count) || sum({ n: count }.n === 1 ? [1] : [2]) > 0",
    "isMissing(count) || [count].some((m) => isMissing(count) ? false : sum([m]) > 0)",
    "isMissing(count) || [[count]].some((l) => isMissing(count) ? false : sum(l) > 0)",
    'isMissing(count) || [{ n: count }].some((r) => isMissing(count) ? false : scored(r) === "a")',
    "isMissing(count) || [1].reduce((a, x) => isMissing(count) ? 0 : sum([a]), count) > 0",
  ])(
    "a check covers what a function takes missing or never gets: %s",
    (text) => {
      passes(text);
    },
  );

  test.each([
    [
      "isMissing(count) || sum([[count][0]]) > 0",
      "Type 'number | undefined' is not assignable to type 'number'. Type 'undefined' is not assignable to type 'number'.",
      "[count][0]",
    ],
    [
      "isMissing(count) || sum([1].concat([[count][0]])) > 0",
      "Type 'number | undefined' is not assignable to type 'number'. Type 'undefined' is not assignable to type 'number'.",
      "[count][0]",
    ],
    [
      "isMissing(count) || (false ? sum([double(count)]) : 0) > 0",
      "Argument of type 'number | null' is not assignable to parameter of type 'number'. Type 'null' is not assignable to type 'number'.",
      "count",
    ],
    [
      "isMissing(count) || sum(total > 0 ? [count] : null) > 0",
      "Argument of type 'number[] | null' is not assignable to parameter of type 'number[]'. Type 'null' is not assignable to type 'number[]'.",
      "total > 0 ? [count] : null",
    ],
    [
      "items.some((i) => isMissing(i.score) || sum(items.map((j) => i.score)) > 0)",
      "Argument of type '(number | null)[]' is not assignable to parameter of type 'number[]'. Type 'number | null' is not assignable to type 'number'. Type 'null' is not assignable to type 'number'.",
      "items.map((j) => i.score)",
    ],
  ])(
    "a value tsc rejects, or one that never runs, gets only tsc's report: %s",
    (text, message, at) => {
      expect(problems(text)).toEqual([{ message, at }]);
    },
  );
});
