import { R } from "@alliance/common/result";
import { parseVisibilityValidatorResults } from "./parsed-dtos";

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
