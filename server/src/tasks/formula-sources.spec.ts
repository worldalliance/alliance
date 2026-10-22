import type { FormSchema } from "@alliance/common/forms/form-schema";
import { R } from "@alliance/common/result";
import { submittedFormulaChoices } from "./formula-sources";

const offering = (id: string, value: string) => ({
  id,
  type: "input" as const,
  kind: "select" as const,
  label: id,
  options: [],
  optionsFormula: {
    inputs: {},
    formula: `[{ label: '${value}', value: '${value}' }]`,
  },
});

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [
        {
          id: "rows",
          type: "input",
          kind: "list",
          label: "Rows",
          fields: [offering("first", "a"), offering("second", "b")],
        },
      ],
    },
  ],
  outputViews: [],
};

describe("submittedFormulaChoices", () => {
  it("names the list sub-field holding the choice it doesn't offer", () => {
    const result = submittedFormulaChoices({
      schema,
      answers: { rows: [{ first: "a", second: "gone" }] },
      sources: new Map(),
    });

    expect(R.isFailure(result) && result.error).toContain("second");
  });
});
