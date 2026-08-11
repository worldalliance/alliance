import type { TextBlock } from "./display-blocks";
import type {
  AnyField,
  CheckboxField,
  FormSchema,
  ListField,
  NumberField,
  OutputFieldBlock,
  Page,
  RadioField,
  RangeField,
  TextField,
} from "./form-schema";
import { isQuestionField } from "./form-schema";
import { validateFormSchema } from "./form-schema-validate";
import {
  collectUnresolvedVariableReferences,
  forEachInterpolatableText,
  interpolateDisplayBlock,
  interpolateFieldText,
  interpolateOutputFieldBlock,
} from "./variable-interpolation";
import {
  collectVariableReferences,
  evaluateVariable,
  formatVariableValue,
  formValueToExprValue,
  formVariableSchema,
  interpolateVariables,
  resolveVariableValues,
  sanitizeVariableName,
  textHasVariableReference,
  VARIABLE_NAME_REGEX,
  type FormVariable,
} from "./variables";

const numberField = (id: string): NumberField => ({
  id,
  type: "input",
  kind: "number",
  label: id,
});

const checkboxField = (id: string): CheckboxField => ({
  id,
  type: "input",
  kind: "checkbox",
  label: id,
});

const rangeField = (id: string): RangeField => ({
  id,
  type: "input",
  kind: "range",
  label: id,
});

const textField = (id: string): TextField => ({
  id,
  type: "input",
  kind: "text",
  label: id,
});

const radioField = (id: string, optionLabels: string[]): RadioField => ({
  id,
  type: "input",
  kind: "radio",
  label: id,
  options: optionLabels.map((label, index) => ({
    label,
    value: `value${index}`,
  })),
});

const textBlock = (id: string, text: string): TextBlock => ({
  id,
  type: "display",
  kind: "text",
  text,
});

const page = (id: string, fields: AnyField[] | TextBlock[]): Page => ({
  id,
  fields,
});

const variable = (overrides: Partial<FormVariable> = {}): FormVariable => ({
  name: "total",
  inputs: { input1: { kind: "field", fieldId: "qty" } },
  formula: "input1 * 2",
  ...overrides,
});

const schema = (overrides: Partial<FormSchema> = {}): FormSchema => ({
  pages: [],
  outputViews: [],
  ...overrides,
});

describe("interpolateVariables", () => {
  const values = new Map([
    ["total", "42"],
    ["co2-saved", "1.5"],
  ]);

  it("substitutes references anywhere in the string", () => {
    expect(interpolateVariables("You saved #{total} units", values)).toBe(
      "You saved 42 units",
    );
    expect(interpolateVariables("#{total}/#{total}", values)).toBe("42/42");
    expect(interpolateVariables("#{co2-saved} kg", values)).toBe("1.5 kg");
  });

  it("leaves an unknown reference visible rather than blanking it", () => {
    expect(interpolateVariables("a #{nope} b", values)).toBe("a #{nope} b");
  });

  it("leaves text without references untouched", () => {
    const text = "no variables here";
    expect(interpolateVariables(text, values)).toBe(text);
  });

  it("ignores malformed delimiters", () => {
    expect(interpolateVariables("#{ total }", values)).toBe("#{ total }");
    expect(interpolateVariables("#total", values)).toBe("#total");
    expect(interpolateVariables("{total}", values)).toBe("{total}");
  });
});

describe("collectVariableReferences", () => {
  it("finds every reference, in order", () => {
    expect(collectVariableReferences("a #{x} and #{y}")).toEqual(["x", "y"]);
    expect(collectVariableReferences("none here")).toEqual([]);
  });

  // A shared /g regex would carry lastIndex out of the test() above and make
  // this scan start mid-string, silently dropping the first reference.
  it("carries no matcher state between scans", () => {
    expect(textHasVariableReference("a #{x} and #{y}")).toBe(true);
    expect(collectVariableReferences("a #{x} and #{y}")).toEqual(["x", "y"]);
  });
});

describe("sanitizeVariableName", () => {
  it("strips characters a name may not contain", () => {
    expect(sanitizeVariableName("total spend")).toBe("totalspend");
    expect(sanitizeVariableName("we{ir}d#name")).toBe("weirdname");
    expect(sanitizeVariableName("café☕")).toBe("caf");
    expect(sanitizeVariableName("a.b")).toBe("ab");
  });

  it("keeps everything the validator accepts, including a leading digit", () => {
    for (const name of ["total", "2fast", "co2-saved", "item_count"]) {
      expect(sanitizeVariableName(name)).toBe(name);
      expect(VARIABLE_NAME_REGEX.test(name)).toBe(true);
    }
  });

  it("produces a name the validator accepts, or an empty string", () => {
    const sanitized = sanitizeVariableName("!!!hello world!!!");
    expect(VARIABLE_NAME_REGEX.test(sanitized)).toBe(true);
    expect(sanitizeVariableName("!!!")).toBe("");
  });
});

