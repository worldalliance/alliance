import type { AnyField, FormSchema } from "@alliance/common/forms/form-schema";
import type { SourceFormFields } from "@alliance/common/forms/variable-scope";
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
    const result = mergeFormSchemas({
      base: withPeople({ a: "Name" }),
      mine: withPeople({ a: "Name", b: "Age" }),
      theirs: withPeople({ a: "Name" }, [
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
      validation: { sourceForms: new Map() },
    });
    expect(result.ok && result.value.variables?.[0].inputs.input1).toEqual({
      kind: "list",
      fieldId: "people",
      properties: { a: "name", b: "age" },
    });
  });

  it("syncs and checks a list input the other side added against the form it reads", () => {
    const readsSurvey = withPeople({ a: "Name" }, [
      {
        name: "pets",
        inputs: {
          input1: {
            kind: "sourceList",
            sourceFormId: 9,
            fieldId: "pets",
            properties: { pn: "pet" },
          },
        },
        formula: "input1.length",
      },
    ]);
    const pets: AnyField = {
      id: "pets",
      type: "input",
      kind: "list",
      label: "Pets",
      fields: [
        { id: "pn", type: "input", kind: "text", label: "Pet" },
        { id: "pa", type: "input", kind: "number", label: "Age" },
      ],
    };
    const merge = (sourceForms: SourceFormFields) =>
      mergeFormSchemas({
        base: withPeople({ a: "Name" }),
        mine: withPeople({ a: "Name", b: "Age" }),
        theirs: readsSurvey,
        validation: { sourceForms },
      });

    const result = merge(new Map([[9, [pets]]]));
    expect(result.ok && result.value.variables?.[0].inputs.input1).toEqual({
      kind: "sourceList",
      sourceFormId: 9,
      fieldId: "pets",
      properties: { pn: "pet", pa: "age" },
    });
    expect(merge(new Map()).ok).toBe(false);
  });
});
