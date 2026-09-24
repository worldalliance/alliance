import type { TextBlock } from "./display-blocks";
import type {
  AnyField,
  CheckboxField,
  CityField,
  FileField,
  FormSchema,
  ListField,
  ListSubField,
  MultiSelectField,
  NumberField,
  OutputFieldBlock,
  Page,
  RadioField,
  RangeField,
  TextField,
} from "./form-schema";
import {
  collectVariableInputFields,
  isFieldGroup,
  isQuestionField,
  variableInputFieldsById,
} from "./form-schema";
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
  syncListInputProperties,
  syncVariableListInputs,
  textHasVariableReference,
  VARIABLE_NAME_REGEX,
  type FormVariable,
  type VariableInputField,
  type VariableResolutionContext,
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

const options = (optionLabels: string[]) =>
  optionLabels.map((label, index) => ({ label, value: `value${index}` }));

const radioField = (id: string, optionLabels: string[]): RadioField => ({
  id,
  type: "input",
  kind: "radio",
  label: id,
  options: options(optionLabels),
});

const multiSelectField = (
  id: string,
  optionLabels: string[],
): MultiSelectField => ({
  id,
  type: "input",
  kind: "multiselect",
  label: id,
  options: options(optionLabels),
});

const cityField = (id: string): CityField => ({
  id,
  type: "input",
  kind: "city",
  label: id,
});

const fileField = (id: string): FileField => ({
  id,
  type: "input",
  kind: "file",
  label: id,
});

const numberInputs = (
  ...ids: string[]
): ReadonlyMap<string, VariableInputField> =>
  new Map(ids.map((id) => [id, { kind: "number" }]));

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

  it("reads a list and a record the way JavaScript reads them", () => {
    expect(formatVariableValue(["Solar", "Wind"])).toBe("Solar,Wind");
    expect(formatVariableValue([])).toBe("");
    expect(formatVariableValue({ label: "Solar", value: "v1" })).toBe(
      "[object Object]",
    );
  });

  it("rejects a key the schema does not define", () => {
    expect(
      formVariableSchema.safeParse({ ...variable(), decimalPlaces: 2 }).success,
    ).toBe(false);
  });
});

describe("collectVariableInputFields", () => {
  const listWithSubFields: ListField = {
    id: "items",
    type: "input",
    kind: "list",
    label: "Items",
    fields: [numberField("sub")],
  };

  const offered = (fields: AnyField[] | TextBlock[]) =>
    collectVariableInputFields(schema({ pages: [page("p1", fields)] })).map(
      (field) => field.id,
    );

  it("offers a question field whose answer a formula can read", () => {
    expect(
      offered([numberField("qty"), textField("note"), cityField("where")]),
    ).toEqual(["qty", "note", "where"]);
  });

  it("offers a list but not its sub-fields, which answer once per row", () => {
    expect(offered([numberField("qty"), listWithSubFields])).toEqual([
      "qty",
      "items",
    ]);
  });

  it("leaves out a kind with no answer a formula can read", () => {
    expect(offered([numberField("qty"), fileField("upload")])).toEqual(["qty"]);
  });

  it("leaves out a kind this build doesn't know", () => {
    const future: AnyField = JSON.parse(
      '{ "id": "future", "type": "input", "kind": "future", "label": "Future" }',
    );
    expect(offered([numberField("qty"), future])).toEqual(["qty"]);
  });

  it("leaves out display blocks", () => {
    expect(offered([textBlock("intro", "Hello")])).toEqual([]);
  });

  it("keys the option labels a choice reads, and nothing else", () => {
    const byId = variableInputFieldsById([
      multiSelectField("pick", ["Solar", "Wind"]),
      numberField("qty"),
    ]);
    expect(byId.get("pick")).toEqual({
      kind: "multiselect",
      options: options(["Solar", "Wind"]),
    });
    expect(byId.get("qty")).toEqual({ kind: "number" });
  });
});

