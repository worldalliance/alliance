import { R } from "../result";
import {
  displayOnlySchema,
  displayOnlySchemaError,
  displayOnlyToFormSchema,
  formSchemaToDisplayOnly,
  readDisplayOnlySchema,
  readDisplayOnlySchemaError,
  type DisplayOnlySchema,
} from "./display-only-schema";
import type { FormSchema } from "./form-schema";

const header = { type: "display", kind: "header", id: "b1", text: "Hi" };

const schemaWith = (...blocks: unknown[]) => ({
  blocks,
});

describe("displayOnlySchema", () => {
  it("accepts a page of static blocks", () => {
    const result = displayOnlySchema.safeParse(
      schemaWith(header, { type: "display", kind: "divider", id: "b2" }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects question fields", () => {
    const result = displayOnlySchema.safeParse(
      schemaWith({
        type: "input",
        kind: "text",
        id: "f1",
        label: "Your name",
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects conditional visibility", () => {
    const result = displayOnlySchema.safeParse(
      schemaWith({
        ...header,
        visibleIfFormula: {
          conditions: { a: { kind: "equals", when: "f1", equals: "yes" } },
          formula: "a",
        },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects per-user content", () => {
    const result = displayOnlySchema.safeParse(
      schemaWith({
        ...header,
        manualPerUser: true,
        manualUserContent: { "1": { text: "Hi you" } },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects per-user display blocks", () => {
    for (const block of [
      { type: "display", kind: "userLocation", id: "b1" },
      {
        type: "display",
        kind: "previousAnswer",
        id: "b1",
        sourceFormId: 1,
        sourceFieldId: "f1",
      },
    ]) {
      expect(displayOnlySchema.safeParse(schemaWith(block)).success).toBe(
        false,
      );
    }
  });

  it("rejects pages", () => {
    const result = displayOnlySchema.safeParse({
      pages: [{ id: "page-1", fields: [] }],
      blocks: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("readDisplayOnlySchema", () => {
  it("returns the parsed schema when this build understands all of it", () => {
    const stored = schemaWith(header);
    expect(readDisplayOnlySchema(stored)).toEqual(stored as DisplayOnlySchema);
  });

  it("rejects a block kind this build can't render", () => {
    const stored = schemaWith(header, {
      type: "display",
      kind: "carousel",
      id: "b2",
    });
    expect(readDisplayOnlySchema(stored)).toBeNull();
  });

  it("rejects kinds excluded from display-only schemas", () => {
    const stored = schemaWith({ type: "display", kind: "userLocation" });
    expect(readDisplayOnlySchema(stored)).toBeNull();
  });

  it("rejects properties a newer build added", () => {
    const stored = schemaWith({ ...header, somethingNew: true });
    expect(readDisplayOnlySchema(stored)).toBeNull();
  });

  it("rejects a known kind whose content is the wrong type", () => {
    const stored = schemaWith({ ...header, text: 42 });
    expect(readDisplayOnlySchema(stored)).toBeNull();
  });

  it("rejects a value that isn't a display-only schema", () => {
    expect(readDisplayOnlySchema({ pages: [] })).toBeNull();
    expect(readDisplayOnlySchema(null)).toBeNull();
  });
});

describe("schema rejection body", () => {
  const rejection = () => {
    const parsed = displayOnlySchema.safeParse(
      schemaWith({ type: "input", kind: "text", id: "f1", label: "Name" }),
    );
    if (parsed.success) throw new Error("expected a parse failure");
    return displayOnlySchemaError(parsed.error);
  };

  it("round-trips the per-issue detail through a response body", () => {
    const body = rejection();
    expect(body.errors.length).toBeGreaterThan(0);
    expect(readDisplayOnlySchemaError(body)).toEqual(body.errors);
  });

  it("survives the fields nest adds to a thrown body", () => {
    expect(
      readDisplayOnlySchemaError({ ...rejection(), statusCode: 400 }),
    ).toEqual(rejection().errors);
  });

  it("ignores errors that aren't a schema rejection", () => {
    expect(readDisplayOnlySchemaError({ message: "Nope" })).toBeNull();
    expect(
      readDisplayOnlySchemaError({ message: "Nope", errors: ["a"] }),
    ).toBeNull();
    expect(readDisplayOnlySchemaError(undefined)).toBeNull();
  });
});

describe("form schema conversion", () => {
  const schema: DisplayOnlySchema = {
    blocks: [
      { type: "display", kind: "header", id: "b1", text: "Hi" },
      { type: "display", kind: "divider", id: "b2" },
    ],
  };

  it("round-trips through the form builder's shape", () => {
    const asForm = displayOnlyToFormSchema(schema, "Update");
    expect(asForm.title).toBe("Update");
    expect(asForm.pages).toHaveLength(1);
    expect(asForm.outputViews).toEqual([]);
    expect(R.unwrap(formSchemaToDisplayOnly(asForm))).toEqual(schema);
  });

  it("rejects a form that picked up a question field", () => {
    const asForm = displayOnlyToFormSchema(schema, "Update");
    const edited: FormSchema = {
      ...asForm,
      pages: [
        {
          ...asForm.pages[0],
          fields: [
            ...asForm.pages[0].fields,
            { type: "input", kind: "text", id: "f1", label: "Name" },
          ],
        },
      ],
    };
    expect(R.isFailure(formSchemaToDisplayOnly(edited))).toBe(true);
  });

  it("rejects a form that picked up conditional visibility", () => {
    const edited: FormSchema = {
      ...displayOnlyToFormSchema(schema, "Update"),
      pages: [
        {
          id: "page-1",
          fields: [
            {
              type: "display",
              kind: "header",
              id: "b1",
              text: "Hi",
              visibleIfFormula: {
                conditions: {
                  a: { kind: "equals", when: "f1", equals: "yes" },
                },
                formula: "a",
              },
            },
          ],
        },
      ],
    };
    expect(R.isFailure(formSchemaToDisplayOnly(edited))).toBe(true);
  });

  it("keeps blocks from a second page rather than dropping them", () => {
    const asForm = displayOnlyToFormSchema(schema, "Update");
    const edited: FormSchema = {
      ...asForm,
      pages: [
        asForm.pages[0],
        {
          id: "page-2",
          fields: [{ type: "display", kind: "label", id: "b3", text: "More" }],
        },
      ],
    };
    expect(R.unwrap(formSchemaToDisplayOnly(edited)).blocks).toHaveLength(3);
  });

  it("accepts the empty view arrays the builder always adds", () => {
    const edited: FormSchema = {
      ...displayOnlyToFormSchema(schema, "Update"),
      outputViews: [],
      aggregateViews: [],
    };
    expect(R.unwrap(formSchemaToDisplayOnly(edited))).toEqual(schema);
  });

  it("rejects page metadata rather than dropping it", () => {
    const asForm = displayOnlyToFormSchema(schema, "Update");
    for (const extra of [
      { title: "Page 1" },
      { description: "About this page" },
      {
        visibleIfFormula: {
          conditions: {
            a: { kind: "equals" as const, when: "f1", equals: "yes" },
          },
          formula: "a",
        },
      },
    ]) {
      const edited: FormSchema = {
        ...asForm,
        pages: [{ ...asForm.pages[0], ...extra }],
      };
      expect(R.isFailure(formSchemaToDisplayOnly(edited))).toBe(true);
    }
  });

  it("rejects views that a display-only schema cannot carry", () => {
    const asForm = displayOnlyToFormSchema(schema, "Update");
    const withOutputView: FormSchema = {
      ...asForm,
      outputViews: [{ type: "default", id: "v1", blocks: [] }],
    };
    expect(R.isFailure(formSchemaToDisplayOnly(withOutputView))).toBe(true);

    const withAggregateView: FormSchema = {
      ...asForm,
      aggregateViews: [
        {
          kind: "progressbar",
          id: "a1",
          title: "Agg",
          caption: "",
          numerator: { type: "number", value: 1 },
          denominator: { type: "number", value: 2 },
          displayType: "number",
        },
      ],
    };
    expect(R.isFailure(formSchemaToDisplayOnly(withAggregateView))).toBe(true);
  });
});
