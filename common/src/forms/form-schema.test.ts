import { anyFieldSchema, pageSchema } from "./form-schema";

const optionField = (
  kind: "radio" | "select" | "multiselect" | "ranking",
  values: string[],
) => ({
  id: "field",
  type: "input",
  kind,
  label: "Field",
  options: values.map((value) => ({ label: value.toUpperCase(), value })),
});

describe("option value uniqueness", () => {
  const kinds = ["radio", "select", "multiselect", "ranking"] as const;

  it.each(kinds)("accepts distinct option values for %s", (kind) => {
    expect(
      anyFieldSchema.safeParse(optionField(kind, ["a", "b"])).success,
    ).toBe(true);
  });

  it.each(kinds)("rejects duplicate option values for %s", (kind) => {
    expect(
      anyFieldSchema.safeParse(optionField(kind, ["a", "b", "a"])).success,
    ).toBe(false);
  });
});

describe("page elements", () => {
  it("rejects a group", () => {
    const group = {
      id: "g1",
      type: "group",
      kind: "group",
      fields: [{ id: "a", type: "input", kind: "text", label: "A" }],
    };
    expect(pageSchema.safeParse({ id: "p1", fields: [group] }).success).toBe(
      false,
    );
  });

  it.each([
    [7, true],
    [0, false],
    [1.5, false],
    ["7", false],
  ])("big link externalTargetId %p is valid: %p", (externalTargetId, valid) => {
    const link = {
      type: "display",
      kind: "biglink",
      text: "Take the survey",
      url: "https://example.com/survey",
      externalTargetId,
    };
    expect(pageSchema.safeParse({ id: "p1", fields: [link] }).success).toBe(
      valid,
    );
  });
});

describe("searchable dropdowns", () => {
  it.each([true, false, undefined])("accepts searchable=%s", (searchable) => {
    expect(
      anyFieldSchema.safeParse({ ...optionField("select", ["a"]), searchable })
        .success,
    ).toBe(true);
  });

  it.each(["yes", 1, null])("rejects invalid searchable=%s", (searchable) => {
    expect(
      anyFieldSchema.safeParse({ ...optionField("select", ["a"]), searchable })
        .success,
    ).toBe(false);
  });
});

describe("multiselect display", () => {
  it.each([
    {},
    { dropdown: false, searchable: false },
    { dropdown: true },
    { dropdown: true, searchable: false },
    { dropdown: true, searchable: true },
  ])("accepts %o", (flags) => {
    expect(
      anyFieldSchema.safeParse({
        ...optionField("multiselect", ["a"]),
        ...flags,
      }).success,
    ).toBe(true);
  });

  it.each([{ searchable: true }, { dropdown: false, searchable: true }])(
    "rejects search without dropdown: %o",
    (flags) => {
      expect(
        anyFieldSchema.safeParse({
          ...optionField("multiselect", ["a"]),
          ...flags,
        }).success,
      ).toBe(false);
    },
  );
});

describe("option categories", () => {
  const categorized = (
    kind: "select" | "multiselect",
    overrides: Record<string, unknown> = {},
  ) =>
    anyFieldSchema.safeParse({
      ...optionField(kind, []),
      categories: [
        { id: "fruit", name: "Fruit" },
        { id: "veg", name: "Vegetables" },
        { id: "empty", name: "Empty" },
      ],
      options: [
        { label: "Apple", value: "apple", category: "fruit" },
        { label: "Other", value: "other" },
        { label: "Kale", value: "kale", category: "veg" },
      ],
      ...overrides,
    });

  const kinds = ["select", "multiselect"] as const;

  it.each(kinds)(
    "accepts mixed categorized options and empty categories for %s",
    (kind) => {
      expect(categorized(kind).success).toBe(true);
    },
  );

  it.each([
    ["a blank name", [{ id: "a", name: "  " }]],
    [
      "names differing only by case and spaces",
      [
        { id: "a", name: "Fruit" },
        { id: "b", name: " fruit " },
      ],
    ],
    [
      "duplicate ids",
      [
        { id: "a", name: "Fruit" },
        { id: "a", name: "Vegetables" },
      ],
    ],
    ["an empty id", [{ id: "", name: "Fruit" }]],
  ])("rejects %s", (_, categories) => {
    for (const kind of kinds) {
      expect(categorized(kind, { categories, options: [] }).success).toBe(
        false,
      );
    }
  });

  it.each(kinds)("rejects a reference to a missing category for %s", (kind) => {
    expect(
      categorized(kind, {
        options: [{ label: "Apple", value: "apple", category: "missing" }],
      }).success,
    ).toBe(false);
  });

  it.each(kinds)(
    "rejects duplicate option values across categories for %s",
    (kind) => {
      expect(
        categorized(kind, {
          options: [
            { label: "Apple", value: "a", category: "fruit" },
            { label: "Artichoke", value: "a", category: "veg" },
          ],
        }).success,
      ).toBe(false);
    },
  );

  it.each(["radio", "ranking"] as const)("rejects categories on %s", (kind) => {
    expect(
      anyFieldSchema.safeParse({
        ...optionField(kind, ["a"]),
        categories: [{ id: "c", name: "C" }],
      }).success,
    ).toBe(false);
    expect(
      anyFieldSchema.safeParse({
        ...optionField(kind, []),
        options: [{ label: "A", value: "a", category: "c" }],
      }).success,
    ).toBe(false);
  });
});