describe("formValueToExprValue", () => {
  const qty = numberField("qty");
  const note = textField("note");

  it("reads a number field as a number, however it was stored", () => {
    expect(formValueToExprValue(5, qty)).toBe(5);
    expect(formValueToExprValue("5", qty)).toBe(5);
    expect(formValueToExprValue(" 5.5 ", qty)).toBe(5.5);
    expect(formValueToExprValue("abc", qty)).toBeUndefined();
  });

  it("reads a text field as text, digits included", () => {
    expect(formValueToExprValue(" hello ", note)).toBe("hello");
    expect(formValueToExprValue("01234", note)).toBe("01234");
  });

  it("reads a checkbox as a boolean", () => {
    expect(formValueToExprValue(true, checkboxField("ok"))).toBe(true);
    expect(formValueToExprValue(false, checkboxField("ok"))).toBe(false);
  });

  it("treats blank and unanswered as undefined so ?? can fill in", () => {
    expect(formValueToExprValue(undefined, qty)).toBeUndefined();
    expect(formValueToExprValue(null, qty)).toBeUndefined();
    expect(formValueToExprValue("", qty)).toBeUndefined();
    expect(formValueToExprValue("   ", note)).toBeUndefined();
  });

  it("reads a choice as both its label and its stored value", () => {
    expect(
      formValueToExprValue("value1", radioField("pick", ["Solar", "Wind"])),
    ).toEqual({ label: "Wind", value: "value1" });
  });

  it("falls back to the stored value when the option is gone", () => {
    expect(
      formValueToExprValue("dropped", radioField("pick", ["Solar"])),
    ).toEqual({ label: "dropped", value: "dropped" });
  });

  it("reads a multi-select as a list, in the order it was answered", () => {
    const field = multiSelectField("pick", ["Solar", "Wind"]);
    expect(formValueToExprValue(["value1", "value0"], field)).toEqual([
      { label: "Wind", value: "value1" },
      { label: "Solar", value: "value0" },
    ]);
  });

  it("reads nothing selected the same as nothing answered", () => {
    expect(
      formValueToExprValue([], multiSelectField("pick", ["Solar"])),
    ).toBeUndefined();
  });

  it("reads a city as its parts plus a label", () => {
    expect(
      formValueToExprValue(
        {
          id: 1,
          name: "Paris",
          admin1: "Île-de-France",
          countryCode: "FR",
          countryName: "France",
        },
        cityField("where"),
      ),
    ).toEqual({
      id: 1,
      name: "Paris",
      admin1: "Île-de-France",
      countryCode: "FR",
      countryName: "France",
      label: "Paris, Île-de-France, France",
    });
  });

  it("has no reading for a kind a formula cannot use", () => {
    expect(formValueToExprValue("upload-id", fileField("doc"))).toBeUndefined();
  });
});

