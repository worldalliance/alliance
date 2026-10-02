import type { AccordionBlock, ImagesBlock, LabelBlock } from "./display-blocks";
import type {
  FormSchema,
  ListField,
  OutputBlock,
  OutputFieldBlock,
  Page,
  PageItem,
  RangeField,
  TextField,
} from "./form-schema";
import { validateFormSchema } from "./form-schema-validate";
import type { Condition, VisibleIfFormula } from "./visible-if-formula";

const formula = (conditions: Record<string, Condition>): VisibleIfFormula => ({
  conditions,
  formula: Object.keys(conditions)[0] ?? "",
});

const textField = (
  id: string,
  overrides: Partial<TextField> = {},
): TextField => ({
  id,
  type: "input",
  kind: "text",
  label: id,
  ...overrides,
});

const labelBlock = (
  id: string,
  overrides: Partial<LabelBlock> = {},
): LabelBlock => ({
  id,
  type: "display",
  kind: "label",
  text: id,
  ...overrides,
});

const imagesBlock = (
  id: string,
  images: ImagesBlock["images"],
): ImagesBlock => ({ id, type: "display", kind: "images", images });

const accordionBlock = (
  id: string,
  sections: AccordionBlock["sections"],
): AccordionBlock => ({ id, type: "display", kind: "accordion", sections });

const fieldBlock = (
  id: string,
  fieldId: string,
  overrides: Partial<OutputFieldBlock> = {},
): OutputFieldBlock => ({ id, fieldId, ...overrides });

const page = (id: string, fields: PageItem[]): Page => ({
  id,
  fields,
});

const baseSchema = (overrides: Partial<FormSchema> = {}): FormSchema => ({
  pages: [],
  outputViews: [],
  ...overrides,
});

const view = (
  id: string,
  blocks: OutputBlock[],
  overrides: Partial<FormSchema["outputViews"][number]> = {},
): FormSchema["outputViews"][number] => ({
  id,
  type: "default",
  blocks,
  ...overrides,
});

