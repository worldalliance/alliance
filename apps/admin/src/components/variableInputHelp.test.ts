import type { AnyField, FormSchema } from "@alliance/common/forms/form-schema";
import {
  compileVariableExpression,
  evaluateVariableExpression,
  type ExprValue,
} from "@alliance/common/forms/variable-expression";
import { checkVariableFormulaType } from "@alliance/common/forms/variable-formula-check";
import type { VariableInput } from "@alliance/common/forms/variable-inputs";
import { variableFieldScope } from "@alliance/common/forms/variable-scope";
import { variableTypeEnv } from "@alliance/common/forms/variables";
import { inputHelp } from "./variableInputHelp";

const OPTIONS = [{ label: "Weekly", value: "weekly" }];

const fields: AnyField[] = [
  { id: "number", type: "input", kind: "number", label: "Number" },
  { id: "text", type: "input", kind: "text", label: "Text" },
  { id: "checkbox", type: "input", kind: "checkbox", label: "Checkbox" },
  {
    id: "radio",
    type: "input",
    kind: "radio",
    label: "Radio",
    options: OPTIONS,
  },
  {
    id: "multiselect",
    type: "input",
    kind: "multiselect",
    label: "Multiselect",
    options: OPTIONS,
  },
  { id: "city", type: "input", kind: "city", label: "City" },
  {
    id: "list",
    type: "input",
    kind: "list",
    label: "List",
    fields: [{ id: "name", type: "input", kind: "text", label: "Name" }],
  },
];

const SOURCE_FORM_ID = 2;
const schema: FormSchema = { pages: [{ id: "p1", fields }], outputViews: [] };
const scope = variableFieldScope(schema, new Map([[SOURCE_FORM_ID, fields]]));

const inputsFor = (field: AnyField): VariableInput[] =>
  field.kind === "list"
    ? [
        { kind: "list", fieldId: field.id, properties: { name: "name" } },
        {
          kind: "sourceList",
          sourceFormId: SOURCE_FORM_ID,
          fieldId: field.id,
          properties: { name: "name" },
        },
      ]
    : [
        { kind: "field", fieldId: field.id },
        {
          kind: "sourceField",
          sourceFormId: SOURCE_FORM_ID,
          fieldId: field.id,
        },
      ];

for (const field of fields) {
  for (const input of inputsFor(field)) {
    test(`the ${input.kind} example for a ${field.kind} field is a valid formula`, () => {
      const formula = inputHelp(input, field).example("input1");
      const variable = { name: "v", inputs: { input1: input }, formula };
      expect(
        compileVariableExpression(formula, new Set(["input1"])),
      ).toMatchObject({ ok: true });
      expect(
        checkVariableFormulaType(formula, variableTypeEnv(variable, scope)),
      ).toMatchObject({ ok: true });
    });
  }
}

const runExample = (input: VariableInput, answers: ExprValue[]) => {
  const field = fields.find((each) => each.id === input.fieldId);
  const formula = inputHelp(input, field).example("input1");
  const compiled = compileVariableExpression(formula, new Set(["input1"]));
  if (!compiled.ok) throw new Error(compiled.error);
  return evaluateVariableExpression(
    compiled.value,
    new Map([["input1", answers]]),
  );
};

test("the sourceList example skips a submission with no rows", () => {
  expect(
    runExample(
      {
        kind: "sourceList",
        sourceFormId: SOURCE_FORM_ID,
        fieldId: "list",
        properties: { name: "name" },
      },
      [[{ name: "a" }], [], [{ name: "b" }]],
    ),
  ).toBe("a, b");
});

test("the sourceField example for a multiselect skips a submission with none chosen", () => {
  const choice = (label: string) => ({ label, value: label.toLowerCase() });
  expect(
    runExample(
      {
        kind: "sourceField",
        sourceFormId: SOURCE_FORM_ID,
        fieldId: "multiselect",
      },
      [[choice("A")], [], undefined, [choice("B")]],
    ),
  ).toBe("A, B");
});
