import type {
  FormSchema,
  ListField,
  NumberField,
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
