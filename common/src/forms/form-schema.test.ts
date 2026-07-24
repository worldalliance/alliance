import { anyFieldSchema } from "./form-schema";

const optionField = (
  kind: "radio" | "select" | "multiselect" | "ranking",
  values: string[],
) => ({
  id: "field",
  type: "input",
  kind,
  label: "Field",
  options: values.map((value) => ({ label: value.toUpperCase(), value })),
});

describe("option value uniqueness", () => {
  const kinds = ["radio", "select", "multiselect", "ranking"] as const;

  it.each(kinds)("accepts distinct option values for %s", (kind) => {
    expect(
      anyFieldSchema.safeParse(optionField(kind, ["a", "b"])).success,
    ).toBe(true);
  });

  it.each(kinds)("rejects duplicate option values for %s", (kind) => {
    expect(
      anyFieldSchema.safeParse(optionField(kind, ["a", "b", "a"])).success,
    ).toBe(false);
  });
});
