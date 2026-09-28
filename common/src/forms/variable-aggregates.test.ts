import { describe, expect, it } from "bun:test";
import type {
  AnyField,
  FormSchema,
  ListField,
  MultiSelectField,
  SelectField,
} from "./form-schema";
import { variableInputFieldsById } from "./form-schema";
import { validateFormSchema } from "./form-schema-validate";
import { resolveOutputBlocks } from "./output-resolution";
import {
  aggregateSourceKey,
  variableAggregateSources,
  type VariableAggregateCounts,
} from "./variable-aggregates";
import { evaluateVariable } from "./variable-evaluation";
import { variableInputSchema } from "./variable-inputs";
import { variableFieldScope } from "./variable-scope";
import {
  variableHistoryFormIds,
  variableSourceFormIds,
  variableTypeEnv,
  type FormVariable,
} from "./variables";

const SOURCE = 7;

const COMPANIES = [
  { label: "Company A", value: "company-a" },
  { label: "Company B", value: "company-b" },
];

const employers: MultiSelectField = {
  id: "employers",
  type: "input",
  kind: "multiselect",
  label: "Employers",
  options: COMPANIES,
};

const company: SelectField = {
  id: "company",
  type: "input",
  kind: "select",
  label: "Company",
  options: COMPANIES,
};

const countsInput = {
  kind: "aggregate",
  sourceFormId: SOURCE,
  fieldId: "employers",
} as const;

const countVariable = (formula: string): FormVariable => ({
  name: "count",
  inputs: {
    counts: countsInput,
    company: { kind: "field", fieldId: "company" },
  },
  formula,
});

const LOOKUP = "company ? (counts[company.value] ?? 0) : 0";

const COUNTS: VariableAggregateCounts = { "company-a": 12, "company-b": 0 };

const evaluate = (params: {
  variable: FormVariable;
  answers?: Record<string, string>;
  aggregates?: ReadonlyMap<string, VariableAggregateCounts>;
}) =>
  evaluateVariable(params.variable, {
    answers: params.answers ?? {},
    fields: variableInputFieldsById([company]),
    aggregates: params.aggregates,
  });

const loaded = new Map([[aggregateSourceKey(countsInput), COUNTS]]);

describe("variableInputSchema for aggregate inputs", () => {
  it("accepts a source form and question, and nothing more", () => {
    expect(variableInputSchema.safeParse(countsInput).success).toBe(true);
    expect(
      variableInputSchema.safeParse({ ...countsInput, properties: {} }).success,
    ).toBe(false);
  });
});

describe("evaluateVariable with an aggregate input", () => {
  it("looks up the count for a local answer by its stored value", () => {
    expect(
      evaluate({
        variable: countVariable(LOOKUP),
        answers: { company: "company-a" },
        aggregates: loaded,
      }),
    ).toEqual({ ok: true, value: "12" });
    expect(
      evaluate({
        variable: countVariable(LOOKUP),
        answers: { company: "company-b" },
        aggregates: loaded,
      }),
    ).toEqual({ ok: true, value: "0" });
    expect(
      evaluate({ variable: countVariable(LOOKUP), aggregates: loaded }),
    ).toEqual({ ok: true, value: "0" });
  });

  it("reads a value the counts don't hold as undefined", () => {
    expect(
      evaluate({
        variable: countVariable(LOOKUP),
        answers: { company: "gone" },
        aggregates: loaded,
      }),
    ).toEqual({ ok: true, value: "0" });
  });

  it("fails rather than reading counts it wasn't given as zero", () => {
    const result = evaluate({
      variable: countVariable(LOOKUP),
      answers: { company: "company-a" },
    });
    expect(result.ok).toBe(false);
  });
});

describe("variableTypeEnv for aggregate inputs", () => {
  it("types the counts as numbers by option value, not per submission", () => {
    const scope = variableFieldScope(
      { pages: [{ id: "p1", fields: [company] }], outputViews: [] },
      new Map([[SOURCE, [employers]]]),
    );
    expect(variableTypeEnv(countVariable(LOOKUP), scope).get("counts")).toBe(
      "{ [value: string]: number }",
    );
  });
});