describe("evaluateVariable", () => {
  const evaluate = (v: FormVariable, answers: Record<string, number>) =>
    evaluateVariable(v, { answers, fields: numberInputs("qty", "a", "b") });

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
    expect(
      evaluateVariable(v, {
        answers: { a: 0.1, b: 0.2 },
        fields: numberInputs("a", "b"),
      }),
    ).toEqual({
      ok: true,
      value: "0.3",
    });
  });

  it("counts turning the result into text against the step budget", () => {
    const doublings = JSON.stringify(Array.from({ length: 26 }, (_, i) => i));
    const v = variable({
      formula: `${doublings}.reduce((a, b) => ({ v: [a.v, a.v] }), { v: [1] }).v`,
    });
    expect(evaluate(v, {})).toEqual({
      ok: false,
      error: "The formula takes too long to work out.",
    });
  });

  it("writes out the choices behind a multi-select answer", () => {
    const v = variable({
      inputs: { input1: { kind: "field", fieldId: "pick" } },
      formula: "input1.map(choice => choice.label).join(' and ')",
    });
    const result = evaluateVariable(v, {
      answers: { pick: ["value0", "value1"] },
      fields: new Map([["pick", multiSelectField("pick", ["Solar", "Wind"])]]),
    });
    expect(result).toEqual({ ok: true, value: "Solar and Wind" });
  });

  it("counts the selections a formula filters down to", () => {
    const v = variable({
      inputs: { input1: { kind: "field", fieldId: "pick" } },
      formula: "input1.filter(choice => choice.value !== 'value0').length",
    });
    const result = evaluateVariable(v, {
      answers: { pick: ["value0", "value1", "value2"] },
      fields: new Map([
        ["pick", multiSelectField("pick", ["Solar", "Wind", "Hydro"])],
      ]),
    });
    expect(result).toEqual({ ok: true, value: "2" });
  });

  it("writes a raw list of choices the way JavaScript writes one", () => {
    const v = variable({
      inputs: { input1: { kind: "field", fieldId: "pick" } },
      formula: "input1",
    });
    const result = evaluateVariable(v, {
      answers: { pick: ["value0"] },
      fields: new Map([["pick", multiSelectField("pick", ["Solar", "Wind"])]]),
    });
    expect(result).toEqual({ ok: true, value: "[object Object]" });
  });

  it("reads nothing from an input whose field is gone", () => {
    const v = variable({ formula: "input1 ?? 'n/a'" });
    expect(
      evaluateVariable(v, { answers: { qty: 3 }, fields: new Map() }),
    ).toEqual({ ok: true, value: "n/a" });
  });

  it("fails on an input of a kind this build doesn't know", () => {
    const v: FormVariable = {
      ...variable({ formula: "input1 ?? 'n/a'" }),
      inputs: JSON.parse(
        '{ "input1": { "kind": "future", "fieldId": "qty" } }',
      ),
    };
    expect(evaluate(v, { qty: 3 })).toEqual({
      ok: false,
      error: "Unknown input kind: future",
    });
  });

  it("fails on a field of a kind this build doesn't know", () => {
    const v = variable({ formula: "input1 ?? 'n/a'" });
    expect(
      evaluateVariable(v, {
        answers: { qty: 3 },
        fields: new Map([["qty", JSON.parse('{ "kind": "future" }')]]),
      }),
    ).toEqual({ ok: false, error: "Unknown field kind: future" });
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
      { answers: { qty: 10 }, fields: numberInputs("qty") },
    );
    expect(values).toEqual({
      ok: true,
      value: new Map([
        ["total", "20"],
        ["half", "5"],
      ]),
    });
  });

  it("fails, naming the variable, when one cannot compile", () => {
    const values = resolveVariableValues(
      [variable(), variable({ name: "broken", formula: "this" })],
      { answers: { qty: 1 }, fields: numberInputs("qty") },
    );
    expect(values).toEqual({
      ok: false,
      error: expect.stringMatching(/^#\{broken\}: /),
    });
  });
});

