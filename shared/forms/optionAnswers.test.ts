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
      ],
    },
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

  it("leaves other answers alone", () => {
    expect(drop({ name: "Ada", other: "x" })).toEqual({
      name: "Ada",
      other: "x",
    });
  });
});
