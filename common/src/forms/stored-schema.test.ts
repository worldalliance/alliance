import { R } from "../result";
import { storedQuestionFields, submittedQuestionFields } from "./stored-schema";

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

  it("keeps the rest of a group around a question it cannot read", () => {
    const fields = storedQuestionFields({
      pages: [
        {
          id: "one",
          fields: [
            {
              id: "g",
              type: "group",
              kind: "group",
              fields: [staleBlock, textField("a", "First")],
            },
          ],
        },
      ],
    });

    expect(fields.ok && fields.value.map((field) => field.label)).toEqual([
      "First",
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

describe("submittedQuestionFields", () => {
  const colorField = (kind: string, values: string[]) => ({
    id: "color",
    type: "input",
    kind,
    label: "Color",
    options: values.map((value) => ({ label: value.toUpperCase(), value })),
  });
  const snapshotOf = (...fields: unknown[]) => ({
    pages: [{ id: "one", fields }],
    outputViews: [],
  });
  const current = R.unwrap(
    storedQuestionFields(
      snapshotOf(colorField("radio", ["red", "blue"]), textField("a", "Now")),
    ),
  );
  const labels = (snapshot: unknown) =>
    R.unwrap(submittedQuestionFields({ snapshot, current })).map((field) => [
      field.id,
      field.label,
    ]);

  it("reads a question that no longer parses with its current definition", () => {
    expect(
      labels(
        snapshotOf(colorField("radio", ["red", "red"]), textField("a", "Then")),
      ),
    ).toEqual([
      ["a", "Then"],
      ["color", "Color"],
    ]);
  });

  it("reads the questions of a group that no longer parses", () => {
    expect(
      labels(
        snapshotOf({
          id: "g",
          type: "group",
          kind: "group",
          fields: [colorField("radio", ["red", "red"]), textField("a", "Then")],
        }),
      ),
    ).toEqual([
      ["a", "Then"],
      ["color", "Color"],
    ]);
  });

  it("leaves out a question the version doesn't hold", () => {
    expect(labels(snapshotOf(textField("a", "Then")))).toEqual([["a", "Then"]]);
  });

  it("fails on a question that no longer parses and had another kind", () => {
    expect(
      submittedQuestionFields({
        snapshot: snapshotOf(colorField("select", ["red", "red"])),
        current,
      }).ok,
    ).toBe(false);
  });

  describe("a list that no longer parses", () => {
    const listField = (nKind: string, values: string[]) => ({
      id: "trips",
      type: "input",
      kind: "list",
      label: "Trips",
      fields: [
        { ...colorField("radio", values), id: "mode" },
        { ...textField("n", "N"), kind: nKind },
      ],
    });
    const currentLists = R.unwrap(
      storedQuestionFields(snapshotOf(listField("number", ["car", "bus"]))),
    );
    const read = (nKind: string) =>
      submittedQuestionFields({
        snapshot: snapshotOf(listField(nKind, ["car", "car"])),
        current: currentLists,
      });

    it("is read with its current definition while its sub-fields keep their kinds", () => {
      expect(R.unwrap(read("number")).map((field) => field.id)).toEqual([
        "trips",
      ]);
    });

    it("fails when one of its sub-fields had another kind", () => {
      const result = read("text");
      expect(!result.ok && result.error.message).toBe(
        `Question "trips" can't be read in an earlier version of the form, where its sub-field "n" was text`,
      );
    });
  });
});