describe("formatVariableValue", () => {
  it.each([NaN, Infinity, -Infinity])("renders %p as nothing", (value) => {
    expect(formatVariableValue(value)).toBe("");
  });

  it("renders a number with only the precision it needs", () => {
    expect(formatVariableValue(0.1 + 0.2)).toBe("0.3");
    expect(formatVariableValue(1 / 3)).toBe("0.333333333333");
    expect(formatVariableValue(42)).toBe("42");
  });

  it("has nothing to say about an unanswered field", () => {
    expect(formatVariableValue(undefined)).toBe("");
  });

  it("rejects a key the schema does not define", () => {
    expect(
      formVariableSchema.safeParse({ ...variable(), decimalPlaces: 2 }).success,
    ).toBe(false);
  });
});

describe("formValueToExprValue", () => {
  it("reads numbers, numeric strings and booleans", () => {
    expect(formValueToExprValue(5)).toBe(5);
    expect(formValueToExprValue("5")).toBe(5);
    expect(formValueToExprValue(" 5.5 ")).toBe(5.5);
    expect(formValueToExprValue(true)).toBe(true);
  });

  it("treats blank and unanswered as undefined so ?? can fill in", () => {
    expect(formValueToExprValue(undefined)).toBeUndefined();
    expect(formValueToExprValue(null)).toBeUndefined();
    expect(formValueToExprValue("")).toBeUndefined();
    expect(formValueToExprValue("   ")).toBeUndefined();
  });

  it("gives no numeric reading to multi-value answers", () => {
    expect(formValueToExprValue(["a", "b"])).toBeUndefined();
    expect(formValueToExprValue({ id: 1, name: "Paris" })).toBeUndefined();
  });
});

describe("evaluateVariable", () => {
  const evaluate = (v: FormVariable, answers: Record<string, number>) =>
    evaluateVariable(v, { answers });

  it("computes from form answers", () => {
    const result = evaluate(variable(), { qty: 21 });
    expect(result).toEqual({ ok: true, value: "42" });
  });

  it("renders nothing when an input is unanswered", () => {
    expect(evaluate(variable(), {})).toEqual({ ok: true, value: "" });
  });

  it("lets the formula supply its own text for an unanswered field", () => {
    const v = variable({ formula: "input1 ?? 'n/a'" });
    expect(evaluate(v, {})).toEqual({ ok: true, value: "n/a" });
  });

  it("rounds to a fixed precision from the formula", () => {
    const v = variable({ formula: "Math.round(input1 / 3 * 100) / 100" });
    expect(evaluate(v, { qty: 10 })).toEqual({ ok: true, value: "3.33" });
  });

  it("trims binary-float noise by default", () => {
    const v = variable({
      inputs: {
        input1: { kind: "field", fieldId: "a" },
        input2: { kind: "field", fieldId: "b" },
      },
      formula: "input1 + input2",
    });
    expect(evaluateVariable(v, { answers: { a: 0.1, b: 0.2 } })).toEqual({
      ok: true,
      value: "0.3",
    });
  });

  it("renders nothing on a division by zero rather than showing Infinity", () => {
    const v = variable({ formula: "100 / input1" });
    expect(evaluate(v, { qty: 0 })).toEqual({ ok: true, value: "" });
  });

  it("reports a broken formula instead of throwing", () => {
    const result = evaluate(variable({ formula: "input1.constructor" }), {
      qty: 1,
    });
    expect(result.ok).toBe(false);
  });
});

describe("resolveVariableValues", () => {
  it("returns display text for every variable", () => {
    const values = resolveVariableValues(
      [variable(), variable({ name: "half", formula: "input1 / 2" })],
      { answers: { qty: 10 } },
    );
    expect(values.get("total")).toBe("20");
    expect(values.get("half")).toBe("5");
  });

  it("renders nothing for a variable that cannot compile", () => {
    const values = resolveVariableValues([variable({ formula: "this" })], {
      answers: { qty: 1 },
    });
    expect(values.get("total")).toBe("");
  });
});

