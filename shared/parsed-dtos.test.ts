import { R } from "@alliance/common/result";
import {
  parseContributionFormula,
  parseFormulaChoices,
  parseVisibilityValidatorResults,
} from "./parsed-dtos";

function withSilencedErrors<T>(fn: () => T): { value: T; logged: number } {
  const original = console.error;
  let logged = 0;
  console.error = () => {
    logged += 1;
  };
  try {
    return { value: fn(), logged };
  } finally {
    console.error = original;
  }
}

describe("parseVisibilityValidatorResults", () => {
  it("reads the string keys jsonb stored the validator ids as", () => {
    const result = parseVisibilityValidatorResults({ "42": true, "7": false });
    expect(R.unwrapOr(result, {})).toEqual({ 42: true, 7: false });
  });

  it("treats an absent blob as a response that recorded nothing", () => {
    expect(
      R.unwrapOr(parseVisibilityValidatorResults(null), { 1: true }),
    ).toEqual({});
    expect(
      R.unwrapOr(parseVisibilityValidatorResults(undefined), { 1: true }),
    ).toEqual({});
  });

  it("keeps the readable verdicts beside an unreadable one", () => {
    const { value, logged } = withSilencedErrors(() =>
      parseVisibilityValidatorResults({
        "42": true,
        "7": "yes",
        notAnId: false,
      }),
    );
    expect(R.unwrapOr(value, {})).toEqual({ 42: true });
    expect(logged).toBe(1);
  });

  it("fails when the blob is not an object", () => {
    const { value } = withSilencedErrors(() =>
      parseVisibilityValidatorResults("nope"),
    );
    expect(R.isFailure(value)).toBe(true);
  });
});

describe("parseFormulaChoices", () => {
  it("reads saved choices as they are", () => {
    const choices = { pick: [{ label: "Red", value: "red" }] };
    expect(parseFormulaChoices(choices)).toEqual(choices);
  });

  it("reads unreadable choices as none, and logs them", () => {
    const { value, logged } = withSilencedErrors(() =>
      parseFormulaChoices({ pick: "red" }),
    );
    expect(value).toEqual({});
    expect(logged).toBe(1);
  });
});

describe("parseContributionFormula", () => {
  it("reads an unwritten formula as null", () => {
    expect(parseContributionFormula(null)).toEqual(R.success(null));
  });

  it("reads a formula over the member's own answers", () => {
    const formula = {
      inputs: { input1: { kind: "field", fieldId: "letters" } },
      formula: 'input1 + " letters"',
    };
    expect(parseContributionFormula(formula)).toEqual(R.success(formula));
  });

  it("refuses a formula that reads another form", () => {
    const { value, logged } = withSilencedErrors(() =>
      parseContributionFormula({
        inputs: {
          input1: { kind: "sourceField", sourceFormId: 4, fieldId: "letters" },
        },
        formula: "input1",
      }),
    );
    expect(value.ok).toBe(false);
    expect(logged).toBe(1);
  });
});
