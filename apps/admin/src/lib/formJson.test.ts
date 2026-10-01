import type { HeaderBlock } from "@alliance/common/forms/display-blocks";
import type {
  FieldGroup,
  FormSchema,
  ListSubField,
  TextField,
} from "@alliance/common/forms/form-schema";
import { R } from "@alliance/common/result";
import {
  formSchemaIds,
  JsonScopeKind,
  jsonScopeValue,
  prepareJsonApply,
  type JsonScope,
} from "./formJson";

const text = (id: string, extra: Partial<TextField> = {}): TextField => ({
  type: "input",
  kind: "text",
  id,
  label: id,
  ...extra,
});

const header = (id: string): HeaderBlock => ({
  type: "display",
  kind: "header",
  id,
  text: id,
});

const group = (id: string, fields: FieldGroup["fields"]): FieldGroup => ({
  type: "group",
  kind: "group",
  id,
  fields,
});

const schema: FormSchema = {
  pages: [
    {
      id: "page-1",
      fields: [text("a"), group("g", [text("b"), header("h")])],
    },
    { id: "page-2", fields: [text("c")] },
  ],
  outputViews: [],
};

const topLevel = (index: number): JsonScope => ({
  kind: JsonScopeKind.Element,
  pageIndex: 0,
  parentId: null,
  index,
});

const inGroup = (index: number): JsonScope => ({
  kind: JsonScopeKind.Element,
  pageIndex: 0,
  parentId: "g",
  index,
});

const pageScope: JsonScope = { kind: JsonScopeKind.Page, pageIndex: 0 };
const formScope: JsonScope = { kind: JsonScopeKind.Form };

async function prepare(params: {
  scope: JsonScope;
  value: unknown;
  displayOnly?: boolean;
  base?: FormSchema;
  draftValidatorIds?: number[];
  validatorExists?: (id: number) => Promise<boolean>;
}) {
  return prepareJsonApply({
    schema: params.base ?? schema,
    scope: params.scope,
    text:
      typeof params.value === "string"
        ? params.value
        : JSON.stringify(params.value),
    displayOnly: params.displayOnly ?? false,
    draftValidatorIds: new Set(params.draftValidatorIds ?? []),
    validatorExists: params.validatorExists ?? (async () => true),
  });
}

async function applied(params: Parameters<typeof prepare>[0]) {
  return R.unwrap(await prepare(params));
}

async function errors(params: Parameters<typeof prepare>[0]) {
  const result = await prepare(params);
  if (result.ok) throw new Error("expected Apply to be rejected");
  return result.error;
}

describe("jsonScopeValue", () => {
  it("returns the element, the page, or the whole form", () => {
    expect(jsonScopeValue(schema, topLevel(0))).toEqual(text("a"));
    expect(jsonScopeValue(schema, inGroup(1))).toEqual(header("h"));
    expect(jsonScopeValue(schema, pageScope)).toBe(schema.pages[0]);
    expect(jsonScopeValue(schema, formScope)).toBe(schema);
  });
});

const list = (id: string, fields: ListSubField[]) => ({
  type: "input" as const,
  kind: "list" as const,
  id,
  label: null,
  fields,
});

describe("formSchemaIds", () => {
  it("includes nested elements, output views, and aggregate views", () => {
    expect(
      formSchemaIds({
        pages: [
          {
            id: "page-1",
            fields: [
              group("g", [text("b")]),
              list("list", [text("sub")]),
              {
                type: "display",
                kind: "accordion",
                id: "acc",
                sections: [{ id: "s", title: "S", blocks: [header("nested")] }],
              },
            ],
          },
        ],
        outputViews: [{ type: "default", id: "view", blocks: [header("out")] }],
        aggregateViews: [
          {
            kind: "progressbar",
            id: "agg",
            title: "",
            caption: "",
            numerator: { type: "number", value: 1 },
            denominator: { type: "number", value: 2 },
            displayType: "number",
          },
        ],
      }),
    ).toEqual([
      "page-1",
      "g",
      "b",
      "list",
      "sub",
      "acc",
      "s",
      "nested",
      "view",
      "out",
      "agg",
    ]);
  });
});