describe("validateFormSchema with aggregate inputs", () => {
  const destination = (
    variables: FormVariable[],
    overrides: Partial<FormSchema> = {},
  ): FormSchema => ({
    pages: [{ id: "p1", fields: [company] }],
    outputViews: [],
    variables,
    ...overrides,
  });

  const messages = (
    schema: FormSchema,
    params: { formId?: number; sourceFields?: AnyField[] } = {},
  ) =>
    validateFormSchema(schema, {
      formId: params.formId,
      sourceForms: new Map([[SOURCE, params.sourceFields ?? [employers]]]),
    }).map(({ message }) => message);

  it("accepts a lookup combined with a local input", () => {
    expect(messages(destination([countVariable(LOOKUP)]))).toEqual([]);
  });

  describe("counting the form's own submissions", () => {
    const own = (fields: AnyField[]) =>
      destination([countVariable(LOOKUP)], {
        pages: [{ id: "p1", fields: [company, ...fields] }],
      });

    it("accepts a question the schema being saved has", () => {
      expect(messages(own([employers]), { formId: SOURCE })).toEqual([]);
    });

    it("accepts a question added in the same save", () => {
      expect(
        messages(own([employers]), { formId: SOURCE, sourceFields: [] }),
      ).toEqual([]);
    });

    it("rejects a question the save removes", () => {
      expect(messages(own([]), { formId: SOURCE })).toEqual([
        `Input "counts" references field "employers", which form ${SOURCE} no longer has`,
      ]);
    });

    it("rejects a question the save turns into another kind", () => {
      expect(
        messages(own([{ ...company, id: "employers" }]), { formId: SOURCE }),
      ).toEqual([
        'Input "counts" counts answers to "employers", whose kind is select. Pick a multiselect question',
      ]);
    });
  });

  it("rejects a formula that misuses the counts", () => {
    expect(messages(destination([countVariable("counts * 2")]))).toHaveLength(
      1,
    );
  });

  it("rejects a question that isn't a multiselect", () => {
    expect(
      messages(destination([countVariable(LOOKUP)]), {
        sourceFields: [{ ...company, id: "employers" }],
      }),
    ).toEqual([
      'Input "counts" counts answers to "employers", whose kind is select. Pick a multiselect question',
    ]);
  });

  it("rejects a multiselect whose options come from a formula", () => {
    expect(
      messages(destination([countVariable(LOOKUP)]), {
        sourceFields: [
          {
            ...employers,
            options: [],
            optionsFormula: { inputs: {}, formula: "[]" },
          },
        ],
      }),
    ).toEqual([
      'Input "counts" counts answers to "employers", whose options come from a formula. Only fixed options can be counted',
    ]);
  });

  it("rejects a question the source form no longer has", () => {
    expect(
      messages(destination([countVariable(LOOKUP)]), { sourceFields: [] }),
    ).toEqual([
      `Input "counts" references field "employers", which form ${SOURCE} no longer has`,
    ]);
  });

  it("rejects a multiselect inside a list", () => {
    const list: ListField = {
      id: "jobs",
      type: "input",
      kind: "list",
      label: "Jobs",
      fields: [employers],
    };
    expect(
      messages(destination([countVariable(LOOKUP)]), { sourceFields: [list] }),
    ).toEqual([
      'Input "counts" reads field "employers", which is inside a list. Only a multiselect outside a list can be counted',
    ]);
  });

  it("rejects a source form that couldn't be loaded", () => {
    expect(
      validateFormSchema(destination([countVariable(LOOKUP)]), {
        sourceForms: new Map(),
      }).map(({ message }) => message),
    ).toEqual([
      `Input "counts" reads form ${SOURCE}, which doesn't exist or couldn't be loaded`,
    ]);
  });

  it("rejects the variable in shared output", () => {
    const errors = validateFormSchema(
      destination([countVariable(LOOKUP)], {
        outputViews: [
          {
            id: "view",
            type: "default",
            blocks: [
              { id: "text", type: "display", kind: "text", text: "#{count}" },
            ],
          },
        ],
      }),
      { sourceForms: new Map([[SOURCE, [employers]]]) },
    );
    expect(errors).toEqual([
      {
        viewId: "view",
        blockId: "text.text",
        message:
          "Output views can't show #{count}, which reads submitted answers",
      },
    ]);
  });
});

describe("resolveOutputBlocks with an aggregate variable", () => {
  it("leaves it unresolved, since shared output never loads counts", () => {
    const resolved = resolveOutputBlocks({
      schema: {
        pages: [{ id: "p1", fields: [company] }],
        outputViews: [
          {
            id: "view",
            type: "default",
            blocks: [
              { id: "text", type: "display", kind: "text", text: "#{count}" },
            ],
          },
        ],
        variables: [countVariable(LOOKUP)],
      },
      answers: { company: "company-a" },
    });
    expect(resolved && Object.fromEntries(resolved.variableValues)).toEqual({});
  });
});

describe("aggregate source discovery", () => {
  const variables: FormVariable[] = [
    countVariable(LOOKUP),
    {
      name: "again",
      inputs: {
        input1: countsInput,
        input2: { ...countsInput, sourceFormId: 3, fieldId: "b" },
        input3: { kind: "sourceField", sourceFormId: 9, fieldId: "score" },
      },
      formula: "1",
    },
  ];

  it("lists each form and question once", () => {
    expect(variableAggregateSources(variables)).toEqual([
      { sourceFormId: 3, fieldId: "b" },
      { sourceFormId: SOURCE, fieldId: "employers" },
    ]);
  });

  it("counts aggregate sources as forms read, but not as history to load", () => {
    expect(variableSourceFormIds(variables)).toEqual([3, SOURCE, 9]);
    expect(variableHistoryFormIds(variables)).toEqual([9]);
  });
});