describe("list inputs", () => {
  const people: ListField = {
    id: "people",
    type: "input",
    kind: "list",
    label: "People",
    fields: [
      { ...textField("n"), label: "Name" },
      { ...numberField("a"), label: "Age" },
      { ...multiSelectField("r", ["Engineer", "Chair"]), label: "Roles" },
      fileField("photo"),
    ],
  };

  const properties = { n: "name", a: "age", r: "roles" };

  const listVariable = (formula: string): FormVariable =>
    variable({
      inputs: { input1: { kind: "list", fieldId: "people", properties } },
      formula,
    });

  const evaluateList = (
    formula: string,
    answers: VariableResolutionContext["answers"],
  ) =>
    evaluateVariable(listVariable(formula), {
      answers,
      fields: variableInputFieldsById([people]),
    });

  describe("syncListInputProperties", () => {
    it("names each readable sub-field from its label", () => {
      expect(syncListInputProperties({}, people.fields)).toEqual(properties);
    });

    it("keeps a name the author already chose, whatever the label says", () => {
      expect(
        syncListInputProperties({ n: "who", a: "age" }, people.fields),
      ).toEqual({ n: "who", a: "age", r: "roles" });
    });

    it("drops a name for a sub-field that is gone or unreadable", () => {
      expect(
        syncListInputProperties(
          { ...properties, gone: "old", photo: "photo" },
          people.fields,
        ),
      ).toEqual(properties);
    });

    it("keeps a name for a sub-field of a kind this build doesn't know", () => {
      const future: ListSubField = JSON.parse(
        '{ "id": "sig", "type": "input", "kind": "future", "label": "Sig" }',
      );
      expect(
        syncListInputProperties({ ...properties, sig: "sig" }, [
          ...people.fields,
          future,
        ]),
      ).toEqual({ ...properties, sig: "sig" });
    });

    it("falls back when a label gives no usable name, and never repeats one", () => {
      expect(
        syncListInputProperties({ a: "field" }, [
          { ...textField("blank"), label: null },
          { ...textField("digits"), label: "2 kids" },
          { ...textField("dup"), label: "Age" },
          { ...textField("dup2"), label: "Age!" },
          { ...textField("proto"), label: "constructor" },
          { ...textField("apos"), label: "What's your age?" },
          { ...textField("emoji"), label: "🎉 Party" },
          numberField("a"),
        ]),
      ).toEqual({
        blank: "field2",
        digits: "field2Kids",
        dup: "age",
        dup2: "age2",
        proto: "constructor2",
        apos: "whatsYourAge",
        emoji: "party",
        a: "field",
      });
    });

    it("leaves a variable whose inputs are in sync as the same object", () => {
      const synced = listVariable("input1.length");
      const fields = variableInputFieldsById([people]);
      expect(syncVariableListInputs([synced], fields)[0]).toBe(synced);
      const stale = variable({
        inputs: {
          input1: { kind: "list", fieldId: "people", properties: { n: "x" } },
        },
      });
      expect(syncVariableListInputs([stale], fields)[0].inputs).toEqual({
        input1: {
          kind: "list",
          fieldId: "people",
          properties: { n: "x", a: "age", r: "roles" },
        },
      });
    });
  });

  describe("evaluateVariable", () => {
    it("reads one record per row, each cell converted like its field", () => {
      const result = evaluateList(
        "input1.map(p => [p.name, p.age + 1, p.roles.map(r => r.label).join('/')].join(' ')).join('; ')",
        {
          people: [
            { n: "Ada", a: "34", r: ["value0", "value1"] },
            { n: "Lin" },
          ],
        },
      );
      expect(result).toEqual({
        ok: true,
        value: "Ada 35 Engineer/Chair; Lin  ",
      });
    });

    it("reads a blank or unusable cell as undefined", () => {
      const result = evaluateList(
        "input1.map(p => [p.name ?? '-', p.age ?? '-', p.roles ?? '-'].join()).join('|')",
        { people: [{ n: "  ", a: "abc", r: [] }, {}] },
      );
      expect(result).toEqual({ ok: true, value: "-,-,-|-,-,-" });
    });

    it("reads an empty or unanswered list as no rows", () => {
      expect(evaluateList("input1.length", { people: [] })).toEqual({
        ok: true,
        value: "0",
      });
      expect(evaluateList("input1.length", {})).toEqual({
        ok: true,
        value: "0",
      });
    });

    it("fails on a sub-field of a kind this build doesn't know", () => {
      const future: ListSubField = JSON.parse(
        '{ "id": "sig", "type": "input", "kind": "future", "label": "Sig" }',
      );
      const result = evaluateVariable(
        variable({
          inputs: {
            input1: {
              kind: "list",
              fieldId: "people",
              properties: { ...properties, sig: "sig" },
            },
          },
          formula: "input1.map(p => p.sig ?? 'unsigned').join()",
        }),
        {
          answers: { people: [{ n: "Ada", sig: "signed" }] },
          fields: variableInputFieldsById([
            { ...people, fields: [...people.fields, future] },
          ]),
        },
      );
      expect(result).toEqual({
        ok: false,
        error: "Unknown field kind: future",
      });
    });

    it("counts the rows of a list with nothing else to read", () => {
      const onlyFiles: ListField = { ...people, fields: [fileField("photo")] };
      const result = evaluateVariable(
        variable({
          inputs: {
            input1: { kind: "list", fieldId: "people", properties: {} },
          },
          formula: "input1.length",
        }),
        {
          answers: { people: [{ photo: "a" }, {}] },
          fields: variableInputFieldsById([onlyFiles]),
        },
      );
      expect(result).toEqual({ ok: true, value: "2" });
    });
  });

  describe("validateFormSchema", () => {
    const errorsFor = (variables: FormVariable[], list = people) =>
      validateFormSchema(
        schema({ pages: [page("p1", [list])], variables }),
      ).map((error) => error.message);

    it("accepts a formula that reduces the rows to text", () => {
      expect(
        errorsFor([listVariable("input1.map(p => p.name).join(', ')")]),
      ).toEqual([]);
      expect(errorsFor([listVariable("input1.length")])).toEqual([]);
    });

    it.each(["input1", "input1[0]", "input1.map(p => p.roles)"])(
      "rejects %s, which ends on a list or a record",
      (formula) => {
        const errors = errorsFor([listVariable(formula)]);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain("has to end on text");
      },
    );

    it("rejects a property no sub-field has", () => {
      const errors = errorsFor([listVariable("input1.map(p => p.photo)[0]")]);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("photo");
    });

    it("rejects a readable sub-field without a name, and a name without one", () => {
      const v = variable({
        inputs: {
          input1: {
            kind: "list",
            fieldId: "people",
            properties: { n: "name", a: "age", photo: "photo" },
          },
        },
        formula: "input1.length",
      });
      expect(errorsFor([v])).toEqual([
        'Input "input1" has no property name for sub-field "r"',
        'Input "input1" names property "photo" for "photo", which is not a readable sub-field of list "people"',
      ]);
    });

    it("rejects reading a sub-field of a kind this build doesn't know", () => {
      const future: ListSubField = JSON.parse(
        '{ "id": "sig", "type": "input", "kind": "future", "label": "Sig" }',
      );
      const v = variable({
        inputs: {
          input1: {
            kind: "list",
            fieldId: "people",
            properties: { ...properties, sig: "sig" },
          },
        },
        formula: "input1.map(p => p.sig).join()",
      });
      expect(
        errorsFor([v], { ...people, fields: [...people.fields, future] }),
      ).toEqual([
        'Input "input1" reads sub-field "sig", whose kind (future) this build doesn\'t know. Reload the page',
      ]);
    });

    it("rejects a repeated or reserved property name", () => {
      const v = variable({
        inputs: {
          input1: {
            kind: "list",
            fieldId: "people",
            properties: { n: "name", a: "name", r: "constructor" },
          },
        },
        formula: "input1.length",
      });
      expect(errorsFor([v])).toEqual([
        'Input "input1" uses property name "name" more than once',
        'Input "input1" cannot use "constructor" as a property name',
      ]);
    });

    it("rejects a property name a formula cannot write", () => {
      const v = variable({
        inputs: {
          input1: {
            kind: "list",
            fieldId: "people",
            properties: { ...properties, n: "" },
          },
        },
        formula: "input1.length",
      });
      const errors = errorsFor([v]);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('property "" has to start with a letter');
    });

    it("rejects a list read as a single field, and a field read as a list", () => {
      expect(
        errorsFor([
          variable({
            inputs: { input1: { kind: "field", fieldId: "people" } },
            formula: "input1",
          }),
        ]),
      ).toEqual([
        'Input "input1" reads list "people" as a single field. Read it as a list input',
      ]);
      expect(
        validateFormSchema(
          schema({
            pages: [page("p1", [numberField("qty")])],
            variables: [
              variable({
                inputs: {
                  input1: { kind: "list", fieldId: "qty", properties: {} },
                },
                formula: "input1.length",
              }),
            ],
          }),
        ).map((error) => error.message),
      ).toEqual([
        'Input "input1" reads field "qty" as a list, but its kind is number',
      ]);
    });
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

  it("substitutes into section titles and the blocks they hold", () => {
    const block = interpolateDisplayBlock(
      {
        id: "b",
        type: "display",
        kind: "accordion",
        sections: [
          {
            id: "s1",
            title: "Saved #{total}",
            blocks: [textBlock("n1", "You saved #{total}")],
          },
        ],
      },
      values,
    );
    expect(block.sections[0].title).toBe("Saved 42");
    expect(block.sections[0].blocks[0]).toMatchObject({
      text: "You saved 42",
    });
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
      fields: currentPage.fields.map((element) => {
        if (isFieldGroup(element)) {
          return {
            ...element,
            fields: element.fields.map((child) =>
              isQuestionField(child)
                ? interpolateFieldText(child, values)
                : interpolateDisplayBlock(child, values),
            ),
          };
        }
        return isQuestionField(element)
          ? interpolateFieldText(element, values)
          : interpolateDisplayBlock(element, values);
      }),
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
            {
              id: "acc",
              type: "display",
              kind: "accordion",
              sections: [
                {
                  id: "s1",
                  title: "#{total}",
                  blocks: [textBlock("nested", "#{total}")],
                },
              ],
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
    expect(errors[0]).toContain("not available");
  });

  it("rejects a formula that runs too long with every input unanswered", () => {
    expect(
      errorsFor({
        pages: [page("p1", [numberField("qty")])],
        variables: [
          variable({
            formula:
              "'x'.repeat(10000).split('').filter(a => 'y'.repeat(10000).split('').includes(a)).length",
          }),
        ],
      }),
    ).toEqual(['Formula for "total": The formula takes too long to work out.']);
  });

  it("accepts a formula that runs too long only on long answers", () => {
    expect(
      errorsFor({
        pages: [page("p1", [textField("qty")])],
        variables: [
          variable({
            formula:
              "input1.split('').filter(a => input1.split('').includes(a)).length",
          }),
        ],
      }),
    ).toEqual([]);
  });

  describe("an unanswered list reads as empty", () => {
    const tooLong =
      "'x'.repeat(10000).split('').filter(a => 'y'.repeat(10000).split('').includes(a)).length";
    const errorsForListFormula = (formula: string) =>
      errorsFor({
        pages: [
          page("p1", [
            {
              id: "people",
              type: "input",
              kind: "list",
              label: "People",
              fields: [textField("n")],
            } satisfies ListField,
          ]),
        ],
        variables: [
          variable({
            inputs: {
              input1: {
                kind: "list",
                fieldId: "people",
                properties: { n: "name" },
              },
            },
            formula,
          }),
        ],
      });

    it("rejects a formula that runs too long on an empty list", () => {
      expect(
        errorsForListFormula(`input1.length === 0 ? ${tooLong} : 0`),
      ).toEqual([
        'Formula for "total": The formula takes too long to work out.',
      ]);
    });

    it("accepts a formula that runs too long only on a missing list", () => {
      expect(errorsForListFormula(`input1.length ?? ${tooLong}`)).toEqual([]);
    });
  });

  it("rejects an input pointing at a missing field", () => {
    expect(errorsFor({ variables: [variable()] })).toEqual([
      'Input "input1" references missing field "qty"',
    ]);
  });

  it("rejects an input reading a field with nothing a formula can read", () => {
    const errors = errorsFor({
      pages: [page("p1", [fileField("qty")])],
      variables: [variable()],
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("has no value a formula can read");
  });

  it("rejects an input reading a field of a kind this build doesn't know", () => {
    expect(
      errorsFor({
        pages: [
          page("p1", [
            JSON.parse(
              '{ "id": "qty", "type": "input", "kind": "future", "label": "Future" }',
            ),
          ]),
        ],
        variables: [variable()],
      }),
    ).toEqual([
      'Input "input1" reads field "qty", whose kind (future) this build doesn\'t know. Reload the page',
    ]);
  });

  it.each([
    '{ "kind": "future", "fieldId": "qty" }',
    '{ "kind": "future", "fieldId": "cell" }',
    '{ "kind": "future", "listId": "list" }',
  ])("rejects an input of a kind this build doesn't know: %s", (input) => {
    const list: ListField = {
      id: "list",
      type: "input",
      kind: "list",
      label: "Items",
      fields: [numberField("cell")],
    };
    expect(
      errorsFor({
        pages: [page("p1", [numberField("qty"), list])],
        variables: [
          { ...variable(), inputs: JSON.parse(`{ "input1": ${input} }`) },
        ],
      }),
    ).toEqual([
      'Input "input1" has a kind (future) this build doesn\'t know. Reload the page',
    ]);
  });

  it.each([
    ["number", numberField("qty"), "input1 * 2"],
    ["text", textField("qty"), "input1.toUpperCase()"],
    ["checkbox", checkboxField("qty"), "input1 ? 'yes' : 'no'"],
    ["choice", radioField("qty", ["Solar"]), "input1.label"],
    [
      "multi-select",
      multiSelectField("qty", ["Solar"]),
      "input1.map(choice => choice.label).join(', ')",
    ],
    ["city", cityField("qty"), "input1.label"],
  ])(
    "accepts a %s input read the way its type allows",
    (_label, field, formula) => {
      expect(
        errorsFor({
          pages: [page("p1", [field])],
          variables: [variable({ formula })],
        }),
      ).toEqual([]);
    },
  );

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
