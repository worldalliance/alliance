import type { AnyField } from "@alliance/common/forms/form-schema";
import { dropUnknownOptionAnswers } from "./optionAnswers";

const options = [
  { label: "New York", value: "ny" },
  { label: "California", value: "ca" },
];

const fields = new Map<string, AnyField>([
  [
    "places",
    { id: "places", type: "input", kind: "multiselect", label: "P", options },
  ],
  ["name", { id: "name", type: "input", kind: "text", label: "Name" }],
  [
    "trips",
    {
      id: "trips",
      type: "input",
      kind: "list",
      label: "Trips",
      fields: [
        {
          id: "stops",
          type: "input",
          kind: "multiselect",
          label: "S",
          options,
        },
        { id: "note", type: "input", kind: "text", label: "Note" },
        {
          id: "mood",
          type: "input",
          kind: "range",
          label: "Mood",
          optionCount: 5,
        },
      ],
    },
  ],
  [
    "scale",
    { id: "scale", type: "input", kind: "range", label: "S", optionCount: 5 },
  ],
]);

const drop = (answers: Parameters<typeof dropUnknownOptionAnswers>[0]) =>
  dropUnknownOptionAnswers(answers, fields);

describe("dropUnknownOptionAnswers", () => {
  it("keeps selections that match an option, in their order", () => {
    expect(drop({ places: ["ca", "ny"] })).toEqual({ places: ["ca", "ny"] });
  });

  it("drops selections of options the field no longer has", () => {
    expect(drop({ places: ["gone", "ny"] })).toEqual({ places: ["ny"] });
  });

  it("keeps an emptied answer as no selections", () => {
    expect(drop({ places: ["gone"] })).toEqual({ places: [] });
  });

  it("keeps a cleared answer", () => {
    expect(drop({ places: [] })).toEqual({ places: [] });
  });

  it("drops unknown selections inside list cards", () => {
    expect(
      drop({
        trips: [
          { stops: ["gone", "ca"], note: "a" },
          { stops: ["gone"], note: "b" },
        ],
      }),
    ).toEqual({
      trips: [
        { stops: ["ca"], note: "a" },
        { stops: [], note: "b" },
      ],
    });
  });

  it("keeps a range answer that matches an option", () => {
    expect(drop({ scale: 3 })).toEqual({ scale: 3 });
  });

  it("clears a range answer outside the options", () => {
    expect(drop({ scale: 8 })).toEqual({ scale: "" });
    expect(drop({ scale: 2.5 })).toEqual({ scale: "" });
  });

  it("keeps a cleared range answer", () => {
    expect(drop({ scale: "" })).toEqual({ scale: "" });
  });

  it("clears a range answer outside the options inside list cards", () => {
    expect(drop({ trips: [{ mood: 8 }, { mood: 2 }] })).toEqual({
      trips: [{ mood: "" }, { mood: 2 }],
    });
  });

  it("leaves other answers alone", () => {
    expect(drop({ name: "Ada", other: "x" })).toEqual({
      name: "Ada",
      other: "x",
    });
  });

  it("leaves a formula's selections for the renderer to check once it resolves", () => {
    const formula: AnyField = {
      id: "picked",
      type: "input",
      kind: "multiselect",
      label: "Picked",
      options: [],
      optionsFormula: { inputs: {}, formula: "[]" },
    };
    expect(
      dropUnknownOptionAnswers(
        { picked: ["later"] },
        new Map([["picked", formula]]),
      ),
    ).toEqual({ picked: ["later"] });
  });
});
