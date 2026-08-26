import { storedQuestionFields } from "./stored-schema";

const textField = (id: string, label: string) => ({
  id,
  type: "input",
  kind: "text",
  label,
});

// What a display-block rename leaves behind on rows written before it: an
// element the current strict schema has no case for.
const staleBlock = {
  id: "legacy",
  type: "display",
  kind: "image",
  url: "old.png",
};

const schema = {
  pages: [
    { id: "one", fields: [staleBlock, textField("a", "First")] },
    { id: "two", fields: [textField("b", "Second")] },
  ],
  outputViews: [],
};

describe("storedQuestionFields", () => {
  it("keeps the questions around an element it cannot read", () => {
    const fields = storedQuestionFields(schema);

    expect(fields.ok && fields.value.map((field) => field.label)).toEqual([
      "First",
      "Second",
    ]);
  });

  it("leaves out display blocks it can read", () => {
    const fields = storedQuestionFields({
      pages: [
        {
          id: "one",
          fields: [
            { id: "note", type: "display", kind: "label", text: "Hi" },
            textField("a", "First"),
          ],
        },
      ],
      outputViews: [],
    });

    expect(fields.ok && fields.value.map((field) => field.id)).toEqual(["a"]);
  });

  it("tolerates a page with no fields key", () => {
    const fields = storedQuestionFields({ pages: [{ id: "empty" }] });

    expect(fields.ok && fields.value).toEqual([]);
  });

  it("fails on a snapshot with no readable pages", () => {
    expect(storedQuestionFields({ pages: "not an array" }).ok).toBe(false);
    expect(storedQuestionFields(null).ok).toBe(false);
  });
});