describe("validateFormSchema", () => {
  it("returns no errors for an empty schema", () => {
    expect(validateFormSchema(baseSchema())).toEqual([]);
  });

  it("returns no errors for a valid outputBlockVisible reference", () => {
    const schema = baseSchema({
      pages: [page("p1", [textField("f1")])],
      outputViews: [
        view("v1", [
          fieldBlock("blk-field", "f1"),
          labelBlock("blk-label", {
            visibleIfFormula: formula({
              c1: {
                kind: "outputBlockVisible",
                outputBlockVisible: "blk-field",
                isVisible: true,
              },
            }),
          }),
        ]),
      ],
    });
    expect(validateFormSchema(schema)).toEqual([]);
  });

  it("flags a missing output block reference", () => {
    const schema = baseSchema({
      outputViews: [
        view("v1", [
          labelBlock("blk-label", {
            visibleIfFormula: formula({
              c1: {
                kind: "outputBlockVisible",
                outputBlockVisible: "does-not-exist",
              },
            }),
          }),
        ]),
      ],
    });
    expect(validateFormSchema(schema)).toEqual([
      {
        viewId: "v1",
        blockId: "blk-label",
        message: 'References missing output block "does-not-exist"',
      },
    ]);
  });

  it("allows a display block to reference another display block by id", () => {
    const schema = baseSchema({
      outputViews: [
        view("v1", [
          labelBlock("other-label"),
          labelBlock("blk", {
            visibleIfFormula: formula({
              c1: {
                kind: "outputBlockVisible",
                outputBlockVisible: "other-label",
              },
            }),
          }),
        ]),
      ],
    });
    expect(validateFormSchema(schema)).toEqual([]);
  });

  it("allows a field block to reference a display block by id", () => {
    const schema = baseSchema({
      pages: [page("p1", [textField("f1")])],
      outputViews: [
        view("v1", [
          labelBlock("disp"),
          fieldBlock("blk-field", "f1", {
            visibleIfFormula: formula({
              c1: { kind: "outputBlockVisible", outputBlockVisible: "disp" },
            }),
          }),
        ]),
      ],
    });
    expect(validateFormSchema(schema)).toEqual([]);
  });

  it("allows a field block to carry an outputBlockVisible condition pointing at another field block", () => {
    const schema = baseSchema({
      pages: [page("p1", [textField("f1"), textField("f2")])],
      outputViews: [
        view("v1", [
          fieldBlock("blk-a", "f1"),
          fieldBlock("blk-b", "f2", {
            visibleIfFormula: formula({
              c1: {
                kind: "outputBlockVisible",
                outputBlockVisible: "blk-a",
                isVisible: true,
              },
            }),
          }),
        ]),
      ],
    });
    expect(validateFormSchema(schema)).toEqual([]);
  });

  it("flags a 2-block cycle of outputBlockVisible references", () => {
    const schema = baseSchema({
      pages: [page("p1", [textField("f1"), textField("f2")])],
      outputViews: [
        view("v1", [
          fieldBlock("blk-a", "f1", {
            visibleIfFormula: formula({
              c1: { kind: "outputBlockVisible", outputBlockVisible: "blk-b" },
            }),
          }),
          fieldBlock("blk-b", "f2", {
            visibleIfFormula: formula({
              c1: { kind: "outputBlockVisible", outputBlockVisible: "blk-a" },
            }),
          }),
        ]),
      ],
    });
    expect(validateFormSchema(schema)).toEqual([
      {
        viewId: "v1",
        blockId: "blk-a",
        message:
          "Cycle in outputBlockVisible references: blk-a -> blk-b -> blk-a",
      },
    ]);
  });

  it("flags a self-loop outputBlockVisible reference", () => {
    const schema = baseSchema({
      pages: [page("p1", [textField("f1")])],
      outputViews: [
        view("v1", [
          fieldBlock("blk-a", "f1", {
            visibleIfFormula: formula({
              c1: { kind: "outputBlockVisible", outputBlockVisible: "blk-a" },
            }),
          }),
        ]),
      ],
    });
    expect(validateFormSchema(schema)).toEqual([
      {
        viewId: "v1",
        blockId: "blk-a",
        message: "Cycle in outputBlockVisible references: blk-a -> blk-a",
      },
    ]);
  });

  it("flags a 3-block cycle of outputBlockVisible references", () => {
    const schema = baseSchema({
      pages: [page("p1", [textField("f1"), textField("f2"), textField("f3")])],
      outputViews: [
        view("v1", [
          fieldBlock("blk-a", "f1", {
            visibleIfFormula: formula({
              c1: { kind: "outputBlockVisible", outputBlockVisible: "blk-b" },
            }),
          }),
          fieldBlock("blk-b", "f2", {
            visibleIfFormula: formula({
              c1: { kind: "outputBlockVisible", outputBlockVisible: "blk-c" },
            }),
          }),
          fieldBlock("blk-c", "f3", {
            visibleIfFormula: formula({
              c1: { kind: "outputBlockVisible", outputBlockVisible: "blk-a" },
            }),
          }),
        ]),
      ],
    });
    expect(validateFormSchema(schema)).toEqual([
      {
        viewId: "v1",
        blockId: "blk-a",
        message:
          "Cycle in outputBlockVisible references: blk-a -> blk-b -> blk-c -> blk-a",
      },
    ]);
  });

  it("allows a valid DAG of outputBlockVisible references (no cycle)", () => {
    const schema = baseSchema({
      pages: [page("p1", [textField("f1"), textField("f2"), textField("f3")])],
      outputViews: [
        view("v1", [
          fieldBlock("blk-a", "f1"),
          fieldBlock("blk-b", "f2", {
            visibleIfFormula: formula({
              c1: { kind: "outputBlockVisible", outputBlockVisible: "blk-a" },
            }),
          }),
          fieldBlock("blk-c", "f3", {
            visibleIfFormula: formula({
              c1: { kind: "outputBlockVisible", outputBlockVisible: "blk-b" },
            }),
          }),
        ]),
      ],
    });
    expect(validateFormSchema(schema)).toEqual([]);
  });

  it("flags an empty-string outputBlockVisible target as missing", () => {
    const schema = baseSchema({
      outputViews: [
        view("v1", [
          labelBlock("blk", {
            visibleIfFormula: formula({
              c1: { kind: "outputBlockVisible", outputBlockVisible: "" },
            }),
          }),
        ]),
      ],
    });
    expect(validateFormSchema(schema)).toEqual([
      {
        viewId: "v1",
        blockId: "blk",
        message: 'References missing output block ""',
      },
    ]);
  });

  it("rejects outputBlockVisible on an input field's visibleIfFormula", () => {
    const schema = baseSchema({
      pages: [
        page("p1", [
          textField("f1", {
            visibleIfFormula: formula({
              c1: {
                kind: "outputBlockVisible",
                outputBlockVisible: "anything",
              },
            }),
          }),
        ]),
      ],
    });
    expect(validateFormSchema(schema)).toEqual([
      {
        blockId: "f1",
        message:
          '"outputBlockVisible" condition is only valid on output-view blocks',
      },
    ]);
  });

  it("rejects outputBlockVisible on an input field's requiredIfFormula", () => {
    const schema = baseSchema({
      pages: [
        page("p1", [
          textField("f1", {
            requiredIfFormula: formula({
              c1: {
                kind: "outputBlockVisible",
                outputBlockVisible: "anything",
              },
            }),
          }),
        ]),
      ],
    });
    expect(validateFormSchema(schema)).toEqual([
      {
        blockId: "f1",
        message:
          '"outputBlockVisible" condition is only valid on output-view blocks',
      },
    ]);
  });

  it("rejects outputBlockVisible on a display block inside a page", () => {
    const schema = baseSchema({
      pages: [
        page("p1", [
          labelBlock("disp", {
            visibleIfFormula: formula({
              c1: { kind: "outputBlockVisible", outputBlockVisible: "x" },
            }),
          }),
        ]),
      ],
    });
    expect(validateFormSchema(schema)).toEqual([
      {
        blockId: "disp",
        message:
          '"outputBlockVisible" condition is only valid on output-view blocks',
      },
    ]);
  });

  it("allows input-context conditions on a page's visibleIfFormula", () => {
    const schema = baseSchema({
      pages: [
        page("p1", [textField("f1")]),
        {
          ...page("p2", [textField("f2")]),
          visibleIfFormula: formula({
            c1: { kind: "equals", when: "f1", equals: "yes" },
            c2: { kind: "userHasCity", userHasCity: true },
          }),
        },
      ],
    });
    expect(validateFormSchema(schema)).toEqual([]);
  });

  it("allows a page condition referencing a list sub-field on an earlier page", () => {
    const list: ListField = {
      id: "list1",
      type: "input",
      kind: "list",
      label: "list",
      fields: [textField("sub1")],
    };
    const schema = baseSchema({
      pages: [
        page("p1", [list]),
        {
          ...page("p2", [textField("f2")]),
          visibleIfFormula: formula({
            c1: { kind: "equals", when: "sub1", equals: "yes" },
          }),
        },
      ],
    });
    expect(validateFormSchema(schema)).toEqual([]);
  });

  it("allows a page condition referencing another form via sourceFormId", () => {
    const schema = baseSchema({
      pages: [
        {
          ...page("p1", [textField("f1")]),
          visibleIfFormula: formula({
            c1: {
              kind: "equals",
              when: "other-form-field",
              equals: "yes",
              sourceFormId: 42,
            },
          }),
        },
      ],
    });
    expect(validateFormSchema(schema)).toEqual([]);
  });

  it("rejects a page condition referencing a field on the same page", () => {
    const schema = baseSchema({
      pages: [
        {
          ...page("p1", [textField("f1")]),
          visibleIfFormula: formula({
            c1: { kind: "equals", when: "f1", equals: "yes" },
          }),
        },
      ],
    });
    expect(validateFormSchema(schema)).toEqual([
      {
        blockId: "p1",
        message:
          'Page visibility references field "f1", which must be on an earlier page',
      },
    ]);
  });

  it("rejects a page condition referencing a field on a later page", () => {
    const schema = baseSchema({
      pages: [
        {
          ...page("p1", [textField("f1")]),
          visibleIfFormula: formula({
            c1: { kind: "hasValue", when: "f2", hasValue: true },
          }),
        },
        page("p2", [textField("f2")]),
      ],
    });
    expect(validateFormSchema(schema)).toEqual([
      {
        blockId: "p1",
        message:
          'Page visibility references field "f2", which must be on an earlier page',
      },
    ]);
  });

  it("rejects a page condition referencing a nonexistent field", () => {
    const schema = baseSchema({
      pages: [
        page("p1", [textField("f1")]),
        {
          ...page("p2", [textField("f2")]),
          visibleIfFormula: formula({
            c1: { kind: "anySelected", when: "missing", anySelected: true },
          }),
        },
      ],
    });
    expect(validateFormSchema(schema)).toEqual([
      {
        blockId: "p2",
        message:
          'Page visibility references field "missing", which must be on an earlier page',
      },
    ]);
  });

  it("rejects outputBlockVisible on a page's visibleIfFormula", () => {
    const schema = baseSchema({
      pages: [
        {
          ...page("p1", [textField("f1")]),
          visibleIfFormula: formula({
            c1: { kind: "outputBlockVisible", outputBlockVisible: "x" },
          }),
        },
      ],
    });
    expect(validateFormSchema(schema)).toEqual([
      {
        blockId: "p1",
        message:
          '"outputBlockVisible" condition is only valid on output-view blocks',
      },
    ]);
  });

  it("recurses into list sub-fields", () => {
    const nested: ListField = {
      id: "list1",
      type: "input",
      kind: "list",
      label: "list1",
      fields: [
        textField("inner", {
          visibleIfFormula: formula({
            c1: { kind: "outputBlockVisible", outputBlockVisible: "nope" },
          }),
        }),
      ],
    };
    const schema = baseSchema({
      pages: [{ id: "p1", fields: [nested] }],
    });
    expect(validateFormSchema(schema)).toEqual([
      {
        blockId: "inner",
        message:
          '"outputBlockVisible" condition is only valid on output-view blocks',
      },
    ]);
  });

  it("ignores unrelated condition kinds", () => {
    const schema = baseSchema({
      pages: [
        page("p1", [
          textField("f1", {
            visibleIfFormula: formula({
              c1: { kind: "equals", when: "f2", equals: "yes" },
              c3: { kind: "validator", validatorId: 42 },
              c4: { kind: "deviceType", deviceType: ["mobile"] },
            }),
          }),
        ]),
      ],
      outputViews: [
        view("v1", [
          fieldBlock("blk-field", "f1"),
          labelBlock("blk", {
            visibleIfFormula: formula({
              c1: { kind: "hasValue", when: "f1", hasValue: true },
              c2: { kind: "validator", validatorId: 7, resultEquals: false },
            }),
          }),
        ]),
      ],
    });
    expect(validateFormSchema(schema)).toEqual([]);
  });

  it("allows a field to reference a later field on the same page", () => {
    const schema = baseSchema({
      pages: [
        page("p1", [
          textField("f1", {
            visibleIfFormula: formula({
              c1: { kind: "hasValue", when: "f2", hasValue: true },
            }),
          }),
          textField("f2"),
        ]),
      ],
    });
    expect(validateFormSchema(schema)).toEqual([]);
  });

  it("flags a direct visibility cycle between two fields", () => {
    const schema = baseSchema({
      pages: [
        page("p1", [
          textField("f1", {
            visibleIfFormula: formula({
              c1: { kind: "hasValue", when: "f2", hasValue: true },
            }),
          }),
          textField("f2", {
            visibleIfFormula: formula({
              c1: { kind: "hasValue", when: "f1", hasValue: true },
            }),
          }),
        ]),
      ],
    });
    expect(validateFormSchema(schema)).toEqual([
      {
        blockId: "f1",
        message: "Visibility conditions form a cycle: f1 -> f2 -> f1",
      },
    ]);
  });

  it("flags a chained visibility cycle through a list sub-field", () => {
    const list: ListField = {
      id: "list",
      type: "input",
      kind: "list",
      label: "list",
      fields: [
        textField("sub", {
          visibleIfFormula: formula({
            c1: { kind: "hasValue", when: "f1", hasValue: true },
          }),
        }),
      ],
    };
    const schema = baseSchema({
      pages: [
        page("p1", [
          textField("f1", {
            visibleIfFormula: formula({
              c1: { kind: "hasValue", when: "f2", hasValue: true },
            }),
          }),
          textField("f2", {
            visibleIfFormula: formula({
              c1: { kind: "hasValue", when: "sub", hasValue: true },
            }),
          }),
          list,
        ]),
      ],
    });
    expect(validateFormSchema(schema)).toEqual([
      {
        blockId: "f1",
        message: "Visibility conditions form a cycle: f1 -> f2 -> sub -> f1",
      },
    ]);
  });

  it("flags an element whose visibility reads its own field", () => {
    const schema = baseSchema({
      pages: [
        page("p1", [
          textField("f1", {
            visibleIfFormula: formula({
              c1: { kind: "hasValue", when: "f1", hasValue: true },
            }),
          }),
        ]),
      ],
    });
    expect(validateFormSchema(schema)).toEqual([
      {
        blockId: "f1",
        message: 'Visibility of "f1" depends on its own answer',
      },
    ]);
  });

  it("ignores cross-form references when looking for visibility cycles", () => {
    const schema = baseSchema({
      pages: [
        page("p1", [
          textField("f1", {
            visibleIfFormula: formula({
              c1: {
                kind: "hasValue",
                when: "f2",
                hasValue: true,
                sourceFormId: 7,
              },
            }),
          }),
          textField("f2", {
            visibleIfFormula: formula({
              c1: { kind: "hasValue", when: "f1", hasValue: true },
            }),
          }),
        ]),
      ],
    });
    expect(validateFormSchema(schema)).toEqual([]);
  });

  it("reports multiple errors across pages and output views", () => {
    const schema = baseSchema({
      pages: [
        page("p1", [
          textField("f1", {
            visibleIfFormula: formula({
              c1: { kind: "outputBlockVisible", outputBlockVisible: "x" },
            }),
          }),
        ]),
      ],
      outputViews: [
        view("v1", [
          labelBlock("blk", {
            visibleIfFormula: formula({
              c1: { kind: "outputBlockVisible", outputBlockVisible: "missing" },
            }),
          }),
        ]),
      ],
    });
    const errors = validateFormSchema(schema);
    expect(errors).toHaveLength(2);
    expect(errors).toContainEqual({
      blockId: "f1",
      message:
        '"outputBlockVisible" condition is only valid on output-view blocks',
    });
    expect(errors).toContainEqual({
      viewId: "v1",
      blockId: "blk",
      message: 'References missing output block "missing"',
    });
  });

  it("uses <unnamed> for a display block with no id", () => {
    const schema = baseSchema({
      outputViews: [
        view("v1", [
          {
            type: "display",
            kind: "label",
            text: "no-id",
            visibleIfFormula: formula({
              c1: { kind: "outputBlockVisible", outputBlockVisible: "missing" },
            }),
          },
        ]),
      ],
    });
    expect(validateFormSchema(schema)).toEqual([
      {
        viewId: "v1",
        blockId: "<unnamed>",
        message: 'References missing output block "missing"',
      },
    ]);
  });

  it("flags an images block with no images on a page", () => {
    const schema = baseSchema({
      pages: [page("p1", [imagesBlock("blk-images", [])])],
    });
    expect(validateFormSchema(schema)).toEqual([
      {
        viewId: undefined,
        blockId: "blk-images",
        message: "Images block has no images. Add one or remove the block",
      },
    ]);
  });

  it("flags an images block with no images in an output view", () => {
    const schema = baseSchema({
      outputViews: [view("v1", [imagesBlock("blk-images", [])])],
    });
    expect(validateFormSchema(schema)).toEqual([
      {
        viewId: "v1",
        blockId: "blk-images",
        message: "Images block has no images. Add one or remove the block",
      },
    ]);
  });

  it("accepts an images block that has an image", () => {
    const schema = baseSchema({
      pages: [page("p1", [imagesBlock("blk-images", [{ src: "key" }])])],
    });
    expect(validateFormSchema(schema)).toEqual([]);
  });

  const filledSection = (title: string) => ({
    id: "sec-1",
    title,
    blocks: [labelBlock("nested")],
  });

  it("flags an accordion with no sections on a page", () => {
    const schema = baseSchema({
      pages: [page("p1", [accordionBlock("blk-acc", [])])],
    });
    expect(validateFormSchema(schema)).toEqual([
      {
        viewId: undefined,
        blockId: "blk-acc",
        message: "Accordion has no sections. Add one or remove the block",
      },
    ]);
  });

  it("flags an accordion with no sections in an output view", () => {
    const schema = baseSchema({
      outputViews: [view("v1", [accordionBlock("blk-acc", [])])],
    });
    expect(validateFormSchema(schema)).toEqual([
      {
        viewId: "v1",
        blockId: "blk-acc",
        message: "Accordion has no sections. Add one or remove the block",
      },
    ]);
  });

  it("flags a section with a blank title, numbered from one", () => {
    const schema = baseSchema({
      pages: [
        page("p1", [
          accordionBlock("blk-acc", [
            filledSection("First"),
            filledSection("  "),
          ]),
        ]),
      ],
    });
    expect(validateFormSchema(schema)).toEqual([
      {
        viewId: undefined,
        blockId: "blk-acc",
        message:
          "Accordion section 2 has no title. Name it or remove the section",
      },
    ]);
  });

  it("flags a section with no blocks", () => {
    const schema = baseSchema({
      pages: [
        page("p1", [
          accordionBlock("blk-acc", [
            { id: "sec-1", title: "Empty", blocks: [] },
          ]),
        ]),
      ],
    });
    expect(validateFormSchema(schema)).toEqual([
      {
        viewId: undefined,
        blockId: "blk-acc",
        message:
          "Accordion section 1 has no blocks. Add one or remove the section",
      },
    ]);
  });

  it("flags an empty images block nested in a section", () => {
    const schema = baseSchema({
      pages: [
        page("p1", [
          accordionBlock("blk-acc", [
            {
              id: "sec-1",
              title: "First",
              blocks: [imagesBlock("blk-images", [])],
            },
          ]),
        ]),
      ],
    });
    expect(validateFormSchema(schema)).toEqual([
      {
        viewId: undefined,
        blockId: "blk-images",
        message: "Images block has no images. Add one or remove the block",
      },
    ]);
  });

  it("accepts an accordion whose sections are titled and hold a block", () => {
    const schema = baseSchema({
      pages: [
        page("p1", [accordionBlock("blk-acc", [filledSection("First")])]),
      ],
    });
    expect(validateFormSchema(schema)).toEqual([]);
  });
});