describe("prepareJsonApply", () => {
  it("replaces an element in place", async () => {
    const result = await applied({
      scope: inGroup(0),
      value: text("b", { label: "New" }),
    });
    expect(result.identityChanges).toEqual([]);
    expect(jsonScopeValue(result.schema, inGroup(0))).toEqual(
      text("b", { label: "New" }),
    );
    expect(result.schema.pages[1]).toBe(schema.pages[1]);
  });

  it("keeps the pasted key order", async () => {
    const text = '{"label":"New","id":"a","kind":"text","type":"input"}';
    const result = await applied({ scope: topLevel(0), value: text });
    expect(JSON.stringify(jsonScopeValue(result.schema, topLevel(0)))).toBe(
      text,
    );
  });

  it("replaces a page and the whole form", async () => {
    const page = { id: "page-1", fields: [text("z")] };
    expect(
      (await applied({ scope: pageScope, value: page })).schema.pages[0],
    ).toEqual(page);
    const form = { ...schema, description: "New" };
    expect((await applied({ scope: formScope, value: form })).schema).toEqual(
      form,
    );
  });

  it("rejects text that is not JSON", async () => {
    const [message] = await errors({ scope: topLevel(0), value: "{nope" });
    expect(message).toMatch(/^Invalid JSON: /);
  });

  it("rejects JSON the schema rejects, naming the path", async () => {
    expect(
      await errors({ scope: topLevel(0), value: { ...text("a"), label: 3 } }),
    ).toEqual(["label: Invalid input: expected string, received number"]);
    expect(
      await errors({
        scope: pageScope,
        value: { id: "page-1", fields: [{ ...text("a"), extra: true }] },
      }),
    ).toEqual(['fields.0: Unrecognized key: "extra"']);
  });

  it("rejects a group nested in a group", async () => {
    expect(
      await errors({ scope: inGroup(0), value: group("b", []) }),
    ).not.toEqual([]);
  });

  it("rejects a form with no pages", async () => {
    expect(
      await errors({ scope: formScope, value: { ...schema, pages: [] } }),
    ).toEqual(["pages: A form needs at least one page"]);
  });

  it("rejects an id that collides with another element or page", async () => {
    expect(await errors({ scope: topLevel(0), value: text("c") })).toEqual([
      'Id "c" is used more than once in the form',
    ]);
    expect(
      await errors({
        scope: pageScope,
        value: { id: "page-2", fields: schema.pages[0].fields },
      }),
    ).toEqual(['Id "page-2" is used more than once in the form']);
  });

  it("rejects an id that collides with an output view block", async () => {
    const base: FormSchema = {
      ...schema,
      outputViews: [{ type: "default", id: "view", blocks: [header("out")] }],
    };
    expect(
      await errors({ base, scope: topLevel(0), value: header("out") }),
    ).toEqual(['Id "out" is used more than once in the form']);
  });

  it("allows a duplicate id the form already had", async () => {
    const withDuplicate: FormSchema = {
      ...schema,
      pages: [{ id: "page-1", fields: [text("a"), text("a")] }],
    };
    await applied({
      base: withDuplicate,
      scope: topLevel(1),
      value: text("a", { label: "Edited" }),
    });
  });

  it("warns about an element's id and kind changing", async () => {
    expect(
      (
        await applied({
          scope: topLevel(0),
          value: { type: "input", kind: "email", id: "a2", label: "a" },
        })
      ).identityChanges,
    ).toEqual([
      'Id changes from "a" to "a2"',
      "Kind changes from text to email",
    ]);
  });

  it("warns about kind changes of elements whose id stays", async () => {
    const page = {
      id: "page-1b",
      fields: [
        { type: "input", kind: "email", id: "a", label: "a" },
        group("g", [text("h")]),
      ],
    };
    expect(
      (await applied({ scope: pageScope, value: page })).identityChanges,
    ).toEqual([
      'Id changes from "page-1" to "page-1b"',
      '"a" changes kind from text to email',
      '"h" changes kind from header to text',
    ]);
    expect(
      (
        await applied({
          scope: formScope,
          value: { ...schema, pages: [page, schema.pages[1]] },
        })
      ).identityChanges,
    ).toEqual([
      '"a" changes kind from text to email',
      '"h" changes kind from header to text',
      'Removed "page-1", "b" and added "page-1b", which may be a rename',
    ]);
  });

  it("warns about a likely rename below the edited level", async () => {
    const renamed = 'Removed "b" and added "b2", which may be a rename';
    expect(
      (
        await applied({
          scope: topLevel(1),
          value: group("g", [text("b2"), header("h")]),
        })
      ).identityChanges,
    ).toEqual([renamed]);
    expect(
      (
        await applied({
          scope: pageScope,
          value: {
            id: "page-1",
            fields: [text("a"), group("g", [text("b2"), header("h")])],
          },
        })
      ).identityChanges,
    ).toEqual([renamed]);
  });

  it("warns about output view renames and block kind changes in form JSON", async () => {
    const base: FormSchema = {
      ...schema,
      outputViews: [{ type: "default", id: "view", blocks: [header("out")] }],
    };
    expect(
      (
        await applied({
          base,
          scope: formScope,
          value: {
            ...schema,
            outputViews: [
              {
                type: "default",
                id: "view2",
                blocks: [
                  { type: "display", kind: "text", id: "out", text: "" },
                ],
              },
            ],
          },
        })
      ).identityChanges,
    ).toEqual([
      '"out" changes kind from header to text',
      'Removed "view" and added "view2", which may be a rename',
    ]);
  });

  it("does not warn about elements only added or only removed", async () => {
    expect(
      (
        await applied({
          scope: pageScope,
          value: {
            id: "page-1",
            fields: [
              text("a"),
              text("new"),
              group("g", [text("b"), header("h")]),
            ],
          },
        })
      ).identityChanges,
    ).toEqual([]);
  });

  it("warns about a list sub-field changing kind", async () => {
    const base: FormSchema = {
      ...schema,
      pages: [{ id: "page-1", fields: [list("l", [text("sub")])] }],
    };
    const changed = list("l", [
      { type: "input", kind: "email", id: "sub", label: "" },
    ]);
    const expected = ['"sub" changes kind from text to email'];
    expect(
      (await applied({ base, scope: topLevel(0), value: changed }))
        .identityChanges,
    ).toEqual(expected);
    expect(
      (
        await applied({
          base,
          scope: pageScope,
          value: { id: "page-1", fields: [changed] },
        })
      ).identityChanges,
    ).toEqual(expected);
  });

  it("does not warn about a removed element", async () => {
    expect(
      (await applied({ scope: pageScope, value: { id: "page-1", fields: [] } }))
        .identityChanges,
    ).toEqual([]);
  });

  describe("custom validators", () => {
    const withValidator = (customValidatorId: number) =>
      text("a", { customValidatorId });

    it("accepts a draft id the editor holds and rejects any other", async () => {
      await applied({
        scope: topLevel(0),
        value: withValidator(-1),
        draftValidatorIds: [-1],
      });
      expect(
        await errors({ scope: topLevel(0), value: withValidator(-2) }),
      ).toEqual([
        "Custom validator -2 is not an unsaved validator in this editor",
      ]);
    });

    it("looks up a saved id new to the form", async () => {
      const looked: number[] = [];
      const validatorExists = async (id: number) => {
        looked.push(id);
        return id === 7;
      };
      await applied({
        scope: topLevel(0),
        value: withValidator(7),
        validatorExists,
      });
      expect(
        await errors({
          scope: topLevel(0),
          value: withValidator(8),
          validatorExists,
        }),
      ).toEqual(["Custom validator 8 could not be loaded"]);
      expect(
        await errors({
          scope: topLevel(0),
          value: withValidator(9),
          validatorExists: async () => {
            throw new Error("offline");
          },
        }),
      ).toEqual(["Could not check custom validator 9: offline"]);
      expect(looked).toEqual([7, 8]);
    });

    it("checks validator ids in visibility conditions", async () => {
      expect(
        await errors({
          scope: topLevel(0),
          value: text("a", {
            visibleIfFormula: {
              conditions: {
                condition1: { kind: "validator", validatorId: 5 },
              },
              formula: "condition1",
            },
          }),
          validatorExists: async () => false,
        }),
      ).toEqual(["Custom validator 5 could not be loaded"]);
    });

    it("skips ids the form already had", async () => {
      const base: FormSchema = {
        ...schema,
        pages: [{ id: "page-1", fields: [withValidator(3)] }],
      };
      await applied({
        base,
        scope: topLevel(0),
        value: withValidator(3),
        validatorExists: async () => false,
      });
    });
  });

  it("keeps display-only forms to one page", async () => {
    const displayOnlyForm: FormSchema = {
      pages: [{ id: "page-1", fields: [header("h")] }],
      outputViews: [],
    };
    expect(
      await errors({
        base: displayOnlyForm,
        displayOnly: true,
        scope: formScope,
        value: {
          ...displayOnlyForm,
          pages: [...displayOnlyForm.pages, { id: "page-2", fields: [] }],
        },
      }),
    ).toEqual(["pages: Display-only content has exactly one page"]);
  });

  it("holds display-only forms to the display-only schema", async () => {
    const displayOnlyForm: FormSchema = {
      pages: [{ id: "page-1", fields: [header("h")] }],
      outputViews: [],
    };
    await applied({
      base: displayOnlyForm,
      displayOnly: true,
      scope: topLevel(0),
      value: header("h2"),
    });
    expect(
      await errors({
        base: displayOnlyForm,
        displayOnly: true,
        scope: topLevel(0),
        value: text("a"),
      }),
    ).not.toEqual([]);
  });
});
