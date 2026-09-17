import type { FormSchema } from "@alliance/common/forms/form-schema";
import { describe, expect, it } from "bun:test";
import { mergeFormSchemas } from "./formSchemaMerge";

const withPeople = (
  subFieldLabels: Record<string, string>,
  variables?: FormSchema["variables"],
): FormSchema => ({
  pages: [
    {
      id: "p1",
      title: "Page",
      fields: [
        {
          id: "people",
          type: "input",
          kind: "list",
          label: "People",
          fields: Object.entries(subFieldLabels).map(([id, label]) => ({
            id,
            type: "input",
            kind: "text",
            label,
            required: false,
          })),
          defaultNumber: 0,
          min: 0,
          required: false,
        },
      ],
    },
  ],
  outputViews: [],
  ...(variables ? { variables } : {}),
});

describe("mergeFormSchemas", () => {
  it("names a sub-field one side added for a list input the other side added", () => {
    const result = mergeFormSchemas(
      withPeople({ a: "Name" }),
      withPeople({ a: "Name", b: "Age" }),
      withPeople({ a: "Name" }, [
        {
          name: "names",
          inputs: {
            input1: {
              kind: "list",
              fieldId: "people",
              properties: { a: "name" },
            },
          },
          formula: "input1.length",
        },
      ]),
    );
    expect(result.ok && result.value.variables?.[0].inputs.input1).toEqual({
      kind: "list",
      fieldId: "people",
      properties: { a: "name", b: "age" },
    });
  });
});