describe("range option count", () => {
  const rangeField = (optionCount?: number): RangeField => ({
    id: "scale",
    type: "input",
    kind: "range",
    label: "Scale",
    optionCount,
  });
  const error = {
    blockId: "scale",
    message: "Number of options must be a whole number from 2 to 50",
  };

  it.each([undefined, 2, 10, 50])("accepts optionCount=%p", (optionCount) => {
    const schema = baseSchema({
      pages: [page("p1", [rangeField(optionCount)])],
    });
    expect(validateFormSchema(schema)).toEqual([]);
  });

  it.each([0, 1, 2.5, 51, 80])("flags optionCount=%p", (optionCount) => {
    const schema = baseSchema({
      pages: [page("p1", [rangeField(optionCount)])],
    });
    expect(validateFormSchema(schema)).toEqual([error]);
  });

  it("flags a range sub-field of a list", () => {
    const list: ListField = {
      id: "list1",
      type: "input",
      kind: "list",
      label: "list",
      fields: [rangeField(80)],
    };
    const schema = baseSchema({ pages: [page("p1", [list])] });
    expect(validateFormSchema(schema)).toEqual([error]);
  });
});

describe("range default selection", () => {
  const rangeField = (
    defaultValue: RangeField["defaultValue"],
  ): RangeField => ({
    id: "scale",
    type: "input",
    kind: "range",
    label: "Scale",
    optionCount: 5,
    defaultValue,
  });
  const error = {
    blockId: "scale",
    message: "Default selection must be a whole number from 1 to 5",
  };

  it.each([undefined, null, 1, 5])("accepts defaultValue=%p", (value) => {
    const schema = baseSchema({ pages: [page("p1", [rangeField(value)])] });
    expect(validateFormSchema(schema)).toEqual([]);
  });

  it.each([0, 6, 8, 2.5])("flags defaultValue=%p", (value) => {
    const schema = baseSchema({ pages: [page("p1", [rangeField(value)])] });
    expect(validateFormSchema(schema)).toEqual([error]);
  });

  it("flags a range sub-field of a list", () => {
    const list: ListField = {
      id: "list1",
      type: "input",
      kind: "list",
      label: "list",
      fields: [rangeField(8)],
    };
    const schema = baseSchema({ pages: [page("p1", [list])] });
    expect(validateFormSchema(schema)).toEqual([error]);
  });
});
