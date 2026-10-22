import type { FormSchema, NumberField } from "./form-schema";
import { resolveOutputBlocks } from "./output-resolution";

const numberField = (id: string, label: string): NumberField => ({
  id,
  type: "input",
  kind: "number",
  label,
});

describe("resolveOutputBlocks", () => {
  it("evaluates only the variables the drawn text names", () => {
    const shut = {
      conditions: { c1: { kind: "equals", when: "gate", equals: "shut" } },
      formula: "c1",
    } as const;
    const fromSecret = (name: string, formula: string) => ({
      name,
      inputs: { input1: { kind: "field", fieldId: "secret" } } as const,
      formula,
    });
    const schema: FormSchema = {
      pages: [
        {
          id: "p1",
          fields: [
            { id: "gate", type: "input", kind: "text", label: "Gate" },
            numberField("secret", "Secret"),
            numberField("note", "#{onHiddenField}"),
          ],
        },
      ],
      variables: [
        fromSecret("double", "input1 * 2"),
        fromSecret("unused", "input1 + 1"),
        fromSecret("onHidden", "input1 + 2"),
        fromSecret("onHiddenField", "input1 + 3"),
      ],
      outputViews: [
        {
          id: "v1",
          type: "default",
          blocks: [
            { type: "display", kind: "text", text: "Twice: #{double}" },
            {
              type: "display",
              kind: "text",
              text: "#{onHidden}",
              visibleIfFormula: shut,
            },
            { id: "b-note", fieldId: "note", visibleIfFormula: shut },
          ],
        },
      ],
    };
    expect([
      ...(resolveOutputBlocks({
        schema,
        answers: { gate: "open", secret: 21, note: 1 },
        publicAnswers: { note: true },
      })?.variableValues ?? []),
    ]).toEqual([["double", "42"]]);
  });
});
