import { R } from "@alliance/common/result";
import {
  parseFormResponseHistory,
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

describe("parseFormResponseHistory", () => {
  const schema = {
    pages: [
      {
        id: "p1",
        fields: [{ id: "home", type: "input", kind: "city", label: "Home" }],
      },
    ],
    outputViews: [],
  };

  it("reads an answer to a question its version holds in a form that no longer parses", () => {
    const radio = (values: string[]) => ({
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "color",
              type: "input",
              kind: "radio",
              label: "Color",
              options: values.map((value) => ({ label: value, value })),
            },
          ],
        },
      ],
      outputViews: [],
    });
    const history = parseFormResponseHistory({
      schema: radio(["red", "blue"]),
      responses: [
        {
          id: 1,
          schemaSnapshot: radio(["red", "red"]),
          answers: { color: "red" },
        },
      ],
    });
    expect(R.unwrap(history).responses[0].fields.get("color")).toBeDefined();
  });

  it("names the response it can't read", () => {
    const history = parseFormResponseHistory({
      schema,
      responses: [
        { id: 1, schemaSnapshot: schema, answers: {} },
        { id: 2, schemaSnapshot: schema, answers: { home: null } },
      ],
    });
    expect(R.isFailure(history) && history.error.message).toContain(
      "response 2",
    );
  });

  it("reads a city answer saved with keys since dropped", () => {
    const history = parseFormResponseHistory({
      schema,
      responses: [
        {
          id: 1,
          schemaSnapshot: schema,
          answers: {
            home: { id: 1, name: "Lima", latitude: -12.05, longitude: -77.04 },
          },
        },
      ],
    });
    expect(R.unwrap(history).responses[0].answers).toEqual({
      home: {
        id: 1,
        name: "Lima",
        admin1: "",
        countryCode: "",
        countryName: "",
      },
    });
  });
});
