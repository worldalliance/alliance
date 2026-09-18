import type {
  FormSchema,
  FormValue,
  ListField,
  NumberField,
  OutputFieldBlock,
} from "@alliance/common/forms/form-schema";
import { resolveOutputItems } from "./outputrenderer";

const numberField = (id: string, label: string): NumberField => ({
  id,
  type: "input",
  kind: "number",
  label,
});

const schemaWithVariable = (overrides: Partial<FormSchema>): FormSchema => ({
  pages: [{ id: "p1", fields: [numberField("qty", "Quantity")] }],
  outputViews: [],
  variables: [
    {
      name: "total",
      inputs: { input1: { kind: "field", fieldId: "qty" } },
      formula: "input1 * 2",
    },
  ],
  ...overrides,
});

const resolve = (schema: FormSchema) =>
  resolveOutputItems({
    schema,
    answers: { qty: 21 },
    publicAnswers: { qty: true },
  });

describe("resolveOutputItems interpolates variables", () => {
  it("leaves a failed variable's reference as written and still fills the rest", () => {
    const [item] = resolve(
      schemaWithVariable({
        pages: [
          {
            id: "p1",
            fields: [numberField("qty", "#{broken} of #{total} units")],
          },
        ],
        outputViews: [
          {
            id: "v1",
            type: "default",
            blocks: [{ id: "ob1", fieldId: "qty", showLabel: true }],
          },
        ],
        variables: [
          { name: "broken", inputs: {}, formula: "this" },
          {
            name: "total",
            inputs: { input1: { kind: "field", fieldId: "qty" } },
            formula: "input1 * 2",
          },
        ],
      }),
    ).items;

    if (item.type !== "field") throw new Error("expected a field item");
    expect(item.label).toBe("#{broken} of 42 units");
  });

  it("leaves a variable reading a field kind this build doesn't know as written", () => {
    const [item] = resolve(
      schemaWithVariable({
        pages: [
          {
            id: "p1",
            fields: [
              numberField("qty", "#{total} units"),
              JSON.parse(
                '{ "id": "future", "type": "input", "kind": "future", "label": "Future" }',
              ),
            ],
          },
        ],
        outputViews: [
          {
            id: "v1",
            type: "default",
            blocks: [{ id: "ob1", fieldId: "qty", showLabel: true }],
          },
        ],
        variables: [
          {
            name: "total",
            inputs: { input1: { kind: "field", fieldId: "future" } },
            formula: "input1 ?? 'n/a'",
          },
        ],
      }),
    ).items;

    if (item.type !== "field") throw new Error("expected a field item");
    expect(item.label).toBe("#{total} units");
  });

  it("substitutes into a label override", () => {
    const [item] = resolve(
      schemaWithVariable({
        outputViews: [
          {
            id: "v1",
            type: "default",
            blocks: [
              {
                id: "ob1",
                fieldId: "qty",
                labelOverride: "#{total} saved",
                showLabel: true,
              },
            ],
          },
        ],
      }),
    ).items;

    if (item.type !== "field") throw new Error("expected a field item");
    expect(item.label).toBe("42 saved");
    expect(item.renderField?.label).toBe("42 saved");
    expect(item.block.labelOverride).toBe("42 saved");
  });

  it("substitutes into the field's own label when there is no override", () => {
    const [item] = resolve(
      schemaWithVariable({
        pages: [{ id: "p1", fields: [numberField("qty", "#{total} units")] }],
        outputViews: [
          {
            id: "v1",
            type: "default",
            blocks: [{ id: "ob1", fieldId: "qty", showLabel: true }],
          },
        ],
      }),
    ).items;

    if (item.type !== "field") throw new Error("expected a field item");
    expect(item.label).toBe("42 units");
    expect(item.renderField?.label).toBe("42 units");
  });

  it("substitutes into list sub-field labels", () => {
    const list: ListField = {
      id: "list",
      type: "input",
      kind: "list",
      label: "Items",
      fields: [numberField("sub", "Weight of #{total}")],
    };
    const { items } = resolveOutputItems({
      schema: schemaWithVariable({
        pages: [{ id: "p1", fields: [numberField("qty", "Quantity"), list] }],
        outputViews: [
          {
            id: "v1",
            type: "default",
            blocks: [{ id: "ob1", fieldId: "list" }],
          },
        ],
      }),
      answers: { qty: 21, list: [{ sub: 1 }] },
      publicAnswers: { list: true },
    });

    const [item] = items;
    if (item.type !== "field") throw new Error("expected a field item");
    const renderField = item.renderField;
    if (renderField?.kind !== "list") throw new Error("expected a list field");
    expect(renderField.fields[0].label).toBe("Weight of 42");
  });

  it("substitutes into display blocks", () => {
    const [item] = resolve(
      schemaWithVariable({
        outputViews: [
          {
            id: "v1",
            type: "default",
            blocks: [
              { id: "ob1", type: "display", kind: "text", text: "#{total} kg" },
            ],
          },
        ],
      }),
    ).items;

    if (item.type !== "display") throw new Error("expected a display item");
    if (item.block.kind !== "text") throw new Error("expected a text block");
    expect(item.block.text).toBe("42 kg");
  });
});

describe("resolveOutputItems and blank list cards", () => {
  const list: ListField = {
    id: "shipment-weights",
    type: "input",
    kind: "list",
    label: "Items",
    fields: [numberField("weight", "Weight"), numberField("note", "Note")],
    outputViewHiddenFieldIds: ["note"],
  };
  const resolveList = (
    value: FormValue,
    {
      format,
      publicAnswer = true,
      blocks = [{ id: "ob1", fieldId: list.id, format }],
    }: {
      format?: OutputFieldBlock["format"];
      publicAnswer?: boolean;
      blocks?: OutputFieldBlock[];
    } = {},
  ) =>
    resolveOutputItems({
      schema: {
        pages: [{ id: "p1", fields: [list] }],
        outputViews: [
          {
            id: "v1",
            type: "default",
            blocks,
          },
        ],
      },
      answers: { [list.id]: value },
      publicAnswers: { [list.id]: publicAnswer },
    }).items;

  it("leaves out a list whose cards answer only what the view hides", () => {
    expect(resolveList([{ weight: "" }, { note: 3 }])).toEqual([]);
  });

  it("keeps a list with one card the view shows an answer for", () => {
    expect(resolveList([{ weight: "" }, { weight: 2 }])).toHaveLength(1);
  });

  it("leaves out a count block for a list the view shows nothing of", () => {
    expect(
      resolveList([{ weight: "" }, { note: 3 }], { format: "textonly" }),
    ).toEqual([]);
  });

  it("counts only the cards the view shows an answer for", () => {
    const [item] = resolveList([{ weight: "" }, { weight: 2 }], {
      format: "textonly",
    });

    if (item.type !== "field") throw new Error("expected a field item");
    expect(item.formattedValue).toBe("1 item");
  });
});
