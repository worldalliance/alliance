import { R } from "../result";
import { readSourceHistory } from "./variable-source-history";

describe("readSourceHistory", () => {
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
    const history = readSourceHistory({
      schema: radio(["red", "blue"]),
      responses: [
        {
          id: 1,
          schemaSnapshot: radio(["red", "red"]),
          formulaChoices: {},
          answers: { color: "red" },
        },
      ],
    });
    expect(R.unwrap(history).responses[0].fields.get("color")).toBeDefined();
  });

  it("names the response it can't read", () => {
    const history = readSourceHistory({
      schema,
      responses: [
        { id: 1, schemaSnapshot: schema, answers: {}, formulaChoices: {} },
        {
          id: 2,
          schemaSnapshot: schema,
          answers: { home: null },
          formulaChoices: {},
        },
      ],
    });
    expect(R.isFailure(history) && history.error.message).toContain(
      "response 2",
    );
  });

  it("names the response whose saved choices it can't read", () => {
    const history = readSourceHistory({
      schema,
      responses: [
        {
          id: 3,
          schemaSnapshot: schema,
          answers: {},
          formulaChoices: { pick: "a" },
        },
      ],
    });
    expect(R.isFailure(history) && history.error.message).toContain(
      "Can't read response 3",
    );
  });

  it("reads a city answer saved with keys since dropped", () => {
    const history = readSourceHistory({
      schema,
      responses: [
        {
          id: 7,
          schemaSnapshot: schema,
          formulaChoices: {},
          answers: {
            home: { id: 1, name: "Lima", latitude: -12.05, longitude: -77.04 },
          },
        },
      ],
    });
    expect(R.unwrap(history).responses.map(({ id }) => id)).toEqual([7]);
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

  it("reads a formula field's answer with the labels the response saved", () => {
    const withPick = {
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "pick",
              type: "input",
              kind: "select",
              label: "Pick",
              options: [],
              optionsFormula: { inputs: {}, formula: "[]" },
            },
          ],
        },
      ],
      outputViews: [],
    };
    const history = readSourceHistory({
      schema: withPick,
      responses: [
        {
          id: 1,
          schemaSnapshot: withPick,
          answers: { pick: "a" },
          formulaChoices: { pick: [{ label: "Saved A", value: "a" }] },
        },
      ],
    });
    expect(R.unwrap(history).responses[0].fields.get("pick")).toEqual({
      kind: "select",
      options: [{ label: "Saved A", value: "a" }],
    });
  });

  it("reads a list sub-field's formula answers with the labels the response saved", () => {
    const withList = {
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "items",
              type: "input",
              kind: "list",
              label: "Items",
              fields: [
                {
                  id: "pick",
                  type: "input",
                  kind: "select",
                  label: "Pick",
                  options: [],
                  optionsFormula: { inputs: {}, formula: "[]" },
                },
              ],
            },
          ],
        },
      ],
      outputViews: [],
    };
    const history = readSourceHistory({
      schema: withList,
      responses: [
        {
          id: 1,
          schemaSnapshot: withList,
          answers: { items: [{ pick: "a" }] },
          formulaChoices: { pick: [{ label: "Saved A", value: "a" }] },
        },
      ],
    });
    expect(R.unwrap(history).responses[0].fields.get("items")).toMatchObject({
      kind: "list",
      fields: [{ id: "pick", options: [{ label: "Saved A", value: "a" }] }],
    });
  });
});
