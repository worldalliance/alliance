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
        { id: 1, schemaSnapshot: schema, answers: {} },
        { id: 2, schemaSnapshot: schema, answers: { home: null } },
      ],
    });
    expect(R.isFailure(history) && history.error.message).toContain(
      "response 2",
    );
  });

  it("reads a city answer saved with keys since dropped", () => {
    const history = readSourceHistory({
      schema,
      responses: [
        {
          id: 7,
          schemaSnapshot: schema,
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
});
