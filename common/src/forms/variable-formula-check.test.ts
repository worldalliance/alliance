import {
  checkVariableFormulaType,
  variableFormulaType,
} from "./variable-formula-check";

const CHOICE = "{ label: string; value: string }";

const ENV: ReadonlyMap<string, string> = new Map([
  ["num", "number | undefined"],
  ["text", "string | undefined"],
  ["flag", "boolean | undefined"],
  ["choice", `${CHOICE} | undefined`],
  ["choices", `${CHOICE}[] | undefined`],
  ["rows", "{ name: string | undefined; age: number | undefined }[]"],
  ["crew", `{ roles: ${CHOICE}[] | undefined; name: string | undefined }[]`],
  ["city", "{ id: number; name: string; label: string } | undefined"],
]);

const errorFor = (formula: string): string | null => {
  const checked = checkVariableFormulaType(formula, ENV);
  return checked.ok ? null : checked.error;
};

const typeOf = (formula: string): string => {
  const checked = variableFormulaType(formula, ENV);
  if (!checked.ok) throw new Error(`did not check: ${checked.error}`);
  return checked.value;
};

describe("accepts what TypeScript accepts", () => {
  it.each([
    "'You gave ' + num",
    "num + ' points'",
    "text + num",
    "num + 1",
    "num * 2",
    "-num",
    "!flag",
    "num > 0",
    "text < 'z'",
    "num ?? 0",
    "(num ?? 0) + 1",
    "flag ? 'yes' : 'no'",
    "text.toUpperCase()",
    "text.length",
    "num.toFixed(2)",
    "choice.label",
    "choice.value === 'v1'",
    "choices.length",
    "choices.map(item => item.label).join(', ')",
    "choices.filter(item => item.value !== 'x').length",
    "choices.some(item => item.value === 'x')",
    "choices.at(0).label",
    "choices.find(item => item.value === 'x').label",
    "choices.reduce((total, item) => total + item.label, '')",
    "text.split(',').map(part => part.trim()).join('|')",
    "(choices ?? []).length",
    "choices.sort((a, b) => (a.label < b.label ? -1 : 1)).map(c => c.label).join()",
    "Math.round(num)",
    "Math.max(num, 0)",
    "choices.map(item => item.value).includes('x')",
    "choice ? choice.label : 'none'",
  ])("%s", (formula) => {
    expect(errorFor(formula)).toBeNull();
  });
});

describe("rejects what TypeScript rejects", () => {
  it.each([
    ["num.map(item => item)", "Property 'map' does not exist on type 'number'"],
    ["text.toFixed(2)", "Property 'toFixed' does not exist on type 'string'"],
    ["choices.length.map(item => item)", "Property 'map' does not exist"],
    ["text.length.toUpperCase()", "Property 'toUpperCase' does not exist"],
    ["choice - 1", "has to be a number"],
    ["choices * 2", "has to be a number"],
    ["text * 2", "has to be a number"],
    ["choice.label - 1", "has to be a number"],
    ["choices + num", "Operator '+' cannot be applied"],
    ["text < num", "Operator '<' cannot be applied"],
    ["num === text", "types 'number' and 'string' have no overlap"],
    ["choice === 'v1'", "have no overlap"],
    ["Math.round(choice)", "not assignable to parameter of type 'number'"],
    ["choices.map()", "Expected 1 arguments, but got 0"],
    ["choice.lable", "Property 'lable' does not exist"],
  ])("%s", (formula, message) => {
    expect(errorFor(formula)).toContain(message);
  });

  it("suggests the key an admin meant", () => {
    expect(errorFor("choice.lable")).toContain("Did you mean 'label'?");
  });

  it("says nothing about compiler options an admin cannot set", () => {
    const message = errorFor("choices.toSorted()");
    expect(message).toContain("Property 'toSorted' does not exist");
    expect(message).not.toContain("lib");
    expect(message).not.toContain("target library");
  });
});

// `noLib` means the checker's whole world is `formula-lib.ts`. A name the
// evaluator cannot run should be unknown rather than merely discouraged.
describe("knows nothing the evaluator cannot run", () => {
  it.each([
    "document.cookie",
    "window.location",
    "new Date()",
    "fetch('/x')",
    "JSON.stringify(choice)",
    "Object.keys(choice).length",
    "text.matchAll('a')",
    "choices.toSorted().length",
    "num.toLocaleString()",
    "Math.random()",
  ])("%s", (formula) => {
    expect(errorFor(formula)).not.toBeNull();
  });
});

