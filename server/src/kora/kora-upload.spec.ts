import {
  EXPORT_SCHEMA_TEXT,
  koraPair,
  koraPairsFile,
} from "../../test/kora-pairs";
import {
  checkExportSchema,
  checkTranscripts,
  contentHash,
} from "./kora-upload";

const check = (text: string, existing: string[] = [], retired: string[] = []) =>
  checkTranscripts({
    text,
    existingIds: new Set([...existing, ...retired]),
    retiredIds: new Set(retired),
  });

describe("checkTranscripts", () => {
  it("converts every pair, keeping only the schema's fields, with a hash of what is stored", () => {
    const result = check(koraPairsFile(koraPair("P1"), koraPair("P2")));
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(result.value.map((t) => t.id)).toEqual(["P1", "P2"]);
    const [first] = result.value;
    expect(first.category).toBe("academic_dishonesty_and_misuse");
    expect(first.content).not.toHaveProperty("risk_category_id");
    expect(first.contentHash).toBe(contentHash(first.content));
    expect(first.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("reports every bad line by number, not only the first", () => {
    const text = [
      JSON.stringify(koraPair("P1")),
      "{not json",
      JSON.stringify(koraPair("P3", { risk_id: "not_a_category" })),
      JSON.stringify(koraPair("P1")),
    ].join("\n");
    const result = check(text);
    if (result.ok) throw new Error("expected rejection");
    expect(result.error.map((r) => r.line)).toEqual([2, 3, 4]);
    expect(result.error[0].problems[0]).toContain("isn't valid JSON");
    expect(result.error[2].problems).toEqual([
      "repeats transcript P1 from line 1",
    ]);
  });

  it("rejects a transcript id from an earlier batch", () => {
    const result = check(koraPairsFile(koraPair("OLD")), ["OLD"]);
    if (result.ok) throw new Error("expected rejection");
    expect(result.error).toEqual([
      {
        line: 1,
        problems: ["transcript OLD was already uploaded in an earlier batch"],
      },
    ]);
  });

  it("points a transcript id from a retired batch to Reactivate", () => {
    const result = check(koraPairsFile(koraPair("OLD")), [], ["OLD"]);
    if (result.ok) throw new Error("expected rejection");
    expect(result.error[0].problems).toEqual([
      "transcript OLD belongs to a retired batch, so reactivate that batch instead",
    ]);
  });

  it("rejects an empty file", () => {
    expect(check("\n\n").ok).toBe(false);
  });
});

const otherVersion = () => {
  const schema = JSON.parse(EXPORT_SCHEMA_TEXT);
  schema.properties.schemaVersion = { const: 99 };
  return JSON.stringify(schema);
};

describe("checkExportSchema", () => {
  it("accepts the review tool's own export schema", () => {
    expect(checkExportSchema(EXPORT_SCHEMA_TEXT).ok).toBe(true);
  });

  it("refuses text that isn't JSON, a schema that doesn't compile, and one that rejects the tool's exports", () => {
    const messages = [
      "not json",
      JSON.stringify({ type: "not-a-type" }),
      otherVersion(),
    ].map((text) => {
      const result = checkExportSchema(text);
      return result.ok ? null : result.error;
    });
    expect(messages[0]).toContain("isn't valid JSON");
    expect(messages[1]).toContain("isn't a valid JSON Schema");
    expect(messages[2]).toContain("rejects the review tool's exports");
  });
});