describe("interpolateDisplayBlock", () => {
  const values = new Map([["total", "42"]]);

  it("substitutes into a text block", () => {
    const block = interpolateDisplayBlock(
      textBlock("b", "You saved #{total}"),
      values,
    );
    expect(block.text).toBe("You saved 42");
  });

  it("leaves html blocks alone, since their content is injected as markup", () => {
    const block = interpolateDisplayBlock(
      { id: "b", type: "display", kind: "html", html: "<p>#{total}</p>" },
      values,
    );
    expect(block.html).toBe("<p>#{total}</p>");
  });

  it("returns the same object when nothing changed", () => {
    const block = textBlock("b", "no variables");
    expect(interpolateDisplayBlock(block, values)).toBe(block);
    expect(interpolateDisplayBlock(block, new Map())).toBe(block);
  });

  it("substitutes into chat transcript messages", () => {
    const block = interpolateDisplayBlock(
      {
        id: "b",
        type: "display",
        kind: "chatTranscript",
        messages: [
          { side: "left", text: "You saved #{total}" },
          { side: "right", text: "nice" },
        ],
      },
      values,
    );
    expect(block.messages[0].text).toBe("You saved 42");
    expect(block.messages[1].text).toBe("nice");
  });
});

describe("interpolateFieldText", () => {
  const values = new Map([["total", "42"]]);

  it("substitutes into a field's own text", () => {
    const field = interpolateFieldText(
      {
        ...numberField("qty"),
        label: "#{total} each",
        placeholder: "#{total}",
      },
      values,
    );
    expect(field.label).toBe("42 each");
    expect(field.placeholder).toBe("42");
  });

  it("substitutes into list sub-fields, which render from the parent field", () => {
    const list: ListField = {
      id: "list",
      type: "input",
      kind: "list",
      label: "Items",
      fields: [{ ...numberField("sub"), label: "Weight of #{total}" }],
    };
    expect(interpolateFieldText(list, values).fields[0].label).toBe(
      "Weight of 42",
    );
  });

  it("substitutes into option labels, which render as markdown", () => {
    const field = interpolateFieldText(
      radioField("pick", ["Donate $#{total}", "No thanks"]),
      values,
    );
    expect(field.options.map((option) => option.label)).toEqual([
      "Donate $42",
      "No thanks",
    ]);
  });

  it("leaves option values alone, since answers are matched on them", () => {
    const field = radioField("pick", ["#{total}"]);
    const before = field.options[0].value;
    expect(interpolateFieldText(field, values).options[0].value).toBe(before);
  });

  it("returns the same object when nothing changed", () => {
    const list: ListField = {
      id: "list",
      type: "input",
      kind: "list",
      label: "Items",
      fields: [numberField("sub")],
    };
    expect(interpolateFieldText(list, values)).toBe(list);
    expect(interpolateFieldText(list, new Map())).toBe(list);

    const radio = radioField("pick", ["no variables"]);
    expect(interpolateFieldText(radio, values)).toBe(radio);
  });
});

describe("interpolateOutputFieldBlock", () => {
  it("substitutes into a label override", () => {
    const block: OutputFieldBlock = {
      id: "ob1",
      fieldId: "qty",
      labelOverride: "#{total} saved",
    };
    expect(
      interpolateOutputFieldBlock(block, new Map([["total", "42"]]))
        .labelOverride,
    ).toBe("42 saved");
  });
});

