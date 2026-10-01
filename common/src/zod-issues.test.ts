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

  it("reports a failed union through its closest branch", () => {
    const schema = z.object({
      items: z.array(
        z.union([
          z.object({ type: z.literal("a"), label: z.string() }),
          z.object({ type: z.literal("b"), count: z.number() }),
        ]),
      ),
    });
    expect(issuesOf(schema, { items: [{ type: "a", label: 1 }] })).toEqual([
      "items.0.label: Invalid input: expected string, received number",
    ]);
  });

  it("passes over a union branch whose discriminator matched nothing", () => {
    const schema = z.union([
      z.discriminatedUnion("kind", [z.object({ kind: z.literal("a") })]),
      z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("b"), text: z.string() }),
      ]),
    ]);
    expect(issuesOf(schema, { kind: "b", text: 5 })).toEqual([
      "text: Invalid input: expected string, received number",
    ]);
  });

  it("passes over a union branch that rejects the input's type", () => {
    const schema = z.union([
      z.string(),
      z.object({ op: z.literal("NOT"), operand: z.string() }),
    ]);
    expect(issuesOf(schema, { op: "NOT", operand: 5 })).toEqual([
      "operand: Invalid input: expected string, received number",
    ]);
  });

  it("prefers a union branch whose literal tags match", () => {
    const schema = z.union([
      z.object({ type: z.literal("a"), x: z.string() }),
      z.object({ type: z.literal("b"), y: z.string(), z: z.string() }),
    ]);
    expect(issuesOf(schema, { type: "b", y: 1, z: 1 })).toEqual([
      "y: Invalid input: expected string, received number",
      "z: Invalid input: expected string, received number",
    ]);
  });

  it("keeps the bare union message when no branch fits the input's shape", () => {
    expect(
      issuesOf(
        z.union([
          z.string(),
          z.discriminatedUnion("kind", [z.object({ kind: z.literal("a") })]),
        ]),
        5,
      ),
    ).toEqual(["<root>: Invalid input"]);
  });

  it("keeps the bare union message when no branch's tag matches", () => {
    const item = z.union([
      z.discriminatedUnion("kind", [
        z.object({ type: z.literal("input"), kind: z.literal("text") }),
      ]),
      z.object({
        type: z.literal("group"),
        kind: z.literal("group"),
        fields: z.array(z.string()),
      }),
    ]);
    expect(issuesOf(item, { type: "input", kind: "txet" })).toEqual([
      "<root>: Invalid input",
    ]);
    const node = z.union([
      z.object({ op: z.literal("AND"), left: z.string() }),
      z.object({ op: z.literal("NOT"), operand: z.string() }),
    ]);
    expect(issuesOf(node, { op: "XOR", left: "a" })).toEqual([
      "<root>: Invalid input",
    ]);
  });

  it("reports a discriminator mismatch nested inside the branch the input meant", () => {
    const schema = z.union([
      z.object({
        type: z.literal("a"),
        child: z.discriminatedUnion("kind", [
          z.object({ kind: z.literal("x") }),
        ]),
      }),
      z.object({ type: z.literal("b"), y: z.string() }),
    ]);
    expect(issuesOf(schema, { type: "a", child: { kind: "zzz" } })).toEqual([
      "child.kind: Invalid input",
    ]);
  });

  it("counts each extra key when comparing untagged strict branches", () => {
    const schema = z.union([
      z.strictObject({ text: z.string() }),
      z.strictObject({ url: z.string().optional() }),
    ]);
    expect(issuesOf(schema, { text: 5, extra: 1 })).toEqual([
      "text: Invalid input: expected string, received number",
      '<root>: Unrecognized key: "extra"',
    ]);
  });

  it("breaks a tie toward the branch that recognizes the input's keys", () => {
    const actionId = z.strictObject({ actionId: z.number().optional() });
    const targetId = z.strictObject({
      externalTargetId: z.number().optional(),
    });
    const expected = [
      "externalTargetId: Invalid input: expected number, received string",
    ];
    for (const schema of [
      z.union([actionId, targetId]),
      z.union([targetId, actionId]),
    ]) {
      expect(issuesOf(schema, { externalTargetId: "5" })).toEqual(expected);
    }
  });

  it("passes over a nested union branch none of whose branches fit", () => {
    const schema = z.union([
      z.union([z.string(), z.number()]),
      z.object({ op: z.literal("NOT"), operand: z.string() }),
    ]);
    expect(issuesOf(schema, { op: "NOT", operand: 5 })).toEqual([
      "operand: Invalid input: expected string, received number",
    ]);
  });
});
