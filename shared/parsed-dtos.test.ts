import { R } from "@alliance/common/result";
import type { AdminFollowUpFormDto } from "./client/types.gen";
import {
  parseFollowUpFormDto,
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

describe("parseFollowUpFormDto", () => {
  const followUpForm = (
    cohortExpression: AdminFollowUpFormDto["cohortExpression"],
  ): AdminFollowUpFormDto => ({
    id: 1,
    name: null,
    startDate: null,
    endDate: null,
    instructions: null,
    actionId: 2,
    formId: 3,
    cohortExpression,
  });

  it("keeps a stored expression", () => {
    const parsed = parseFollowUpFormDto(followUpForm({ type: "AllMembers" }));
    expect(parsed.followUpForm.cohortExpression).toEqual({
      type: "AllMembers",
    });
    expect(parsed.cohortExpressionError).toBeNull();
  });

  it("reads a missing expression as null", () => {
    const parsed = parseFollowUpFormDto(followUpForm(null));
    expect(parsed.followUpForm.cohortExpression).toBeNull();
    expect(parsed.cohortExpressionError).toBeNull();
  });

  it("reads an unparseable expression as null, and reports the error", () => {
    const { value, logged } = withSilencedErrors(() =>
      parseFollowUpFormDto(followUpForm({ type: "NoSuchLeaf" })),
    );
    expect(value.followUpForm.cohortExpression).toBeNull();
    expect(value.cohortExpressionError).not.toBeNull();
    expect(logged).toBe(1);
  });
});
