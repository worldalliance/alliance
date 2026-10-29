import { formSchema } from "@alliance/common/forms/form-schema";
import { describe, expect, it } from "bun:test";
import { formTextPlaces, formTexts } from "./actionReadiness";

describe("formTexts", () => {
  it("collects the form, page, field, option, and display text in order", () => {
    const schema = formSchema.parse({
      description: "Form intro",
      outputViews: [],
      pages: [
        {
          id: "p1",
          title: "Page title",
          description: "Page intro",
          fields: [
            {
              id: "town",
              type: "input",
              kind: "radio",
              label: "Your town",
              description: "Pick one",
              options: [
                { value: "a", label: "Ames" },
                { value: "b", label: "Boone" },
              ],
            },
            { id: "intro", type: "display", kind: "text", text: "Welcome" },
            { type: "display", kind: "text", text: "Thanks" },
          ],
        },
      ],
    });

    expect(formTextPlaces(schema).map(({ text, id }) => [text, id])).toEqual([
      ["Form intro", null],
      ["Page title", "p1"],
      ["Page intro", "p1"],
      ["Your town", "town"],
      ["Pick one", "town"],
      ["Ames", "town"],
      ["Boone", "town"],
      ["Welcome", "intro"],
      ["Thanks", "p1"],
    ]);
    expect(formTexts(schema)).toEqual([
      "Form intro",
      "Page title",
      "Page intro",
      "Your town",
      "Pick one",
      "Ames",
      "Boone",
      "Welcome",
      "Thanks",
    ]);
  });

  it("gives text the id the builder resolves to its own page or element", () => {
    const question = (id: string, label: string) => ({
      id,
      type: "input",
      kind: "text",
      label,
    });
    const schema = formSchema.parse({
      outputViews: [],
      pages: [
        {
          id: "p1",
          fields: [question("twin", "First"), question("p2", "Odd")],
        },
        { id: "p2", title: "Second page", fields: [question("twin", "Last")] },
        { id: "p3", fields: [question("solo", "Only")] },
      ],
    });

    expect(formTextPlaces(schema).map(({ text, id }) => [text, id])).toEqual([
      ["First", "p1"],
      ["Odd", "p2"],
      ["Second page", null],
      ["Last", "twin"],
      ["Only", "solo"],
    ]);
  });

  it("skips an id the builder resolves to a list sub-field or accordion part", () => {
    const schema = formSchema.parse({
      outputViews: [],
      pages: [
        { id: "p1", title: "Typo titel", fields: [] },
        {
          id: "p2",
          fields: [
            {
              id: "list",
              type: "input",
              kind: "list",
              label: "L",
              fields: [{ id: "p1", type: "input", kind: "text", label: "Sub" }],
            },
            {
              id: "acc",
              type: "display",
              kind: "accordion",
              sections: [
                {
                  id: "s1",
                  title: "S",
                  blocks: [
                    { id: "x", type: "display", kind: "text", text: "" },
                  ],
                },
              ],
            },
            { id: "x", type: "display", kind: "text", text: "Typo txet" },
          ],
        },
      ],
    });

    expect(formTextPlaces(schema).map(({ text, id }) => [text, id])).toEqual([
      ["Typo titel", null],
      ["L", "list"],
      ["Typo txet", "p2"],
    ]);
  });
});