describe("everywhere the validator accepts a reference is interpolated", () => {
  const values = new Map([["total", "42"]]);

  const interpolateLikeRenderers = (input: FormSchema): FormSchema => ({
    ...input,
    pages: input.pages.map((currentPage) => ({
      ...currentPage,
      fields: currentPage.fields.map((element) =>
        isQuestionField(element)
          ? interpolateFieldText(element, values)
          : interpolateDisplayBlock(element, values),
      ),
    })),
    outputViews: input.outputViews.map((view) => ({
      ...view,
      blocks: view.blocks.map((block) =>
        "fieldId" in block
          ? interpolateOutputFieldBlock(block, values)
          : interpolateDisplayBlock(block, values),
      ),
    })),
  });

  it("leaves no reference behind", () => {
    const filled = schema({
      pages: [
        page("p1", [
          { ...numberField("qty"), label: "#{total} each" },
          radioField("pick", ["#{total}", "no thanks"]),
          {
            id: "list",
            type: "input",
            kind: "list",
            label: "#{total}",
            fields: [{ ...numberField("sub"), label: "#{total}" }],
          } satisfies ListField,
        ]),
        {
          id: "p2",
          fields: [
            textBlock("b", "#{total}"),
            {
              id: "chat",
              type: "display",
              kind: "chatTranscript",
              leftName: "#{total}",
              messages: [{ side: "left", text: "#{total}" }],
            },
          ],
        },
      ],
      outputViews: [
        {
          id: "v1",
          type: "default",
          blocks: [
            { id: "ob1", fieldId: "qty", labelOverride: "#{total} each" },
            textBlock("ob2", "#{total}"),
          ],
        },
      ],
    });

    const unsubstituted: string[] = [];
    forEachInterpolatableText(interpolateLikeRenderers(filled), (text, at) => {
      if (text.includes("#{")) unsubstituted.push(at);
    });
    expect(unsubstituted).toEqual([]);
  });

  it("fails when a reference survives, so the check can't pass vacuously", () => {
    const unsubstituted: string[] = [];
    forEachInterpolatableText(
      schema({ pages: [page("p1", [textBlock("b", "#{total}")])] }),
      (text, at) => {
        if (text.includes("#{")) unsubstituted.push(at);
      },
    );
    expect(unsubstituted).toEqual(["b.text"]);
  });
});

describe("validateFormSchema: variables", () => {
  const errorsFor = (overrides: Partial<FormSchema>) =>
    validateFormSchema(schema(overrides)).map((error) => error.message);

  it("accepts a well-formed variable and reference", () => {
    expect(
      errorsFor({
        pages: [
          page("p1", [numberField("qty")]),
          page("p2", [textBlock("b", "Total: #{total}")]),
        ],
        variables: [variable()],
      }),
    ).toEqual([]);
  });

  // Renaming a variable dangles every reference to it at once; the builder
  // confirms before saving instead of trapping the admin mid-edit.
  it("accepts a reference to an undeclared variable", () => {
    expect(
      errorsFor({ pages: [page("p1", [textBlock("b", "#{nope}")])] }),
    ).toEqual([]);
  });

  it("rejects a formula that does not compile", () => {
    const errors = errorsFor({
      pages: [page("p1", [numberField("qty")])],
      variables: [variable({ formula: "input1.constructor" })],
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Math functions");
  });

  it("rejects an input pointing at a missing field", () => {
    expect(errorsFor({ variables: [variable()] })).toEqual([
      'Input "input1" references missing field "qty"',
    ]);
  });

  it("rejects an input reading a field with no numeric value", () => {
    const errors = errorsFor({
      pages: [page("p1", [textField("qty")])],
      variables: [variable()],
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("has no numeric value");
  });

  it("rejects an input reading a field inside a list", () => {
    const list: ListField = {
      id: "list",
      type: "input",
      kind: "list",
      label: "Items",
      fields: [numberField("qty")],
    };
    const errors = errorsFor({
      pages: [page("p1", [list])],
      variables: [variable()],
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("inside a list");
  });

  it("allows range inputs", () => {
    expect(
      errorsFor({
        pages: [page("p1", [rangeField("qty")])],
        variables: [variable()],
      }),
    ).toEqual([]);
  });

  it("rejects checkbox inputs", () => {
    const errors = errorsFor({
      pages: [page("p1", [checkboxField("qty")])],
      variables: [variable()],
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("has no numeric value");
  });

  it("rejects duplicate variable names", () => {
    const errors = errorsFor({
      pages: [page("p1", [numberField("qty")])],
      variables: [variable(), variable()],
    });
    expect(errors).toEqual(['Duplicate variable name "total"']);
  });
});

describe("collectUnresolvedVariableReferences", () => {
  it("finds references in field labels, option labels and output views", () => {
    expect(
      collectUnresolvedVariableReferences(
        schema({
          pages: [
            page("p1", [
              { ...numberField("qty"), label: "#{nope} each" },
              radioField("pick", ["#{nope}"]),
            ]),
          ],
          outputViews: [
            {
              id: "v1",
              type: "default",
              blocks: [textBlock("b", "#{alsoNope}")],
            },
          ],
        }),
      ),
    ).toEqual([
      { name: "nope", locations: ["qty.label", "pick.options[0].label"] },
      { name: "alsoNope", locations: ["b.text"] },
    ]);
  });

  it("ignores a reference that matches a declared variable", () => {
    expect(
      collectUnresolvedVariableReferences(
        schema({
          pages: [page("p1", [textBlock("b", "Total: #{total}")])],
          variables: [variable()],
        }),
      ),
    ).toEqual([]);
  });
});
