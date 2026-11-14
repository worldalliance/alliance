import {
  UNDECIDED_STATE,
  condition,
  groupCondition,
  named,
  passes,
  problems,
  variable,
} from "./check-test-support";

describe("undecided results", () => {
  test("a comparison with an unknown needs a fallback in visibility", () => {
    expect(problems('state === "CA"')).toEqual([
      { message: UNDECIDED_STATE, at: 'state === "CA"' },
    ]);
    expect(problems('state !== "CA"')[0].message).toBe(UNDECIDED_STATE);
  });

  test("the fallback passes, and TS2869 doesn't fail it", () => {
    expect(passes('(state === "CA") ?? false')).toMatchObject({
      type: "boolean",
      mayBeUnknown: false,
    });
    expect(passes('!(state === "CA" && total > 1) ?? true').mayBeUnknown).toBe(
      false,
    );
  });

  test("a fallback after one that never runs is still unreachable", () => {
    expect(
      problems('true ?? (state === "CA") ?? false', variable).map(
        ({ at }) => at,
      ),
    ).toEqual(["true", 'state === "CA"']);
  });

  test("each fallback a chain needs passes", () => {
    expect(
      passes('(state === "CA") ?? (count === 1) ?? false').mayBeUnknown,
    ).toBe(false);
  });

  test("a split group may stay undecided and reports that it can", () => {
    expect(passes('state === "CA"', groupCondition).mayBeUnknown).toBe(true);
    expect(
      passes('state === "CA" || total > 1', groupCondition).mayBeUnknown,
    ).toBe(true);
    expect(passes("total > 1", groupCondition).mayBeUnknown).toBe(false);
  });

  test("a parameter that accepts a missing value takes an unknown tsc can't see", () => {
    expect(passes("describe(marks.indexOf(3))", variable).mayBeUnknown).toBe(
      false,
    );
  });

  test("a type error shows beside an undecided report at its span", () => {
    expect(problems('double(state === "CA") > 1')).toEqual([
      { message: UNDECIDED_STATE, at: 'state === "CA"' },
      {
        message:
          "Argument of type 'boolean' is not assignable to parameter of type 'number'.",
        at: 'state === "CA"',
      },
    ]);
  });

  test.each(["count > 5", "-count > 5", "count + 1 > 5"])(
    "an unguarded read %s gets only tsc's error, which only its own fallback fixes",
    (text) => {
      expect(problems(text)).toEqual([
        { message: "'count' is possibly 'null'.", at: "count" },
      ]);
    },
  );

  test.each([
    '(state === "CA") || true',
    'true || state === "CA"',
    '(state === "CA") && false',
    "items.some(item => item.score === 3 || true)",
    'true ? true : state === "CA"',
    'false ? state === "CA" : true',
    'true ? true : (state === "CA" ? true : false)',
    'true ? true : describe(state === "CA" ? 1 : 2) === "a"',
  ])("a literal that decides %s leaves nothing undecided", (text) => {
    expect(passes(text).mayBeUnknown).toBe(false);
  });

  test("a fallback after a left side tsc sees can be missing isn't fitted to it", () => {
    expect(passes('count ?? "x"', variable).type).toBe("string | number");
  });

  test("a fallback that never runs passes on nothing", () => {
    expect(passes("(total ?? count) > 0", variable).mayBeUnknown).toBe(false);
  });

  test("text that can be unknown leaves a fallback after it reachable", () => {
    expect(problems('`Hi ${state}` ?? "Hi"', variable)).toEqual([
      {
        message:
          'Members without a value for `state` would see no text here. Add `?? "…"` to choose what they see instead.',
        at: "state",
      },
    ]);
  });

  test.each([
    ['(state === "CA") ? 1 : 2', '(state === "CA")'],
    ['[state === "CA"]', 'state === "CA"'],
    ['describe(state === "CA" ? 1 : 2)', 'state === "CA"'],
    [
      'isUnknown(describe(state === "CA" ? 1 : 2)) || describe(state === "CA" ? 1 : 2) === "x"',
      'state === "CA"',
    ],
    ['isUnknown(describe(state === "CA" ? 1 : 2))', 'state === "CA"'],
    ['isUnknown(sum([state === "CA" ? 1 : 2]))', 'state === "CA"'],
  ])("an undecided value can't reach %s unhandled", (text, at) => {
    expect(problems(text, variable)).toContainEqual({
      message: UNDECIDED_STATE,
      at,
    });
  });

  test("a method call is unknown when an argument or reduce's function is", () => {
    expect(problems("[1, null].includes(count)")).toEqual([
      {
        message:
          "This is undecided when `count` has no value. Add `?? false` or `?? true` to decide it then.",
        at: "[1, null].includes(count)",
      },
    ]);
    expect(
      problems("[1, null].includes(count) ? 1 : 2", variable),
    ).toHaveLength(1);
    expect(passes("[1, null].includes(count) ?? false").type).toBe("boolean");
    const reduce = '[1, 2].reduce((a, m) => a && (state === "CA"), true)';
    expect(passes(`${reduce} ?? false`).mayBeUnknown).toBe(false);
  });

  test("a lookup in a list with missing items can be undecided", () => {
    expect(problems("items.map(item => item.score).includes(3)")).toEqual([
      {
        message:
          "This is undecided when an item of `items.map(item => item.score)` has no value. Add `?? false` or `?? true` to decide it then.",
        at: "items.map(item => item.score).includes(3)",
      },
    ]);
    expect(passes("items.map(item => item.score ?? 0).includes(3)").type).toBe(
      "boolean",
    );
    expect(
      passes("marks.filter(m => !isUnknown(m)).includes(1)").mayBeUnknown,
    ).toBe(false);
    expect(
      passes("items.map(item => item.score).includes(3) ?? false").type,
    ).toBe("boolean");
  });

  test("list predicates need a decided yes/no", () => {
    expect(problems("items.some(item => item.score === 3)")).toContainEqual({
      message:
        "This is undecided when `item.score` has no value. Add `?? false` or `?? true` to decide it then.",
      at: "item.score === 3",
    });
    expect(
      passes("items.some(item => (item.score === 3) ?? false)").mayBeUnknown,
    ).toBe(false);
  });

  test.each([
    ['(state === "CA") ?? 5', condition, "5", "boolean"],
    ["(marks.indexOf(3) ?? false) + 1", variable, "false", "number"],
  ])("%s: a required fallback must fit the value", (text, rule, at, type) => {
    expect(problems(text, rule)).toEqual([
      {
        message: `The fallback has to be ${type}, like the value before \`??\`.`,
        at,
      },
    ]);
  });

  test("a report inside a named expression is located in it", () => {
    const greeting = named({
      id: "n1",
      name: "greeting",
      text: "`Hi ${state}`",
    });
    expect(problems("greeting", { ...variable, named: [greeting] })).toEqual([
      {
        message:
          'Members without a value for `state` would see no text here. Add `?? "…"` to choose what they see instead.',
        at: "greeting@6",
      },
    ]);
  });

  test("a fallback that can be missing passes its unknown on", () => {
    const isCA = named({ id: "n1", name: "isCA", text: 'state === "CA"' });
    passes('(usBased === "yes") ?? isCA ?? false', {
      ...condition,
      named: [isCA],
    });
    expect(passes("marks.indexOf(3) ?? count", variable).mayBeUnknown).toBe(
      true,
    );
    expect(
      problems('(usBased === "yes") ?? isCA', { ...condition, named: [isCA] }),
    ).toEqual([
      {
        message:
          "This is undecided when `isCA` has no value. Add `?? false` or `?? true` to decide it then.",
        at: '(usBased === "yes") ?? isCA',
      },
    ]);
  });

  test.each([
    ["(count !== 1 || false) ?? count > 0", "count"],
    ['(state !== "CA" || total < 0) ?? state.length > 1', "state"],
    ["(count !== 1 || total < 0) ?? count === 1", undefined],
  ])("a read the left of ?? narrows can be missing in %s", (text, at) => {
    expect(problems(text).map((problem) => problem.at)).toEqual([at ?? text]);
    const rule = named({ id: "n1", name: "rule", text });
    const reader = problems("rule ? 1 : 2", { ...variable, named: [rule] });
    const reportedAt = at && `rule@${text.lastIndexOf(at)}`;
    expect(reader.map((problem) => problem.at)).toEqual([reportedAt ?? "rule"]);
  });

  test.each([
    ["marks.indexOf(3) + 1", "marks.indexOf(3)"],
    ["-marks.lastIndexOf(3)", "marks.lastIndexOf(3)"],
  ])("a missing number in %s asks for any fallback", (text, at) => {
    expect(problems(text, variable)).toEqual([
      {
        message:
          "This is undecided when an item of `marks` has no value. Add `?? …` to choose a value then.",
        at,
      },
    ]);
  });

  test("a record entry can't hold an undecided value", () => {
    expect(problems('({ a: state === "CA" })', variable)).toEqual([
      { message: UNDECIDED_STATE, at: 'state === "CA"' },
    ]);
  });

  test.each(["marks.indexOf(5) > 0", "-marks.indexOf(5) > 0"])(
    "%s reports its missing fallback once",
    (text) => {
      expect(problems(text)).toEqual([
        {
          message:
            "This is undecided when an item of `marks` has no value. Add `?? …` to choose a value then.",
          at: "marks.indexOf(5)",
        },
      ]);
      expect(
        passes(text.replace("marks.indexOf(5)", "(marks.indexOf(5) ?? -1)"))
          .mayBeUnknown,
      ).toBe(false);
    },
  );

  test("an undecided ternary test doesn't also make its fallback unreachable", () => {
    expect(problems('(state === "CA" ? 1 : 2) ?? 3', variable)).toEqual([
      { message: UNDECIDED_STATE, at: 'state === "CA"' },
    ]);
  });

  test.each([
    '([state === "CA"].length > 0) ?? false',
    '[state === "CA" ? 1 : 2].length > 0 ?? false',
    '[1].map(x => state === "CA").length > 0 ?? false',
  ])("what is undecided inside %s leaves it known", (text) => {
    expect(problems(text).map(({ message }) => message)).toEqual([
      "Right operand of ?? is unreachable because the left operand is never nullish.",
      UNDECIDED_STATE,
    ]);
  });

  test("a result that doesn't fit the consumer's type gets only tsc's mismatch", () => {
    expect(problems("count")).toEqual([
      {
        message: "Type 'number' is not assignable to type 'boolean'.",
        at: "count",
      },
    ]);
  });

  test("join on a list with a missing item is rejected, and only that", () => {
    expect(problems('marks.join(",") === "x"')).toEqual([
      {
        message:
          "join works on a list of text, numbers or yes/no. Name a part of each item first, or flatten a list of lists with .flat().",
        at: "marks",
      },
    ]);
  });

  test("a missing item leaves sort without a function unknown", () => {
    expect(passes("marks.sort()", variable).mayBeUnknown).toBe(true);
    expect(passes("marks.sort((a, b) => 0)", variable).mayBeUnknown).toBe(
      false,
    );
  });

  test("an argument tsc rejects gets no undecided report", () => {
    expect(problems("[1, 2].includes(count)")).toEqual([
      {
        message:
          "Argument of type 'number | null' is not assignable to parameter of type 'number'. Type 'null' is not assignable to type 'number'.",
        at: "count",
      },
    ]);
  });

  test("a method on a target tsc rejects gets only tsc's error", () => {
    expect(problems('state.trim() === "x"')).toEqual([
      { message: "'state' is possibly 'null'.", at: "state" },
    ]);
    expect(problems('state?.trim() === "x"').map(({ at }) => at)).toEqual([
      'state?.trim() === "x"',
    ]);
  });

  test.each([
    ['(state.trim() === "x") ?? false', "state"],
    ['("ab".indexOf(state) > 0) ?? false', "state"],
    ["(count > 1) ?? false", "count"],
  ])(
    "a value tsc rejects in %s leaves the fallback after it allowed",
    (text, at) => {
      expect(problems(text)).toEqual([expect.objectContaining({ at })]);
    },
  );

  test.each(['flags([state === "CA"])', 'flagged({ flag: state === "CA" })'])(
    "a list item or record field a parameter lets be missing takes an unknown in %s",
    (text) => {
      expect(passes(text, variable).mayBeUnknown).toBe(false);
    },
  );
});

describe("text", () => {
  test("a template part that can be missing needs a fallback", () => {
    expect(
      problems("`Hi ${state}, you have ${total} points`", variable),
    ).toEqual([
      {
        message:
          'Members without a value for `state` would see no text here. Add `?? "…"` to choose what they see instead.',
        at: "state",
      },
    ]);
    expect(passes('`Hi ${state ?? "there"}`', variable).type).toBe("string");
  });

  test("text joined with + needs a fallback too", () => {
    expect(problems('"Hi " + state', variable)).toEqual([
      {
        message:
          'Members without a value for `state` would see no text here. Add `?? "…"` to choose what they see instead.',
        at: "state",
      },
    ]);
  });

  test("a literal `null` in text names no value", () => {
    expect(problems("`a${null}`", variable)).toEqual([
      {
        message:
          'Members would see no text here. Add `?? "…"` to choose what they see instead.',
        at: "null",
      },
    ]);
  });
});
