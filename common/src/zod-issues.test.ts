import z from "zod";
import { describeSchemaIssues } from "./zod-issues";

function issuesOf(schema: z.ZodType, value: unknown): string[] {
  const { error } = schema.safeParse(value);
  if (!error) throw new Error("expected a parse failure");
  return describeSchemaIssues(error);
}

describe("describeSchemaIssues", () => {
  it("prefixes each message with its dotted path", () => {
    expect(
      issuesOf(z.object({ a: z.object({ b: z.string() }) }), { a: { b: 1 } }),
    ).toEqual(["a.b: Invalid input: expected string, received number"]);
  });

  it("labels a top-level issue as <root>", () => {
    expect(issuesOf(z.string(), 1)).toEqual([
      "<root>: Invalid input: expected string, received number",
    ]);
  });
});