describe("requires a formula to end on something readable", () => {
  it.each([
    "choices",
    "choice",
    "{ a: num }",
    "choices.map(item => item.label)",
    "choices.filter(item => item.value)",
  ])("rejects %s", (formula) => {
    expect(errorFor(formula)).toContain(
      "A formula has to end on text, a number or a yes/no",
    );
  });

  it("says how to turn a list into a sentence", () => {
    expect(errorFor("choices")).toContain(
      ".map(item => item.label).join(', ')",
    );
  });

  it("says to name a key when a record has none worth suggesting", () => {
    expect(errorFor("{ a: choices }")).toContain("Name a key.");
  });

  it.each([
    ["rows", "End it with .map(item => item.name).join(', ')"],
    ["rows[0]", "End it with .name."],
    ["crew", "End it with .map(item => item.name).join(', ')"],
    ["city", "End it with .label."],
    ["({ 'first name': text, n: num })", "End it with .n."],
    ["(choice || city)", "End it with .label."],
    [
      "choices || []",
      "Wrap it in parentheses and end it with .map(item => item.label).join(', ')",
    ],
    ["flag ? choice : city", "Wrap it in parentheses and end it with .label."],
    ["[choice, city]", "End it with .map(item => item.label).join(', ')"],
    ["({ $a: text })", "End it with .$a."],
    [
      "flag ? text : choices",
      "In the part that gives it, add .map(item => item.label).join(', ')",
    ],
  ])("names a key %s actually has", (formula, advice) => {
    expect(errorFor(formula)).toContain(advice);
  });

  it("suggests joining a list of text", () => {
    expect(errorFor("text.split(',')")).toContain("End it with .join(', ')");
  });

  it.each([
    ["rows.join(', ')", ", like .map(item => item.name).join(', ')"],
    ["choices.join()", ", like .map(item => item.label).join(', ')"],
    ["[choice, city].join()", ", like .map(item => item.label).join(', ')"],
    ["(flag ? choices : rows).join()", ""],
    ["choices.map(item => [item]).join()", ""],
    ["crew.map(p => p.roles).join()", ""],
  ])("rejects %s, which would show [object Object]", (formula, example) => {
    expect(errorFor(formula)).toBe(
      `join works on a list of text, numbers or yes/no. Name a part of each item first${example}, or flatten a list of lists with .flat().`,
    );
  });

  it.each([
    ["flag ? rows[0] : choice", "Name a key."],
    ["flag ? text : flag ? rows[0] : choice", "Name a key."],
    [
      "flag ? text : flag ? choices : rows",
      "In the part that gives it, add .length.",
    ],
  ])("names no key only one part of %s has", (formula, advice) => {
    expect(errorFor(formula)).toContain(advice);
  });

  it.each([
    [
      "flag ? rows : rows[0]",
      "Add .length to the part that gives a list, and .name to the part that gives a record.",
    ],
    [
      "flag ? choices : ({ 'first name': text })",
      "Add .length to the part that gives a list, and name a key in the part that gives a record.",
    ],
  ])("gives each part of %s its own fix", (formula, advice) => {
    expect(errorFor(formula)).toContain(advice);
  });

  it.each(["choices.map(item => [item])", "rows.map(item => ({}))"])(
    "doesn't suggest joining %s, whose items would show as [object Object]",
    (formula) => {
      const error = errorFor(formula);
      expect(error).toContain("End it with .length.");
      expect(error).not.toContain("join");
    },
  );

  it.each(["text.split(',').join", "choices.map", "Math.max"])(
    "says to call %s, a method left uncalled",
    (formula) => {
      expect(errorFor(formula)).toContain(
        "this one gives a function. Add () to call it.",
      );
    },
  );

  it.each([
    "(x => x)",
    "flag ? choices : (x => 1)",
    "flag ? (x => 1) : choices",
    "flag ? city : (x => 1)",
  ])("says an arrow function in %s is for a list method", (formula) => {
    expect(errorFor(formula)).toContain(
      "this one gives a function. An arrow function is something to pass to a list method",
    );
  });

  it.each(["text", "num", "flag", "num ?? 'n/a'", "choices.length"])(
    "accepts %s",
    (formula) => {
      expect(errorFor(formula)).toBeNull();
    },
  );
});

describe("infers the type a formula produces", () => {
  it.each([
    ["num", "number"],
    ["num + 1", "number"],
    ["'a' + num", "string"],
    ["num ?? 0", "number"],
    ["choice.label", "string"],
    ["choices.map(item => item.label)", "string[]"],
    ["choices.map(item => item.value.length)", "number[]"],
    ["text.split(',')", "string[]"],
    ["num > 1", "boolean"],
    ["choices.length", "number"],
    ["text.toUpperCase()", "string"],
    ["num.toFixed(2)", "string"],
    ["choices.map(item => item.label).join(', ')", "string"],
    ["[[1], [2]].flat()", "number[]"],
    ["[[1, [2]]].flat()", "(number | number[])[]"],
    ["[[1, [2]]].flat(2)", "number[]"],
    ["choices.flatMap(item => [item.label])", "string[]"],
  ])("%s is %s", (formula, expected) => {
    expect(typeOf(formula)).toBe(expected);
  });
});

describe("lets an unanswered field through every operator", () => {
  it.each([
    "text.toUpperCase()",
    "choices.map(item => item.label).join(', ')",
    "num + 1",
    "choice.label",
    "text.padStart(num, '.')",
    "choices.at(0).label",
  ])("%s", (formula) => {
    expect(errorFor(formula)).toBeNull();
  });
});

describe("widens rather than guessing", () => {
  const untyped = (formula: string) =>
    checkVariableFormulaType(formula, new Map([["mystery", "any"]])).ok;

  it("reads an input whose field is gone as any", () => {
    expect(untyped("mystery * 2")).toBe(true);
    expect(untyped("mystery.whatever")).toBe(true);
    expect(untyped("mystery.map(item => item.whatever).join()")).toBe(true);
  });

  it("reads an empty list as a list of anything", () => {
    expect(errorFor("[].length")).toBeNull();
    expect(errorFor("[].map(item => item.anything).join()")).toBeNull();
  });
});
