import type { AnyField, FormSchema } from "./form-schema";
import { validateFormSchema } from "./form-schema-validate";

const toggle = (id: string, atLeastOneOnWith?: string): AnyField => ({
  id,
  type: "input",
  kind: "toggle",
  label: id,
  ...(atLeastOneOnWith ? { atLeastOneOnWith } : {}),
});

const errors = (...fields: AnyField[]) => {
  const schema: FormSchema = { pages: [{ id: "p1", fields }], outputViews: [] };
  return validateFormSchema(schema).map((error) => error.blockId);
};

describe("a toggle's atLeastOneOnWith", () => {
  it("may name another toggle in the form", () => {
    expect(errors(toggle("text"), toggle("email", "text"))).toEqual([]);
  });

  it.each([
    ["a removed field", [toggle("email", "text")]],
    ["the toggle itself", [toggle("email", "email")]],
    [
      "a field that isn't a toggle",
      [
        { id: "text", type: "input", kind: "checkbox", label: "Text" },
        toggle("email", "text"),
      ],
    ],
  ] satisfies [string, AnyField[]][])("refuses %s", (_, fields) => {
    expect(errors(...fields)).toEqual(["email"]);
  });
});
