import type { DisplayBlock } from "./display-blocks";
import {
  ADDABLE_FIELD_KINDS,
  elementInternalDescriptor,
  FIELD_KIND_NAMES,
  fieldPickerLabel,
  outputBlockInternalDescriptor,
} from "./element-descriptors";
import type { AnyField, NumberField, OutputFieldBlock } from "./form-schema";

const numberField = (label: string | null): NumberField => ({
  id: "field-1",
  type: "input",
  kind: "number",
  label,
});

const textBlock = (text: string): DisplayBlock => ({
  type: "display",
  kind: "text",
  text,
});

const outputFieldBlock = (
  labelOverride?: string,
): OutputFieldBlock & { id: string } => ({
  id: "block-1",
  fieldId: "field-1",
  labelOverride,
});

const lookup = (...fields: AnyField[]): Map<string, AnyField> =>
  new Map(fields.map((field) => [field.id, field]));

describe("ADDABLE_FIELD_KINDS", () => {
  it("offers every field kind except the superseded `text`", () => {
    expect(ADDABLE_FIELD_KINDS).toEqual(
      Object.keys(FIELD_KIND_NAMES).filter((kind) => kind !== "text"),
    );
  });
});

describe("elementInternalDescriptor", () => {
  it("names a field by its label", () => {
    expect(elementInternalDescriptor(numberField("How many?"))).toBe(
      "How many?",
    );
  });

  it("falls back to the id when the label is blank or null", () => {
    expect(elementInternalDescriptor(numberField(""))).toBe("field-1");
    expect(elementInternalDescriptor(numberField("   "))).toBe("field-1");
    expect(elementInternalDescriptor(numberField(null))).toBe("field-1");
  });

  it("trims a padded label", () => {
    expect(elementInternalDescriptor(numberField(" Age "))).toBe("Age");
  });

  it("names a display block by its kind, previewing its content", () => {
    expect(elementInternalDescriptor(textBlock("Welcome"))).toBe(
      "Text Block: Welcome",
    );
  });

  it("is just the kind name when a block has no content to preview", () => {
    expect(
      elementInternalDescriptor({ type: "display", kind: "divider" }),
    ).toBe("Divider Block");
  });

  it("keeps a long label whole by default", () => {
    expect(elementInternalDescriptor(numberField("a".repeat(50)))).toBe(
      "a".repeat(50),
    );
    expect(elementInternalDescriptor(textBlock("a".repeat(50)))).toBe(
      `Text Block: ${"a".repeat(50)}`,
    );
  });

  describe("maxTextLength", () => {
    it("clips a long label to the limit, ellipsis included", () => {
      expect(
        elementInternalDescriptor(numberField("a".repeat(50)), {
          maxTextLength: 40,
        }),
      ).toBe(`${"a".repeat(39)}…`);
    });

    it("clips a long block preview, keeping the type name whole", () => {
      expect(
        elementInternalDescriptor(textBlock("a".repeat(50)), {
          maxTextLength: 10,
        }),
      ).toBe(`Text Block: ${"a".repeat(9)}…`);
    });

    it("leaves text at the limit alone", () => {
      expect(
        elementInternalDescriptor(numberField("a".repeat(40)), {
          maxTextLength: 40,
        }),
      ).toBe("a".repeat(40));
    });

    it("never clips the id fallback", () => {
      expect(
        elementInternalDescriptor(numberField(null), { maxTextLength: 3 }),
      ).toBe("field-1");
    });

    it("composes with typeQualified", () => {
      expect(
        elementInternalDescriptor(numberField("a".repeat(50)), {
          typeQualified: true,
          maxTextLength: 10,
        }),
      ).toBe(`Number Field: ${"a".repeat(9)}…`);
    });
  });

  describe("typeQualified", () => {
    it("prefixes a field with its type name", () => {
      expect(
        elementInternalDescriptor(numberField("Age"), { typeQualified: true }),
      ).toBe("Number Field: Age");
    });

    it("is just the type name for an unlabelled field", () => {
      expect(
        elementInternalDescriptor(numberField(null), { typeQualified: true }),
      ).toBe("Number Field");
    });

    it("leaves a display block unchanged — its type name is its name", () => {
      expect(
        elementInternalDescriptor(textBlock("Welcome"), {
          typeQualified: true,
        }),
      ).toBe(elementInternalDescriptor(textBlock("Welcome")));
    });
  });
});

describe("fieldPickerLabel", () => {
  it("names the field, its kind and its id", () => {
    expect(fieldPickerLabel(numberField("Age"))).toBe("Age (number) — field-1");
  });

  it("does not repeat the id for an unlabelled field", () => {
    expect(fieldPickerLabel(numberField(""))).toBe("field-1 (number)");
    expect(fieldPickerLabel(numberField(null))).toBe("field-1 (number)");
  });

  it("still shows the id when the label happens to match it", () => {
    expect(fieldPickerLabel(numberField("field-1"))).toBe(
      "field-1 (number) — field-1",
    );
  });
});

describe("outputBlockInternalDescriptor", () => {
  it("describes a display block", () => {
    expect(
      outputBlockInternalDescriptor({
        block: textBlock("Thanks!"),
        fieldLookup: lookup(),
      }),
    ).toBe("Text Block: Thanks!");
  });

  it("prefers a field block's label override", () => {
    expect(
      outputBlockInternalDescriptor({
        block: outputFieldBlock("Your answer"),
        fieldLookup: lookup(numberField("Age")),
      }),
    ).toBe("Your answer");
  });

  it("treats a blank override as absent and falls back to the field", () => {
    expect(
      outputBlockInternalDescriptor({
        block: outputFieldBlock("   "),
        fieldLookup: lookup(numberField("Age")),
      }),
    ).toBe("Age");
  });

  it("falls back to the field id when the field is gone", () => {
    expect(
      outputBlockInternalDescriptor({
        block: outputFieldBlock(),
        fieldLookup: lookup(),
      }),
    ).toBe("field-1");
  });

  describe("maxTextLength", () => {
    it("clips a long override", () => {
      expect(
        outputBlockInternalDescriptor({
          block: outputFieldBlock("a".repeat(50)),
          fieldLookup: lookup(),
          maxTextLength: 30,
        }),
      ).toBe(`${"a".repeat(29)}…`);
    });

    it("clips the label of the block's field", () => {
      expect(
        outputBlockInternalDescriptor({
          block: outputFieldBlock(),
          fieldLookup: lookup(numberField("a".repeat(50))),
          maxTextLength: 30,
        }),
      ).toBe(`${"a".repeat(29)}…`);
    });

    it("clips a display block's preview", () => {
      expect(
        outputBlockInternalDescriptor({
          block: textBlock("a".repeat(50)),
          fieldLookup: lookup(),
          maxTextLength: 30,
        }),
      ).toBe(`Text Block: ${"a".repeat(29)}…`);
    });

    it("never clips the field id fallback", () => {
      expect(
        outputBlockInternalDescriptor({
          block: outputFieldBlock(),
          fieldLookup: lookup(),
          maxTextLength: 3,
        }),
      ).toBe("field-1");
    });
  });

  it("keeps a long override whole by default", () => {
    expect(
      outputBlockInternalDescriptor({
        block: outputFieldBlock("a".repeat(50)),
        fieldLookup: lookup(),
      }),
    ).toBe("a".repeat(50));
  });
});
